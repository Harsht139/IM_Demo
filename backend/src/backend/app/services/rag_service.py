import re
import asyncio
from typing import List, Dict, Any
from app.config import settings
from app.services.vertex_service import vertex_service
from app.services.supabase_service import supabase_service
from app.logging import get_logger

logger = get_logger(__name__)

class RAGService:
    def __init__(self):
        self._llm = None

    @property
    def llm(self):
        if self._llm is None:
            self._llm = vertex_service.get_generative_model("gemini-2.0-flash")
        return self._llm

    async def index_documents(self, extracted_data: List[Dict[str, Any]], bu_id: str = "default"):
        """
        Decomposes Docling structural JSON into atomic nodes, embeds them, and stores in Supabase.
        """
        for doc_data in extracted_data:
            doc_id = doc_data.get("filename") # Using filename as proxy for ID consistency here
            
            # Extract nodes based on type
            nodes = []
            if doc_data.get("type") == "docling":
                docling_json = doc_data.get("docling_json", {})
                nodes = self._extract_atomic_nodes(docling_json)
            elif doc_data.get("type") == "excel" and doc_data.get("structured_text"):
                # Handle Excel/CSV structured text
                lines = doc_data["structured_text"].split("\n")
                for line in lines:
                    if not line.strip() or line.startswith("---"): continue
                    # Extract address if present: [Sheet!A1] text
                    match = re.match(r"\[(.*?)\] (.*)", line)
                    if match:
                        addr, content = match.groups()
                        nodes.append({
                            "text": content,
                            "page_number": None,
                            "bbox": addr, # Storing address in bbox field for spreadsheets
                            "label": "excel_cell"
                        })
            
            if not nodes:
                logger.warning(f"No nodes extracted for indexing from: {doc_data.get('filename')}")
                continue
            
            logger.info(f"Indexing {len(nodes)} atomic nodes for {doc_data.get('filename')}")
            
            # Embed and store in chunks to avoid rate limits/timeouts
            chunk_size = 50
            for i in range(0, len(nodes), chunk_size):
                batch = nodes[i:i + chunk_size]
                
                # Generate embeddings in parallel
                embedding_tasks = [vertex_service.get_embeddings(node["text"]) for node in batch]
                embeddings = await asyncio.gather(*embedding_tasks)
                
                # Prepare for Supabase
                vector_records = []
                for node, emb in zip(batch, embeddings):
                    vector_records.append({
                        "business_unit_id": bu_id,
                        "filename": doc_data.get("filename"),
                        "content": node["text"],
                        "embedding": emb,
                        "metadata": {
                            "page_number": node["page_number"],
                            "bbox": node["bbox"],
                            "label": node["label"]
                        }
                    })
                
                # Store in Supabase (using a dedicated table 'document_chunks')
                supabase_service.client.table("document_chunks").insert(vector_records).execute()

    async def query_with_citations(self, query_str: str, bu_id: str = "default") -> Dict[str, Any]:
        """
        Custom RAG flow: 
        1. Embed Query -> 2. Vector Search (Supabase) -> 3. Generate Answer with Precise BBoxes.
        """
        query_emb = await vertex_service.get_embeddings(query_str)
        
        # Call Supabase RPC for vector similarity search
        # RPC match_document_chunks(query_embedding vector, match_threshold float, match_count int, filter jsonb)
        response = supabase_service.client.rpc(
            "match_document_chunks",
            {
                "query_embedding": query_emb,
                "match_threshold": 0.5,
                "match_count": 5,
                "filter_bu_id": bu_id
            }
        ).execute()

        nodes = response.data or []
        if not nodes:
            return {"answer": "No relevant context found in the uploaded documents.", "sources": []}

        # Build Context for LLM
        context_parts = []
        sources = []
        for i, node in enumerate(nodes):
            num = i + 1
            meta = node.get("metadata", {})
            context_parts.append(f"Source [{num}]:\n{node['content']}")
            sources.append({
                "number": num,
                "filename": node.get("filename"),
                "page_number": meta.get("page_number"),
                "coordinates": meta.get("bbox"),
                "snippet": node["content"][:200]
            })

        context_str = "\n\n".join(context_parts)
        prompt = f"""
        You are a senior Project Finance assistant. Use the provided sources to answer the query.
        Cite sources using [number] format (e.g., [1], [2]).
        Every claim MUST have a citation.

        Context:
        {context_str}

        Query: {query_str}
        Answer:
        """

        llm_response = await asyncio.to_thread(self.llm.generate_content, prompt)
        answer = llm_response.text

        return {
            "answer": answer,
            "sources": sources
        }

    def _extract_atomic_nodes(self, docling_json: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Parses Docling structural JSON to extract atomic text blocks with coordinates.
        """
        nodes = []
        
        items_to_process = []
        
        # Docling v2 uses 'texts' array
        if isinstance(docling_json.get("texts"), list):
            items_to_process.extend(docling_json["texts"])
            
        # Also check 'body' just in case
        body = docling_json.get("body")
        if isinstance(body, list):
            items_to_process.extend(body)
        elif isinstance(body, dict) and isinstance(body.get("children"), list):
            def _extract_tree(node):
                if isinstance(node, dict):
                    if node.get("text") and node.get("prov"):
                        items_to_process.append(node)
                    if isinstance(node.get("children"), list):
                        for child in node["children"]:
                            _extract_tree(child)
            _extract_tree(body)

        for item in items_to_process:
            if isinstance(item, dict) and item.get("text") and item.get("prov"):
                prov = item["prov"][0] if isinstance(item["prov"], list) and len(item["prov"]) > 0 else {}
                nodes.append({
                    "text": item["text"],
                    "page_number": prov.get("page_no"),
                    "bbox": prov.get("bbox", {}).get("l", None), # 'l' is often the layout box
                    "label": item.get("label", "text")
                })
        
        return nodes

rag_service = RAGService()
