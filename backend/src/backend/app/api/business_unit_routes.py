from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.models.schema import BusinessUnit, BusinessUnitCreate, BusinessUnitSummary, Document
from app.services.supabase_service import supabase_service
from app.services.reconciliation_service import reconciliation_service

router = APIRouter(tags=["Business Units"])

# --- Business Unit Routes ---

@router.get("/", response_model=List[BusinessUnitSummary])
async def list_business_units():
    bus = supabase_service.list_business_units()
    return [
        BusinessUnitSummary(
            id=bu.id,
            name=bu.name,
            created_at=str(bu.created_at),
            document_count=len(bu.documents),
            status="active",
        ) for bu in bus
    ]

@router.post("/", response_model=BusinessUnit)
async def create_business_unit(bu_in: BusinessUnitCreate):
    return supabase_service.create_business_unit(bu_in)

@router.get("/{bu_id}", response_model=BusinessUnit)
async def get_business_unit(bu_id: str):
    bu = supabase_service.get_business_unit(bu_id)
    if not bu:
        raise HTTPException(status_code=404, detail="Business Unit not found")
    return bu

@router.delete("/{bu_id}")
async def delete_business_unit(bu_id: str):
    if not supabase_service.delete_business_unit(bu_id):
        raise HTTPException(status_code=404, detail="Business Unit not found")
    return {"message": "Business Unit deleted"}

@router.patch("/{bu_id}", response_model=BusinessUnit)
async def update_business_unit(bu_id: str, updates: Dict[str, Any]):
    updated_bu = supabase_service.update_business_unit(bu_id, updates)
    if not updated_bu:
        raise HTTPException(status_code=404, detail="Business Unit not found")
    return updated_bu

@router.get("/stats/unified")
async def get_unified_stats():
    bus = supabase_service.list_business_units()
    all_docs = [d for bu in bus for d in bu.documents]
    all_outputs = [o for bu in bus for o in bu.generated_outputs]
    return {
        "total_projects": len(bus),
        "total_documents": len(all_docs),
        "total_sections_generated": len(all_outputs),
        "active_engagements": len([bu for bu in bus if len(bu.documents) > 0]),
    }

# --- Document Routes ---

@router.get("/{bu_id}/documents", response_model=List[Document])
async def list_documents(bu_id: str):
    bu = supabase_service.get_business_unit(bu_id)
    if not bu:
        raise HTTPException(status_code=404, detail="Business Unit not found")
    return bu.documents

@router.post("/{bu_id}/documents", response_model=Document)
async def add_document(bu_id: str, doc_in: Dict[str, Any]):
    doc = supabase_service.add_document(bu_id, doc_in)
    if not doc:
        raise HTTPException(status_code=500, detail="Failed to add document")
    return doc

@router.delete("/{bu_id}/documents/{doc_id}")
async def delete_document(bu_id: str, doc_id: str):
    # Verify the BU exists and contains this doc
    bu = supabase_service.get_business_unit(bu_id)
    if not bu:
        raise HTTPException(status_code=404, detail="Business Unit not found")
        
    # Check if doc belongs to BU
    doc_exists_in_bu = any(str(d.id) == doc_id for d in bu.documents)
    if not doc_exists_in_bu:
        raise HTTPException(status_code=404, detail="Document not found in Business Unit")
    
    # Ideally supabase_service.delete_document handles actual deletion. 
    # If it's missing, you may need a delete operation in Supabase.
    success = supabase_service.client.table("documents").delete().eq("id", doc_id).execute()
    if not success.data:
        raise HTTPException(status_code=500, detail="Failed to delete document")
    return {"message": "Document deleted"}

@router.get("/{bu_id}/full-data")
async def get_full_business_unit_data(bu_id: str):
    """Get all business unit data in one call - BU, facts, reconciliation, and existing IM"""
    try:
        # Get business unit
        bu = supabase_service.get_business_unit(bu_id)
        if not bu:
            raise HTTPException(status_code=404, detail="Business Unit not found")
        
        # Get all related data in parallel
        facts = supabase_service.get_facts(bu_id)
        reconciliation_result = await reconciliation_service.get_reconciliation_state(bu_id)
        
        # Get existing IM if any
        existing_im = None
        try:
            from app.services.im_service import im_service
            existing_im = im_service.get_existing_im(bu_id)
        except:
            existing_im = None
        
        return {
            "business_unit": bu,
            "facts": facts,
            "reconciliation": reconciliation_result,
            "existing_im": existing_im
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load business unit data: {str(e)}")

@router.get("/{bu_id}/full-data-optimized")
async def get_full_business_unit_data_optimized(bu_id: str):
    """Ultra-optimized endpoint with minimal database queries"""
    try:
        # Single optimized query approach - get everything in one go
        # This would require custom SQL joins or a more efficient service method
        bu = supabase_service.get_business_unit(bu_id)
        if not bu:
            raise HTTPException(status_code=404, detail="Business Unit not found")
        
        # For now, use parallel execution to minimize query time
        import asyncio
        tasks = [
            asyncio.create_task(lambda: supabase_service.get_facts(bu_id)),
            asyncio.create_task(lambda: reconciliation_service.get_reconciliation_state(bu_id)),
            asyncio.create_task(lambda: (lambda: im_service.get_existing_im(bu_id) if True else None))
        ]
        
        facts, reconciliation_result, existing_im = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle exceptions from individual tasks
        if isinstance(facts, Exception):
            facts = []
        if isinstance(reconciliation_result, Exception):
            reconciliation_result = {"conflicts": []}
        if isinstance(existing_im, Exception):
            existing_im = None
        
        return {
            "business_unit": bu,
            "facts": facts if not isinstance(facts, Exception) else [],
            "reconciliation": reconciliation_result if not isinstance(reconciliation_result, Exception) else {"conflicts": []},
            "existing_im": existing_im if not isinstance(existing_im, Exception) else None,
            "optimized": True,
            "query_time": "parallel"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load optimized business unit data: {str(e)}")
