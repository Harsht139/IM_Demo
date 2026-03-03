import json
import math
import asyncio
import uuid
import re
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from app.config import settings
from app.services.vertex_service import vertex_service
from app.services.normalization_service import normalization_service
from app.logging import get_logger
from app.services.reconciliation.conflict_detector import ConflictDetector
from app.services.reconciliation.schema_aligner import SchemaAligner
from app.services.supabase_service import supabase_service

logger = get_logger(__name__)

class Citation(BaseModel):
    source_file: str
    context: Optional[str] = "No context provided"
    page_number: Optional[int] = None
    coordinates: Optional[Any] = None # Can be [x1, y1, x2, y2] or [[x1, y1, x2, y2], ...]

class Fact(BaseModel):
    id: Optional[str] = None
    metric: str
    value: str
    normalized_value: Optional[str] = None
    numeric_value: Optional[float] = None
    citation: Citation
    period: Optional[str] = None
    reasoning: Optional[str] = None
    document_id: Optional[str] = None
    business_unit_id: Optional[str] = None
    is_verified: bool = False
    is_recommended: bool = False

class ConflictSource(BaseModel):
    name: str
    value: str
    normalized_value: Optional[str] = None
    context: str
    period: Optional[str] = None
    isRecommended: bool = False
    reasoning: Optional[str] = None
    fact_id: Optional[str] = None
    page_number: Optional[int] = None
    coordinates: Optional[Any] = None

class Conflict(BaseModel):
    id: str
    metric: str
    status: str = "pending"
    sources: List[ConflictSource]

class ReconciliationResult(BaseModel):
    facts: List[Fact]
    conflicts: List[Conflict]
    metadata: Optional[Dict] = {}

# --- Response Schemas for Structured Output ---

class DealMetadataSchema(BaseModel):
    borrower: str = Field(description="Name of the company seeking financing")
    project_type: str = Field(description="Solar, Wind, Thermal, Road, etc.")
    capacity: str = Field(description="e.g., 400 MW, 100 KM")
    location: str = Field(description="Main project site/state")
    sector: str = Field(description="e.g., Renewables, Infrastructure, Power")
    counterparty: str = Field(description="e.g., DISCOM, NHAI, RSEB")

class ExtractedFactSchema(BaseModel):
    metric: str
    value: str
    context: str
    period: Optional[str] = Field(description="The year or period for this value, e.g., FY24, 2023, Q3")
    quote: Optional[str] = Field(description="The exact text snippet from the document justifying this value")
    reasoning: Optional[str] = None
    page_number: Optional[int] = None
    coordinates: Optional[List[float]] = None

class ExtractionResponseSchema(BaseModel):
    facts: List[ExtractedFactSchema]

# We no longer use a hardcoded METRIC_DEFINITIONS list. 
# Metrics are discovered dynamically based on the uploaded documents.

# Tier 1: Project Finance seed schema — always extracted as baseline.
# These are universal PF metrics that every deal should capture.
PF_SEED_SCHEMA = [
    "Total Project Cost",
    "Total Debt / Loan Amount",
    "Equity Contribution",
    "Debt-Service Coverage Ratio (DSCR)",
    "Internal Rate of Return (IRR / Equity IRR)",
    "Revenue / Tariff Income",
    "EBITDA",
    "Interest Rate / Coupon",
    "Loan Tenor",
    "Moratorium Period",
    "Debt to Equity Ratio",
    "Security Package / Collateral",
    "Project Capacity (MW / KM / Units)",
    "PPA / Offtake Tariff Rate",
]

def is_na_value(val: Any) -> bool:
    """Detects if a value is effectively 'Not Available' or empty."""
    if val is None:
        return True
    v = str(val).lower().strip()
    return v in ["n/a", "na", "not found", "not specified", "none", "unknown", "null", ""]

class ReconciliationService:
    def __init__(self):
        self._model = None
        self.conflict_detector = ConflictDetector()
        self.schema_aligner = SchemaAligner()

    async def get_reconciliation_state(self, bu_id: str) -> ReconciliationResult:
        """
        Fetch the current reconciliation state (facts and conflicts) for a business unit
        without triggering a full re-process. Maps flat DB facts to in-memory schema.
        """
        raw_existing = supabase_service.get_facts(bu_id)
        bu = supabase_service.get_business_unit(bu_id)
        doc_map = {d.id: d.name for d in bu.documents} if bu and bu.documents else {}

        existing_facts: List[Fact] = []
        for f in raw_existing:
            citation = getattr(f, "citation", None)
            if not citation:
                doc_id = getattr(f, "document_id", "Unknown")
                doc_name = doc_map.get(doc_id, getattr(f, "source_file", doc_id))
                citation = Citation(
                    source_file=doc_name,
                    context=getattr(f, "context", "No context provided"),
                    page_number=getattr(f, "page_number", None),
                    coordinates=getattr(f, "coordinates", None),
                )

            num_val = f.numeric_value
            if num_val is not None and math.isnan(num_val):
                num_val = None

            existing_facts.append(
                Fact(
                    id=getattr(f, "id", None),
                    metric=f.metric,
                    value=f.value,
                    normalized_value=f.normalized_value,
                    numeric_value=num_val,
                    citation=citation,
                    period=getattr(f, "period", None),
                    reasoning=f.reasoning,
                    document_id=f.document_id,
                    business_unit_id=f.business_unit_id,
                    is_verified=getattr(f, "is_verified", False),
                    is_recommended=getattr(f, "is_recommended", False),
                )
            )
        
        # Filter NA values
        existing_facts = [f for f in existing_facts if not is_na_value(f.value)]

        conflicts = await self.conflict_detector.detect_conflicts(existing_facts)
        deal_metadata = {f: "Not Specified" for f in DealMetadataSchema.__fields__}
        deal_metadata["bu_id"] = bu_id
        # Look for deal_id in facts if not explicitly available elsewhere
        deal_id = next((f.document_id for f in existing_facts if f.document_id), None)
        deal_metadata["deal_id"] = deal_id

        return ReconciliationResult(
            facts=existing_facts,
            conflicts=conflicts,
            metadata=deal_metadata,
        )

    @property
    def model(self):
        if self._model is None:
            self._model = vertex_service.get_generative_model("gemini-2.0-flash")
        return self._model

    async def _discover_deal_metadata(self, extracted_data: List[Dict]) -> Dict:
        """
        Dynamically extracts high-level deal profiling information from documents.
        """
        combined_samples = []
        for doc in extracted_data:
            filename = doc.get("filename", "Unknown")
            content_type = doc.get("type", "unknown")
            sample = ""
            if content_type == "docling":
                sample = doc.get("structured_text", "")[:5000]
            elif not sample and doc.get("docling_json"):
                # Fallback for already processed docs: try to get some text from docling_json body
                body = doc.get("docling_json", {}).get("body", [])
                sample = " ".join([item.get("text", "") for item in body[:20]])[:5000]
            elif content_type == "excel":
                sample = f"Excel Columns: {doc.get('columns')}\nData Preview: {json.dumps(doc.get('preview_rows'))}"
            elif content_type == "text":
                sample = doc.get("raw_text", "")[:5000]
            else:
                sample = str(doc.get("preview", ""))[:5000] or str(doc.get("structured_text", ""))[:5000]
            
            if sample:
                combined_samples.append(f"--- Doc: {filename} ---\n{sample}")

        prompt = f"""
        Analyze these document previews and extract basic deal metadata.
        Look specifically for:
        - Borrower: The company or entity seeking financing (often mentioned as "borrower", "company", "applicant", "project company", "SPV")
        - Project Type: Solar, Wind, Thermal, Road, Infrastructure, etc.
        - Capacity: Project size in MW, KM, Units, etc.
        - Location: State, city, or site location
        - Sector: Industry sector like Renewables, Infrastructure, Power, etc.
        
        Document Previews:
        {"\n\n".join(combined_samples)}
        """

        try:
            # Use structured output
            structured_model = vertex_service.get_generative_model(
                "gemini-2.0-flash", 
                response_schema=DealMetadataSchema
            )
            response = await asyncio.to_thread(structured_model.generate_content, prompt)
            
            response_text = response.text
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            response_text = response_text.strip()
            start = response_text.find('{')
            end = response_text.rfind('}')
            if start != -1 and end != -1:
                response_text = response_text[start:end+1]
                
            return json.loads(response_text)
        except Exception as e:
            logger.error(f"Error discovering deal metadata: {e}")
            return {f: "Not Specified" for f in DealMetadataSchema.__fields__}

    async def _discover_schema(self, extracted_data: List[Dict]) -> List[str]:
        """
        Tiered schema discovery:
        - Tier 1 (Seed): Always include PF_SEED_SCHEMA as baseline.
        - Tier 2 (Dynamic): LLM discovers additional deal-specific metrics from documents.
        - Fallback: If LLM fails, return seed schema alone (never an empty list).
        """
        combined_samples = []
        for doc in extracted_data:
            content_type = doc.get("type", "unknown")
            sample = ""
            if content_type == "docling":
                sample = doc.get("structured_text", "")[:2000]
            elif not sample and doc.get("docling_json"):
                # Fallback for already processed docs: try to get some text from docling_json body
                body = doc.get("docling_json", {}).get("body", [])
                sample = " ".join([item.get("text", "") for item in body[:10]])[:2000]
            elif content_type == "excel":
                sample = f"Excel Columns: {doc.get('columns')}\nData Preview: {json.dumps(doc.get('preview_rows'))}"
            elif content_type == "text":
                sample = doc.get("raw_text", "")[:2000]
            
            if sample:
                combined_samples.append(f"--- Document: {doc.get('filename')} ---\n{sample}")

        if not combined_samples:
            logger.info("Schema discovery: No document text found. Returning seed schema.")
            return PF_SEED_SCHEMA

        prompt = f"""
        Analyze these document excerpts and identify the top 10-15 most critical financial metrics 
        that a credit analyst should track for this specific deal. 
        Focus on metrics NOT already in this list: {', '.join(PF_SEED_SCHEMA)}.
        
        Excerpts:
        {"\n\n".join(combined_samples)}
        
        Return ONLY a JSON list of strings representing the metric names.
        """

        try:
            response = await asyncio.to_thread(self.model.generate_content, prompt)
            response_text = response.text
            
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
                
            response_text = response_text.strip()
            start = response_text.find('[')
            end = response_text.rfind(']')
            if start != -1 and end != -1:
                response_text = response_text[start:end+1]
            
            dynamic_metrics = json.loads(response_text)
            if not isinstance(dynamic_metrics, list):
                dynamic_metrics = []

            seed_lower = {m.lower() for m in PF_SEED_SCHEMA}
            unique_dynamic = [m for m in dynamic_metrics if m.lower() not in seed_lower]
            merged_schema = PF_SEED_SCHEMA + unique_dynamic

            logger.info(f"Schema discovery: {len(PF_SEED_SCHEMA)} seed + {len(unique_dynamic)} dynamic = {len(merged_schema)} total.")
            return merged_schema

        except Exception as e:
            logger.warning(f"Schema discovery failed ({e}). Falling back to seed schema.")
            return PF_SEED_SCHEMA


    async def reconcile_documents(self, extracted_data: List[Dict]) -> ReconciliationResult:
        """
        Takes raw extracted data from multiple files, extracts key facts via LLM,
        normalizes them, and identifies conflicts.
        """
        # 1. Discovery
        discovered_schema = await self._discover_schema(extracted_data)
        deal_metadata = await self._discover_deal_metadata(extracted_data)

        # 2. Load existing persisted facts for this business unit
        # Note: We assume bu_id is available in the extracted_data context or passed down
        # For PoC, we'll use the bu_id from one of the docs if available, or just use what's passed in
        bu_id = extracted_data[0].get("business_unit_id") if extracted_data else None
        
        existing_facts = []
        if bu_id:
            raw_existing = supabase_service.get_facts(bu_id)
            for f in raw_existing:
                # Map from flat DB schema to nested in-memory schema
                citation = Citation(
                    source_file=getattr(f, 'source_file', getattr(f, 'document_id', 'Unknown')),
                    context=getattr(f, 'context', 'No context provided'),
                    page_number=getattr(f, 'page_number', None),
                    coordinates=getattr(f, 'coordinates', None)
                )
                num_val = f.numeric_value
                if num_val is not None and math.isnan(num_val):
                    num_val = None
                    
                existing_facts.append(Fact(
                    id=f.id,
                    metric=f.metric,
                    value=f.value,
                    normalized_value=f.normalized_value,
                    numeric_value=num_val,
                    citation=citation,
                    period=getattr(f, "period", None),
                    reasoning=f.reasoning,
                    document_id=f.document_id,
                    business_unit_id=f.business_unit_id,
                    is_verified=getattr(f, 'is_verified', False),
                    is_recommended=getattr(f, 'is_recommended', False)
                ))
            logger.info(f"Loaded {len(existing_facts)} existing facts for BU {bu_id}")

        all_facts: List[Fact] = existing_facts
        
        # Identify which documents in the request don't have persisted facts yet
        persisted_doc_ids = {f.document_id for f in existing_facts}
        
        extraction_tasks = []
        for doc in extracted_data:
            doc_id = doc.get("doc_id")
            if doc_id and doc_id in persisted_doc_ids:
                continue # Already have facts for this doc
                
            if doc.get("facts"):
                # Use pre-extracted facts (e.g., from section regeneration)
                for f_data in doc["facts"]:
                    # ... mapping logic ...
                    citation_data = f_data.get("citation", {})
                    # Ensure we have a document_id for persistence
                    f_data["document_id"] = doc_id or f_data.get("document_id")
                    
                    if isinstance(citation_data, dict):
                        citation = Citation(**citation_data)
                    else:
                        citation = citation_data
                        
                    all_facts.append(Fact(
                        metric=f_data.get("metric", "Unknown"),
                        value=f_data.get("value", ""),
                        normalized_value=f_data.get("normalized_value"),
                        numeric_value=f_data.get("numeric_value"),
                        citation=citation,
                        period=f_data.get("period"),
                        reasoning=f_data.get("reasoning"),
                        document_id=doc_id, # Link to doc
                        business_unit_id=bu_id
                    ))
            else:
                # LLM Extraction needed for new/unprocessed documents
                extraction_tasks.append(self._extract_facts_from_doc(doc, discovered_schema, bu_id=bu_id))

        if extraction_tasks:
            docs_facts = await asyncio.gather(*extraction_tasks)
            new_facts = []
            for df in docs_facts:
                new_facts.extend(df)
            
            # 3. Normalize new facts
            normalization_tasks = [self._normalize_single_fact(f) for f in new_facts]
            normalized_new_facts = await asyncio.gather(*normalization_tasks)
            
            # 4. Save new facts to DB
            if bu_id and normalized_new_facts:
                db_ready_facts = []
                for f in normalized_new_facts:
                    f_dict = f.dict()
                    # Flatten citation for DB schema if needed, but our schema has columns
                    # We'll map Citation object back to columns
                    flat_f = {
                        "document_id": f.document_id,
                        "metric": f.metric,
                        "value": f.value,
                        "normalized_value": f.normalized_value,
                        "numeric_value": f.numeric_value,
                        "context": f.citation.context,
                        "period": f.period,
                        "page_number": f.citation.page_number,
                        "coordinates": f.citation.coordinates,
                        "reasoning": f.reasoning,
                        "is_recommended": f.is_recommended
                    }
                    db_ready_facts.append(flat_f)
                
                persisted_new_facts = supabase_service.add_facts(bu_id, db_ready_facts)
                logger.info(f"Persisted {len(persisted_new_facts)} new facts for BU {bu_id}")
                
                # Replace the unpersisted facts with persisted ones (to get IDs)
                all_facts.extend(persisted_new_facts)
            else:
                all_facts.extend(normalized_new_facts)

        # 4.5 Filter out NA values from all_facts
        all_facts = [f for f in all_facts if not is_na_value(f.value)]
        
        # 5. Semantic Alignment (via module)
        all_facts = self.schema_aligner.align_schema(all_facts, discovered_schema)
        
        # 6. Detect conflicts (via module with truth heuristics)
        conflicts = await self.conflict_detector.detect_conflicts(all_facts)
        
        # Enhanced metadata extraction with fallbacks
        deal_metadata = {f: "Not Specified" for f in DealMetadataSchema.__fields__}
        
        # First try AI discovery
        try:
            discovered_metadata = await self._discover_deal_metadata(extracted_data)
            deal_metadata.update(discovered_metadata)
        except Exception as e:
            logger.warning(f"AI metadata discovery failed: {e}")
        
        # Fallback: Extract borrower from existing facts if still "Not Specified"
        if deal_metadata.get("borrower") == "Not Specified" and all_facts:
            borrower_fact = next((f for f in all_facts if f.metric.lower() in ["borrower", "company", "applicant", "project company", "spv"]), None)
            if borrower_fact:
                deal_metadata["borrower"] = borrower_fact.value
        
        deal_metadata["bu_id"] = bu_id
        # Look for deal_id in facts if not explicitly available elsewhere
        deal_id = next((f.document_id for f in all_facts if f.document_id), None)
        deal_metadata["deal_id"] = deal_id

        # Final safety check: scrub NaN values from all facts before serialization
        for f in all_facts:
            if f.numeric_value is not None and math.isnan(f.numeric_value):
                f.numeric_value = None
                
        # 7. Map system recommendations back to facts and persist
        facts_to_update = []
        for conflict in conflicts:
            for source in conflict.sources:
                if source.isRecommended and source.fact_id:
                    # Find fact in memory
                    for f in all_facts:
                        if getattr(f, 'id', None) == source.fact_id:
                            f.is_recommended = True
                            facts_to_update.append({"id": f.id, "is_recommended": True})
                            break
                            
        if facts_to_update:
            # Note: We'd ideally have a bulk update in supabase_service,
            # but for now we iterate (or assume simple update loop)
            # This ensures the DB state matches the system's choice immediately.
            for update in facts_to_update:
                supabase_service.update_fact(update["id"], {"is_recommended": True})

        return ReconciliationResult(facts=all_facts, conflicts=conflicts, metadata=deal_metadata)


    async def _normalize_single_fact(self, fact: Fact) -> Fact:
        norm = await normalization_service.normalize_fact(fact.metric, fact.value)
        fact.normalized_value = norm.standard_value
        
        num_val = norm.numeric_value
        if num_val is not None and math.isnan(num_val):
            num_val = None
        fact.numeric_value = num_val
        
        fact.period = norm.period or fact.period
        fact.metric = norm.label or fact.metric
        return fact

    async def _extract_facts_from_doc(self, doc: Dict, discovered_schema: List[str], bu_id: str = None) -> List[Fact]:
        filename = doc.get("filename", "Unknown")
        doc_id = doc.get("doc_id")
        text_content = doc.get("structured_text", "") or doc.get("raw_text", "")
        docling_json = doc.get("docling_json")

        if not text_content:
            return []

        if len(text_content) > 150000:
            logger.warning(f"Text content for {filename} truncated from {len(text_content)} to 150000 characters.")
        
        prompt = f"""
        Extract the following metrics from the document: {', '.join(discovered_schema)}. 
        
        CRITICAL INSTRUCTIONS FOR CITATIONS:
        1. Quote: For every fact, you MUST provide a 'quote'. This MUST be a verbatim snippet of at least 15-20 words from the document that contains the value. 
           - Examples: "The total debt sanctioned for the project is INR 450 Crores as per the term sheet..."
           - DO NOT provide just the value (e.g., "450"). We need the surrounding context to find the bounding box.
           - DO NOT say "N/A" or "Not Found" in the quote field if you found a value.
        2. Reasoning: Explain WHY you picked this value, especially if there are multiple similar numbers.
        3. Period: Identify the specific year or period (FY24, 2023, Q3) associated with the value.
        
        IMPORTANT FOR EXCEL FILES:
        If the document is an Excel file, the text is formatted as `[SheetName!CellAddress] Key: Value`.
        You MUST return the `SheetName!CellAddress` portion in the 'context' field for every fact.
        Example: If you see `[Inputs!B12] Total Project Cost: 500M`, return context: "Inputs!B12".
        
        CRITICAL: YOU MUST RETURN ONLY A VALID JSON OBJECT MATCHING THE ExtractionResponseSchema.
        DO NOT INCLUDE ANY CONVERSATIONAL TEXT, PREAMBLE, OR MARKDOWN. ONLY THE RAW JSON OBJECT.
        
        Document Name: {filename}
        Document Content:
        {text_content[:150000]}
        """

        try:
            structured_model = vertex_service.get_generative_model(
                "gemini-2.0-flash", 
                response_schema=ExtractionResponseSchema
            )
            response = await asyncio.to_thread(structured_model.generate_content, prompt)
            
            response_text = response.text
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            response_text = response_text.strip()
            start = response_text.find('{')
            end = response_text.rfind('}')
            if start != -1 and end != -1:
                response_text = response_text[start:end+1]

            try:
                raw_response = json.loads(response_text)
                
                if not isinstance(raw_response, dict):
                     logger.warning(f"Parsed extraction data is not a dictionary for {filename}")
                     raw_response = {}
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON for {filename}: {e}. Returning empty facts.")
                raw_response = {}
                
            raw_facts = raw_response.get("facts", [])
            if not isinstance(raw_facts, list):
                raw_facts = []
            
            facts = []
            for rf in raw_facts:
                if not isinstance(rf, dict) or not rf.get("metric"): continue
                
                # Attempt to find pinpoint coordinates from Docling JSON if available
                coords = rf.get("coordinates")
                page = rf.get("page_number")
                
                if not coords and docling_json and rf.get("quote"):
                    found_pin = self._find_pinpoint_coordinates(rf["quote"], docling_json)
                    if found_pin:
                        coords = found_pin.get("bboxes") or found_pin.get("bbox")
                        page = found_pin.get("page_number")

                facts.append(Fact(
                    metric=rf["metric"],
                    value=str(rf["value"]) if rf.get("value") is not None else "Not Found",
                    citation=Citation(
                        source_file=filename, 
                        context=rf.get("context", "No context found"),
                        page_number=page,
                        coordinates=coords
                    ),
                    period=rf.get("period"),
                    reasoning=rf.get("reasoning"),
                    document_id=doc_id,
                    business_unit_id=bu_id
                ))
            
            # Filter out NA facts early
            facts = [f for f in facts if not is_na_value(f.value)]
            
            return facts

        except Exception as e:
            logger.error(f"Error extracting facts from {filename}: {e}")
            return []

    def _find_pinpoint_coordinates(self, quote: str, docling_json: Dict) -> Optional[Dict]:
        """
        Heuristic search for a quote within Docling's structural JSON to get its bboxes.
        Updated to support multi-block highlights if a quote spans multiple elements.
        """
        # Normalize quote for matching
        quote_clean = re.sub(r'[^\w\s]', ' ', quote.lower()).strip()
        quote_words = [w for w in quote_clean.split() if len(w) > 1] # Include short words like 2.8, 3.1
        if not quote_words:
            return None
        
        quote_word_set = set(quote_words)
        quote_len = len(quote_clean)

        # 1. Gather all elements
        items_to_process = []
        if isinstance(docling_json.get("texts"), list):
            for t in docling_json["texts"]:
                if isinstance(t, dict) and t.get("text") and t.get("prov"):
                    items_to_process.append((t, 1.2))

        def _get_all_elements(data):
            elements = []
            if isinstance(data, list):
                for item in data:
                    elements.extend(_get_all_elements(item))
            elif isinstance(data, dict):
                if data.get("text") and data.get("prov"):
                    elements.append((data, 1.0))
                if "children" in data:
                    elements.extend(_get_all_elements(data["children"]))
            return elements

        if isinstance(docling_json.get("body"), list):
            items_to_process.extend(_get_all_elements(docling_json["body"]))

        # 2. Strategy A: Find best single-element match (existing behavior)
        best_match_item = None
        best_match_score = 0.0
        min_bbox_area = float('inf')

        for item, weight in items_to_process:
            text = item.get("text", "").lower()
            if not text: continue
            text_clean = re.sub(r'[^\w\s]', ' ', text).strip()
            text_word_set = set(text_clean.split())
            if not text_word_set: continue

            intersect = quote_word_set.intersection(text_word_set)
            overlap_score = len(intersect) / max(len(quote_word_set), 1)
            text_len = len(text_clean)
            density_score = min(quote_len, text_len) / max(quote_len, text_len, 1)
            current_score = (overlap_score * 0.7 + density_score * 0.3) * weight

            prov_list = item.get("prov", [])
            if not prov_list: continue
            bb = prov_list[0].get("bbox", {})
            area = abs(bb.get("r", 0) - bb.get("l", 0)) * abs(bb.get("b", 0) - bb.get("t", 0))

            if area > 250000 and overlap_score < 1.0: continue

            if current_score > best_match_score:
                best_match_score = current_score
                best_match_item = item
                min_bbox_area = area
            elif abs(current_score - best_match_score) < 0.05:
                # Tie-breaker: prefer smaller box (usually more precise)
                if area < min_bbox_area:
                    best_match_item = item
                    min_bbox_area = area

        # 2.5 Strategy A2: High-precision match for specific numbers (e.g. "3.1x")
        # If the quote is short but contains the value, look for exact text match
        if best_match_score < 0.6:
            for item, weight in items_to_process:
                text = item.get("text", "").lower()
                if quote.lower() in text or (len(quote) > 3 and quote.lower()[:10] in text):
                    best_match_item = item
                    best_match_score = 0.9
                    break

        # 3. Strategy B: If single match doesn't cover all words, try a multi-block span
        matching_items = []
        best_overlap = 0.0
        if best_match_item:
            text = best_match_item.get("text", "").lower()
            text_clean = re.sub(r'[^\w\s]', ' ', text).strip()
            text_word_set = set([w for w in text_clean.split() if len(w) > 2])
            best_overlap = len(quote_word_set.intersection(text_word_set)) / max(len(quote_word_set), 1)

        if best_overlap < 0.95:
            # Look for all items that contain at least some words from the quote
            # and are likely on the same page
            target_page = 1
            if best_match_item:
                target_page = best_match_item.get("prov", [{}])[0].get("page_no", 1)
            
            # Simple heuristic: filter items that share unique words with the quote
            for item, weight in items_to_process:
                itp = item.get("prov", [{}])[0]
                if itp.get("page_no") != target_page: continue
                
                text = item.get("text", "").lower()
                text_clean = re.sub(r'[^\w\s]', ' ', text).strip()
                text_word_set = set(text_clean.split())
                
                intersect = quote_word_set.intersection(text_word_set)
                # If the element contains any meaningful words from the quote, include it
                if len(intersect) >= 1:
                    matching_items.append(item)
            
            # If we found multiple items, verify if they collectively cover the quote
            if len(matching_items) > 1:
                combined_text = " ".join([m.get("text", "").lower() for m in matching_items])
                # Check fuzzy overlap
                combined_words = set(re.sub(r'[^\w\s]', ' ', combined_text).split())
                overlap = len(quote_word_set.intersection(combined_words)) / max(len(quote_word_set), 1)
                
                if overlap > best_match_score:
                    # Use the multi-block collection
                    best_match_item = None # Signal to use matching_items
        else:
            matching_items = [best_match_item]

        if matching_items:
            final_items = matching_items
        elif best_match_item and best_match_score >= 0.4:
            final_items = [best_match_item]
        else:
            return None

        page_no = final_items[0].get("prov", [{}])[0].get("page_no", 1)
        
        pages = docling_json.get("pages", {})
        p_obj = {}
        if isinstance(pages, dict):
            p_obj = pages.get(str(page_no)) or next((p for p in pages.values() if p.get("page_no") == page_no), {})
        elif isinstance(pages, list):
            p_obj = next((p for p in pages if p.get("page_no") == page_no), {})
        
        size = p_obj.get("size", {})
        page_w, page_h = float(size.get("width", 612.0)), float(size.get("height", 792.0))
        if page_w == 0: page_w = 612.0
        if page_h == 0: page_h = 792.0

        bboxes = []
        for item in final_items:
            prov = item.get("prov", [{}])[0]
            bbox = prov.get("bbox", {})
            l, t, r, b = bbox.get("l", 0), bbox.get("t", 0), bbox.get("r", 0), bbox.get("b", 0)
            
            x1, y1 = l / page_w, (page_h - t) / page_h
            x2, y2 = r / page_w, (page_h - b) / page_h
            
            bboxes.append([
                round(max(0, min(1, x1)), 4),
                round(max(0, min(1, min(y1, y2))), 4),
                round(max(0, min(1, x2)), 4),
                round(max(0, min(1, max(y1, y2))), 4)
            ])

        return {
            "bboxes": bboxes,
            "page_number": page_no
        }



reconciliation_service = ReconciliationService()
