import asyncio
from typing import List, Dict, Any
from fastapi import UploadFile
from app.services.extraction_service import extract_file_content
from app.services.rag_service import rag_service
from app.services.storage_service import storage_service
from app.services.supabase_service import supabase_service
from app.logging import get_logger

logger = get_logger(__name__)

async def save_uploaded_files(bu_id: str, files: List[UploadFile]) -> List[str]:
    """Saves raw files to disk and mirrors to Google Drive folder."""
    from app.services.drive_service import drive_service
    from app.services.supabase_service import supabase_service
    import io

    bu = supabase_service.get_business_unit(bu_id)
    bu_name = bu.name if bu else bu_id

    # 1. Get/Create BU folder structure on Drive
    deals_folder = await drive_service.get_or_create_folder("Business Units")
    bu_folder = await drive_service.get_or_create_folder(bu_name, parent_id=deals_folder)
    source_folder = await drive_service.get_or_create_folder("Source Documents", parent_id=bu_folder)

    saved_filenames = []
    for file in files:
        if not file.filename:
            continue
        content = await file.read()
        
        # Save locally
        storage_service.save_file(bu_id, file.filename, content)
        
        # Upload to Drive
        try:
            await drive_service.upload_file(
                content=io.BytesIO(content),
                filename=file.filename,
                mime_type=file.content_type or "application/octet-stream",
                folder_id=source_folder
            )
        except Exception as e:
            logger.warning(f"Failed to sync {file.filename} to Drive: {e}")

        saved_filenames.append(file.filename)
    return saved_filenames

async def process_files(bu_id: str, filenames: List[str]) -> List[Dict[str, Any]]:
    """Runs extraction and RAG indexing on previously saved files."""
    
    async def process_single_file(filename: str):
        filepath = storage_service.get_file_path(bu_id, filename)
        if not filepath:
            return None
            
        with open(filepath, 'rb') as f:
            content = f.read()
            
        return await extract_file_content(
            filename=filename,
            content=content
        )

    tasks = [process_single_file(f) for f in filenames]
    results = await asyncio.gather(*tasks)
    extracted_data = [r for r in results if r is not None]

    # Index for RAG
    if extracted_data:
        await rag_service.index_documents(extracted_data, bu_id=bu_id)

    return extracted_data
