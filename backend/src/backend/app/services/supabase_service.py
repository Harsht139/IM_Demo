import os
import time
from typing import List, Optional, Dict, Any
from supabase import create_client, Client
from app.models.schema import BusinessUnit, BusinessUnitCreate, Document, GeneratedOutput, Fact
from app.config import settings
from app.logging import get_logger

logger = get_logger(__name__)

class SupabaseService:
    def __init__(self):
        self.url: str = settings.SUPABASE_URL
        self.key: str = settings.SUPABASE_KEY
        self.client: Client = create_client(self.url, self.key)
        self._max_retries = 3
        self._retry_delay = 1  # seconds

    def _execute_with_retry(self, operation, *args, **kwargs):
        """Execute database operation with retry logic"""
        last_exception = None
        
        for attempt in range(self._max_retries):
            try:
                return operation(*args, **kwargs)
            except Exception as e:
                last_exception = e
                if attempt < self._max_retries - 1:
                    logger.warning(f"Supabase operation failed (attempt {attempt + 1}/{self._max_retries}): {str(e)}")
                    time.sleep(self._retry_delay * (2 ** attempt))  # Exponential backoff
                else:
                    logger.error(f"Supabase operation failed after {self._max_retries} attempts: {str(e)}")
        
        raise last_exception

    # --- Business Unit Operations ---

    def list_business_units(self) -> List[BusinessUnit]:
        def _list_operation():
            response = self.client.table("business_units").select("*, documents(*), generated_outputs(*), facts(*)").execute()
            return [BusinessUnit(**item) for item in response.data]
        
        return self._execute_with_retry(_list_operation)

    def get_business_unit(self, bu_id: str) -> Optional[BusinessUnit]:
        def _get_operation():
            response = self.client.table("business_units").select("*, documents(*), generated_outputs(*), facts(*)").eq("id", bu_id).single().execute()
            if response.data:
                return BusinessUnit(**response.data)
            return None
        
        try:
            return self._execute_with_retry(_get_operation)
        except Exception:
            return None  # Return None if all retries fail

    def create_business_unit(self, bu_in: BusinessUnitCreate) -> BusinessUnit:
        response = self.client.table("business_units").insert(bu_in.dict()).execute()
        return BusinessUnit(**response.data[0])

    def update_business_unit(self, bu_id: str, updates: Dict[str, Any]) -> Optional[BusinessUnit]:
        response = self.client.table("business_units").update(updates).eq("id", bu_id).execute()
        if response.data:
            return BusinessUnit(**response.data[0])
        return None

    def delete_business_unit(self, bu_id: str) -> bool:
        response = self.client.table("business_units").delete().eq("id", bu_id).execute()
        return len(response.data) > 0

    # --- Document Operations ---

    def add_document(self, bu_id: str, doc_in: Dict[str, Any]) -> Optional[Document]:
        # docling_json is stored as JSONB in Supabase
        doc_data = {
            "business_unit_id": bu_id,
            "name": doc_in.get("name"),
            "storage_path": doc_in.get("storage_path"),
            "extraction_data": doc_in.get("extraction_data", []),
            "reconciliation_data": doc_in.get("reconciliation_data", {}),
            "docling_json": doc_in.get("docling_json"),
            "status": doc_in.get("status", "uploaded")
        }
        response = self.client.table("documents").insert(doc_data).execute()
        if response.data:
            return Document(**response.data[0])
        return None

    def store_document_vectors(self, bu_id: str, doc_id: str, vectors: List[Dict[str, Any]]):
        """
        Stub for storing pgvector embeddings. 
        Will use 'vecs' or direct RPC call once table is ready.
        """
        logger.info(f"Storing {len(vectors)} vector chunks for doc {doc_id} in BU {bu_id}")
        # Implementation will follow in rag_service refactor
        pass

    def get_document(self, doc_id: str) -> Optional[Document]:
        response = self.client.table("documents").select("*").eq("id", doc_id).single().execute()
        if response.data:
            return Document(**response.data)
        return None

    def delete_document(self, doc_id: str) -> bool:
        response = self.client.table("documents").delete().eq("id", doc_id).execute()
        return len(response.data) > 0

    def update_document(self, doc_id: str, updates: Dict[str, Any]) -> Optional[Document]:
        response = self.client.table("documents").update(updates).eq("id", doc_id).execute()
        if response.data:
            return Document(**response.data[0])
        return None

    # --- Generated Output Operations ---

    def create_generated_output(self, bu_id: str, output_in: Dict[str, Any]) -> Optional[GeneratedOutput]:
        output_data = {**output_in, "business_unit_id": bu_id}
        response = self.client.table("generated_outputs").insert(output_data).execute()
        if response.data:
            return GeneratedOutput(**response.data[0])
        return None

    def get_generated_outputs(self, bu_id: str) -> List[GeneratedOutput]:
        response = self.client.table("generated_outputs").select("*").eq("business_unit_id", bu_id).execute()
        return [GeneratedOutput(**item) for item in response.data]

    def update_generated_output(self, output_id: str, updates: Dict[str, Any]) -> Optional[GeneratedOutput]:
        response = self.client.table("generated_outputs").update(updates).eq("id", output_id).execute()
        if response.data:
            return GeneratedOutput(**response.data[0])
        return None

    def delete_generated_outputs_by_type(self, bu_id: str, output_type: str) -> bool:
        response = self.client.table("generated_outputs").delete().eq("business_unit_id", bu_id).eq("type", output_type).execute()
        return len(response.data) >= 0

    # --- Fact Operations ---

    def add_facts(self, bu_id: str, facts: List[Dict[str, Any]]) -> List[Fact]:
        data = [{**f, "business_unit_id": bu_id} for f in facts]
        response = self.client.table("facts").insert(data).execute()
        return [Fact(**item) for item in response.data]

    def get_facts(self, bu_id: str) -> List[Fact]:
        response = self.client.table("facts").select("*").eq("business_unit_id", bu_id).execute()
        return [Fact(**item) for item in response.data]

    def update_fact(self, fact_id: str, updates: Dict[str, Any]) -> Optional[Fact]:
        response = self.client.table("facts").update(updates).eq("id", fact_id).execute()
        if response.data:
            return Fact(**response.data[0])
        return None

    def delete_facts_by_document(self, doc_id: str):
        self.client.table("facts").delete().eq("document_id", doc_id).execute()

    def delete_document_chunks(self, bu_id: str, filename: str):
        """Deletes all vector chunks associated with a specific file in a BU."""
        self.client.table("document_chunks").delete() \
            .eq("business_unit_id", bu_id) \
            .eq("filename", filename) \
            .execute()
        logger.info(f"Deleted vector chunks for {filename} in BU {bu_id}")

    def resolve_conflicts(self, bu_id: str, resolved_fact_ids: List[str]):
        """
        Marks selected fact IDs as verified.
        In a real production app, we would also verify/de-conflict other facts for the same metrics.
        """
        if not resolved_fact_ids:
            return
            
        # 1. Mark selected facts as verified
        self.client.table("facts").update({"is_verified": True}).in_("id", resolved_fact_ids).execute()
        
        # 2. Optionally: we could auto-reject others. For now, just marking verified is enough
        # to ensure they are preferred in future runs.
        logger.info(f"Resolved {len(resolved_fact_ids)} conflicts for BU {bu_id}")

supabase_service = SupabaseService()
