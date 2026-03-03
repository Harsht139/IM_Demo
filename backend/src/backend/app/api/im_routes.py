import math
import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from typing import List, Dict
from datetime import datetime
from app.config import ALLOWED_UPLOAD_EXTENSIONS, BLOCKED_EXTENSIONS, MAX_UPLOAD_SIZE_MB
from app.services.ingestion_service import save_uploaded_files, process_files
from app.services.reconciliation_service import reconciliation_service, ReconciliationResult
from app.services.im_service import im_service, IMSection, IMResponse
from app.services.docx_service import docx_service
from app.services.pdf_service import pdf_service
from app.services.rag_service import rag_service
from app.services.drive_service import drive_service
from app.services.storage_service import storage_service
from app.services.supabase_service import supabase_service
from app.models.schema import BusinessUnit, Fact, FactUpdate
from app.logging import get_logger

logger = get_logger(__name__)

def clean_nan_values(obj):
    """Recursively clean NaN values from data structures before JSON serialization."""
    if isinstance(obj, float):
        return None if math.isnan(obj) else obj
    elif isinstance(obj, list):
        return [clean_nan_values(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: clean_nan_values(value) for key, value in obj.items()}
    else:
        return obj

router = APIRouter(tags=["Intelligence Operations"])

async def _validate_upload_file(file: UploadFile) -> None:
    """Validate file type and size. Raises HTTPException on failure."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filename")
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: pdf, docx, xlsx, csv, txt",
        )
    # Size check: read in chunks to avoid loading huge files into memory
    max_bytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024
    size = 0
    while chunk := await file.read(1024 * 1024):
        size += len(chunk)
        if size > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File {file.filename} exceeds max size of {MAX_UPLOAD_SIZE_MB}MB",
            )
    await file.seek(0)


@router.post("/{bu_id}/upload")
async def upload_documents(bu_id: str, files: List[UploadFile] = File(...)):
    bu = supabase_service.get_business_unit(bu_id)
    if not bu:
        raise HTTPException(status_code=404, detail="Business Unit not found")

    for file in files:
        await _validate_upload_file(file)

    saved_filenames = await save_uploaded_files(bu_id, files)

    # Persist documents to Supabase with "uploaded" status
    docs_created = []
    for filename in saved_filenames:
        doc_in = {
            "name": filename,
            "storage_path": storage_service.get_file_path(bu_id, filename),
            "status": "uploaded"
        }
        new_doc = supabase_service.add_document(bu_id, doc_in)
        if new_doc:
            docs_created.append(new_doc.dict())

    return {
        "message": "Upload complete",
        "data": docs_created
    }

@router.post("/{bu_id}/process")
async def process_documents(bu_id: str, force_reprocess: bool = False, filename: str = None):
    bu = supabase_service.get_business_unit(bu_id)
    if not bu:
        raise HTTPException(status_code=404, detail="Business Unit not found")

    # Find documents that need processing
    if filename:
        unprocessed_docs = [doc for doc in bu.documents if doc.name == filename]
    elif force_reprocess:
        unprocessed_docs = bu.documents
    else:
        unprocessed_docs = [doc for doc in bu.documents if doc.status == "uploaded"]

    if not unprocessed_docs:
        # Just run reconciliation on already processed docs to return state
        extracted_data = [
            {
                "doc_id": doc.id,
                "business_unit_id": bu_id,
                "filename": doc.name, 
                "facts": doc.extraction_data, 
                "docling_json": doc.docling_json,
                "type": "docling" if doc.docling_json else "excel" if doc.name.lower().endswith(('.xlsx', '.csv')) else "text"
            }
            for doc in bu.documents if doc.status == "processed"
        ]
        reconciliation_result = await reconciliation_service.reconcile_documents(extracted_data)
        return clean_nan_values({
            "message": "No new documents to process",
            "data": extracted_data,
            "reconciliation": reconciliation_result.dict() if reconciliation_result else None
        })

    filenames = [doc.name for doc in unprocessed_docs]
    
    # 1. Clear out old vector chunks for these files before reprocessing
    for filename in filenames:
        supabase_service.delete_document_chunks(bu_id, filename)

    # 2. Start extraction (which implicitly runs RAG indexing via ingestion_service)
    extracted_data = await process_files(bu_id, filenames)

    # Reconcile all documents in BU
    all_extracted = [
        {
            "doc_id": doc.id,
            "business_unit_id": bu_id,
            "filename": doc.name, 
            "facts": doc.extraction_data, 
            "docling_json": doc.docling_json,
            "type": "docling" if doc.docling_json else "excel" if doc.name.lower().endswith(('.xlsx', '.csv')) else "text"
        }
        for doc in bu.documents if doc.status == "processed"
    ]
    
    # Add doc_id and bu_id to the fresh extraction data
    for doc in extracted_data:
        doc_id = next((d.id for d in unprocessed_docs if d.name == doc["filename"]), None)
        doc["doc_id"] = doc_id
        doc["business_unit_id"] = bu_id

    all_extracted.extend(extracted_data)
    
    reconciliation_result = await reconciliation_service.reconcile_documents(all_extracted)

    # Update processed documents in Supabase
    for doc in extracted_data:
        filename = doc["filename"]
        # find matching doc_id
        doc_id = next((d.id for d in unprocessed_docs if d.name == filename), None)
        if doc_id:
            doc_facts = [
                f.dict() for f in reconciliation_result.facts 
                if f.citation.source_file == filename
            ]
            supabase_service.update_document(doc_id, {
                "extraction_data": doc_facts,
                "docling_json": doc.get("docling_json"),
                "status": "processed"
            })
            # Attach facts back to the dict so the response includes them
            doc["facts"] = doc_facts

    return clean_nan_values({
        "message": "Processing complete",
        "data": all_extracted,
        "reconciliation": reconciliation_result.dict()
    })

@router.delete("/{bu_id}/documents/{doc_id}")
async def delete_document(bu_id: str, doc_id: str):
    # Lookup filename to delete chunks
    bu = supabase_service.get_business_unit(bu_id)
    if bu:
        doc = next((d for d in bu.documents if d.id == doc_id), None)
        if doc:
            supabase_service.delete_document_chunks(bu_id, doc.name)
            
    # Delete facts first
    supabase_service.delete_facts_by_document(doc_id)
    success = supabase_service.delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document and associated facts deleted"}

@router.get("/{bu_id}/files/{filename}")
async def get_document_file(bu_id: str, filename: str):
    filepath = storage_service.get_file_path(bu_id, filename)
    if not filepath:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Return FileResponse with explicit headers to enable Range Requests (HTTP 206)
    # and aggressive caching for "instant" subsequent loads.
    return FileResponse(
        filepath,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600", # Cache for 1 hour to speed up re-visits
        }
    )

# --- Fact Management APIs ---

@router.get("/{bu_id}/reconciliation")
async def get_reconciliation_state(bu_id: str):
    """
    Fetch the current reconciliation state (facts and conflicts) for a business unit
    without triggering a full re-process.
    """
    bu = supabase_service.get_business_unit(bu_id)
    if not bu:
        raise HTTPException(status_code=404, detail="Business Unit not found")

    result = await reconciliation_service.get_reconciliation_state(bu_id)
    return clean_nan_values(result.dict())

@router.get("/{bu_id}/facts", response_model=List[Fact])
async def get_business_unit_facts(bu_id: str):
    facts = supabase_service.get_facts(bu_id)
    for f in facts:
        if f.numeric_value is not None and math.isnan(f.numeric_value):
            f.numeric_value = None
    return facts

@router.patch("/{bu_id}/facts/{fact_id}", response_model=Fact)
async def update_fact(bu_id: str, fact_id: str, fact_in: FactUpdate):
    updated = supabase_service.update_fact(fact_id, fact_in.dict(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Fact not found")
    return updated

@router.post("/{bu_id}/resolve-conflicts")
async def resolve_conflicts(bu_id: str, resolution_data: Dict[str, List[str]]):
    """
    resolution_data: {"fact_ids": ["uuid1", "uuid2", ...]}
    """
    fact_ids = resolution_data.get("fact_ids", [])
    supabase_service.resolve_conflicts(bu_id, fact_ids)
    return {"status": "success", "message": f"Resolved {len(fact_ids)} conflicts"}

@router.post("/{bu_id}/query")
async def query_knowledge_base(bu_id: str, query_request: dict):
    query_str = query_request.get("query")
    if not query_str:
        raise HTTPException(status_code=400, detail="No query provided")

    result = await rag_service.query_with_citations(query_str, bu_id=bu_id)
    return result

@router.get("/{bu_id}/generate")
async def get_generated_im(bu_id: str):
    outputs = supabase_service.get_generated_outputs(bu_id)
    im_outputs = [o for o in outputs if o.type == "IM"]
    if im_outputs:
        # Return the most recent one
        latest_im = sorted(im_outputs, key=lambda x: str(x.created_at), reverse=True)[0]
        return {
            "message": "Found existing IM",
            "data": latest_im.content
        }
    raise HTTPException(status_code=404, detail="No generated IM found")

@router.post("/{bu_id}/generate")
async def generate_im_draft(bu_id: str, recon_result: ReconciliationResult, force_regenerate: bool = False):
    bu = supabase_service.get_business_unit(bu_id)
    if not bu:
        raise HTTPException(status_code=404, detail="Business Unit not found")

    # Check for existing IM if not forcing regeneration
    if not force_regenerate:
        outputs = supabase_service.get_generated_outputs(bu_id)
        im_outputs = [o for o in outputs if o.type == "IM"]
        if im_outputs:
            latest_im = sorted(im_outputs, key=lambda x: str(x.created_at), reverse=True)[0]
            return {
                "message": "Loaded existing IM Synthesis",
                "data": latest_im.content
            }

    im_response = await im_service.generate_im(recon_result)

    # Persist IM draft to Business Unit as GeneratedOutput
    output_in = {
        "type": "IM",
        "content": im_response.dict(),
        "status": "DRAFT"
    }
    supabase_service.create_generated_output(bu_id, output_in)

    return {
        "message": "IM Synthesis complete",
        "data": im_response.dict()
    }

@router.delete("/{bu_id}/generate")
async def delete_generated_im(bu_id: str):
    success = supabase_service.delete_generated_outputs_by_type(bu_id, "IM")
    if not success:
        raise HTTPException(status_code=404, detail="No generated IM found to delete")
    return {"message": "Generated IM deleted successfully"}

@router.post("/export")
async def export_im(request: Request, im_data: IMResponse, format: str = "docx"):
    if format.lower() == "pdf":
        # Extract base URL from request, e.g., http://localhost:8000
        base_url = f"{request.url.scheme}://{request.url.netloc}"
        # We assume the frontend is on the same host but port 5173 if on localhost
        if "localhost" in base_url:
            base_url = "http://localhost:5173/viewer"
        else:
            base_url = f"{base_url}/viewer"
        
        buffer = pdf_service.generate_im_pdf(im_data.model_dump(), base_url=base_url)
        media_type = "application/pdf"
        filename = "Information_Memorandum.pdf"
    else:
        buffer = docx_service.generate_im_docx(im_data.model_dump())
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "Information_Memorandum.docx"

    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/{bu_id}/export/drive")
async def export_im_to_drive(request: Request, bu_id: str, im_data: IMResponse, format: str = "docx"):
    bu = supabase_service.get_business_unit(bu_id)
    if not bu:
        raise HTTPException(status_code=404, detail="Business Unit not found")

    convert_to = None
    if format.lower() == "pdf":
        base_url = f"{request.url.scheme}://{request.url.netloc}"
        if "localhost" in base_url:
            base_url = "http://localhost:5173/viewer"
        else:
            base_url = f"{base_url}/viewer"
        buffer = pdf_service.generate_im_pdf(im_data.model_dump(), base_url=base_url)
        mime_type = "application/pdf"
        ext = "pdf"
    elif format.lower() == "gdoc":
        buffer = docx_service.generate_im_docx(im_data.model_dump())
        mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        convert_to = "application/vnd.google-apps.document"
        ext = "docx" # The source is docx, Google Drive converts it
    else:
        buffer = docx_service.generate_im_docx(im_data.model_dump())
        mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ext = "docx"

    buffer.seek(0)
    filename = f"IM_{bu.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"

    # 1. Get/Create BU folder structure on Drive
    deals_folder = await drive_service.get_or_create_folder("Business Units")
    bu_folder = await drive_service.get_or_create_folder(bu.name, parent_id=deals_folder)
    im_folder = await drive_service.get_or_create_folder("IMs", parent_id=bu_folder)

    drive_url = await drive_service.upload_file(
        content=buffer,
        filename=filename,
        mime_type=mime_type,
        folder_id=im_folder,
        convert_to=convert_to
    )

    # For Google Docs, wait a moment for conversion to complete and return the final URL
    if format.lower() == "gdoc":
        # Add a small delay to allow Google to complete the conversion
        await asyncio.sleep(2)
        # Re-fetch the file to get the updated Google Docs URL
        file_id = drive_url.split("/d/")[1].split("/view")[0]
        try:
            file = await asyncio.to_thread(
                lambda: drive_service.service.files().get(
                    fileId=file_id,
                    fields='webViewLink',
                    supportsAllDrives=True,
                ).execute()
            )
            drive_url = file.get('webViewLink', drive_url)
        except Exception as e:
            logger.warning(f"Could not re-fetch Google Docs URL: {e}")

    return {"drive_url": drive_url, "format": format}

@router.post("/{bu_id}/regenerate-section")
async def regenerate_section(bu_id: str, section_id: str, tone: str = "Standard"):
    bu = supabase_service.get_business_unit(bu_id)
    if not bu:
        raise HTTPException(status_code=404, detail="Business Unit not found")

    # Re-reconcile context from stored documents
    docs = bu.documents
    if not docs:
        raise HTTPException(status_code=400, detail="No documents found for this Business Unit")

    extracted_data = []
    for doc in docs:
        extracted_data.append({
            "doc_id": doc.id,
            "business_unit_id": bu_id,
            "filename": doc.name,
            "facts": doc.extraction_data,
            "docling_json": doc.docling_json,
            "type": "docling" if doc.docling_json else "unknown"
        })

    reconciliation_result = await reconciliation_service.reconcile_documents(extracted_data)
    
    # Regenerate section
    new_section = await im_service.regenerate_section(reconciliation_result, section_id, tone=tone)
    
    return clean_nan_values({"section": new_section.dict()})
