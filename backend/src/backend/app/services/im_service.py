import os
import json
import asyncio
import re
from typing import List, Dict, Union, Optional, Any
from pydantic import BaseModel, field_validator, model_validator
from app.services.vertex_service import vertex_service
from app.services.reconciliation_service import ReconciliationResult
from app.templates.im_templates import IM_TEMPLATE
from app.logging import get_logger

logger = get_logger(__name__)

# External Prompt Paths
PROMPT_BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts", "im_synthesis")
GLOBAL_CONFIG_PATH = os.path.join(PROMPT_BASE_DIR, "global_config.json")
SECTIONS_DIR = os.path.join(PROMPT_BASE_DIR, "sections")

class IMSection(BaseModel):
    id: Union[str, int]
    title: str
    content: str
    section_sources: Optional[List[int]] = None

    @field_validator('id', mode='before')
    @classmethod
    def coerce_id_to_str(cls, v):
        return str(v)

class IMResponse(BaseModel):
    sections: List[IMSection]
    sources: Optional[List[Dict]] = None
    project_name: Optional[str] = None
    borrower: Optional[str] = None
    date: Optional[str] = None
    bu_id: Optional[str] = None
    business_unit_id: Optional[str] = None # Added for frontend compatibility
    deal_id: Optional[str] = None
    @model_validator(mode='before')
    @classmethod
    def sync_ids(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get('bu_id') and data.get('business_unit_id'):
                data['bu_id'] = data['business_unit_id']
            if not data.get('deal_id') and data.get('dealId'):
                data['deal_id'] = data['dealId']
        return data

class IMService:
    def __init__(self):
        self._model = None

    @property
    def model(self):
        if self._model is None:
            self._model = vertex_service.get_generative_model("gemini-2.0-flash")
        return self._model

    def _load_global_config(self) -> Dict:
        try:
            with open(GLOBAL_CONFIG_PATH, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load global prompt config: {e}")
            return {}

    def _load_section_config(self, section_id: str) -> Optional[Dict]:
        try:
            # Match by ID in the filename (e.g., 01_trans_overview.json)
            for filename in os.listdir(SECTIONS_DIR):
                if section_id in filename and filename.endswith(".json"):
                    with open(os.path.join(SECTIONS_DIR, filename), "r") as f:
                        return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load prompt config for section {section_id}: {e}")
        return None

    async def generate_im(self, recon_result: ReconciliationResult, tone: str = "Standard") -> IMResponse:
        """
        Synthesizes a structured Information Memorandum draft using parallel, template-based generation.
        """
        winning_facts = self._select_truth_facts(recon_result.facts)
        
        # We will collect all generated sections here
        generated_sections: List[IMSection] = []
        all_sources_dict: Dict[int, Dict] = {} # Map global citation index to source
        
        # To maintain global, sequential citation numbers across parallel sections,
        # we assign global IDs to the facts used in the sections.
        global_fact_usage: List[Any] = []
        
        async def _generate_section(template: Dict[str, Any]) -> Optional[Dict]:
            section_facts = self._get_facts_for_section(template, winning_facts)
            
            # If a section template relies purely on metadata or we want it anyway, we can proceed.
            # For now, we generate even if facts are sparse, as the LLM will use metadata or indicate missing info.
            prompt = self._get_synthesis_prompt(
                facts=section_facts, 
                metadata=recon_result.metadata, 
                section_id=template["id"], 
                tone=tone,
                template_config=template
            )
            
            try:
                response = await asyncio.to_thread(self.model.generate_content, prompt)
                response_text = response.text
                
                # Clean JSON
                if "```json" in response_text:
                    response_text = response_text.split("```json")[1].split("```")[0].strip()
                elif "```" in response_text:
                    response_text = response_text.split("```")[1].split("```")[0].strip()
                
                response_text = response_text.strip()
                start = response_text.find('{')
                end = response_text.rfind('}')
                # Pre-clean the string to handle rogue control characters
                # Remove common control characters that break JSON parsing
                # Remove null bytes, backspace, vertical tab, form feed, etc.
                response_text = re.sub(r'[\x00-\x08\x0b-\x1f\x7f-\x9f]', '', response_text)
                # Normalize whitespace
                response_text = re.sub(r'\s+', ' ', response_text).strip()
                
                try:
                    data = json.loads(response_text)
                except Exception as json_err:
                    # Defensive cleaning for rogue backslashes and internal newlines
                    # 1. Escape lone backslashes that aren't starting a valid escape sequence
                    # Valid: \", \\, \/, \b, \f, \n, \r, \t, \u
                    cleaned = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', response_text)
                    # 2. Clean newlines that break strings
                    cleaned = re.sub(r'\n(?!\s*["}\]])', r' ', cleaned)
                    try:
                        data = json.loads(cleaned)
                    except:
                        raise json_err
                section_data = data.get("section", data)
                
                if not section_data.get("id"):
                    section_data["id"] = template["id"]
                if not section_data.get("title"):
                    section_data["title"] = template["title"]
                
                # Cleanup title: Strip "Section 0XX: " if present
                if section_data.get("title"):
                    section_data["title"] = re.sub(r'^Section \d+:\s*', '', section_data["title"])
                    
                return {
                    "section_data": section_data,
                    "used_facts": section_facts
                }
            except Exception as e:
                logger.error(f"Error generating section {template['id']}: {e}")
                return {
                    "section_data": {
                        "id": template["id"],
                        "title": template["title"],
                        "content": "Synthesis failed due to a processing error."
                    },
                    "used_facts": []
                }

        # 1. Generate all sections in parallel
        tasks = [_generate_section(tmpl) for tmpl in IM_TEMPLATE]
        results = await asyncio.gather(*tasks)
        
        # 2. Process results and build global sources list to ensure unique, sequential citations
        sections_data = []
        for res in results:
            if not res: continue
            sec_data = res["section_data"]
            used_facts = res["used_facts"]
            
            # We must remap the section's local citations [1], [2] to global citations
            # local_to_global_map = {1: 5, 2: 6}
            local_to_global_map = {}
            for i, fact in enumerate(used_facts):
                local_idx = i + 1
                # Does this fact already have a global ID?
                if fact not in global_fact_usage:
                    global_fact_usage.append(fact)
                global_idx = global_fact_usage.index(fact) + 1
                local_to_global_map[local_idx] = global_idx
            
            # Record which global citations belong to this section
            section_source_indices = []
            
            # Now, replace [1] with [global_idx] in the content
            content = sec_data.get("content", "")
            if content:
                # We need to replace descending to avoid overlapping (e.g., replacing 1 turning 10 into 50)
                for local_idx in sorted(local_to_global_map.keys(), reverse=True):
                    global_idx = local_to_global_map[local_idx]
                    section_source_indices.append(global_idx)
                    
                    # More robust pattern that handles [local_idx], [local_idx | Source], (local_idx) and standalone local_idx
                    pattern = rf'[\[\(]{local_idx}(?:\s*[|:]\s*[^\]\)]+)?[\]\)]|(?<![₹\d.,\w\[])\b{local_idx}\b(?![\d\]\w]|[,.]\d|%)'
                    
                    def _safe_replace(match):
                        matched_text = match.group(0)
                        # If it's a bracketed citation like [1] or [1 | Source]
                        if (matched_text.startswith('[') and matched_text.endswith(']')) or \
                           (matched_text.startswith('(') and matched_text.endswith(')')):
                            # Preserve descriptive info if present
                            brackets = ('[', ']') if matched_text.startswith('[') else ('(', ')')
                            inner = matched_text[1:-1]
                            parts = re.split(r'[|:]', inner, 1)
                            extra_info = f" | {parts[1].strip()}" if len(parts) > 1 else ""
                            return f"{brackets[0]}{global_idx}{extra_info}{brackets[1]}"
                        
                        start_idx = match.start()
                        if start_idx > 0 and content[start_idx-1] not in [' ', '(', '[']:
                            return f' [{global_idx}]'
                        return f'[{global_idx}]'
                        
                    content = re.sub(pattern, _safe_replace, content)
                
                # Fix multiple brackets: [1][2] -> [1, 2]
                content = re.sub(r'\]\s*\[', ', ', content)
                content = content.replace('  ', ' ')
                sec_data["content"] = content
                
            sec_data["section_sources"] = list(set(section_source_indices))
            sections_data.append(sec_data)
            
        # 3. Build the final sources array deterministically
        sources = []
        for i, fact in enumerate(global_fact_usage):
            citation = getattr(fact, 'citation', None)
            if citation:
                source_file = getattr(citation, 'source_file', None)
                page_number = getattr(citation, 'page_number', None)
                coordinates = getattr(citation, 'coordinates', None)
                context = getattr(citation, 'context', None)
            else:
                source_file = getattr(fact, 'source_file', getattr(fact, 'document_id', None))
                page_number = getattr(fact, 'page_number', None)
                coordinates = getattr(fact, 'coordinates', None)
                context = getattr(fact, 'context', None)

            if not context:
                context = getattr(citation, 'context', getattr(fact, 'context', str(fact.value)[:150]))

            sources.append({
                "number": i + 1,
                "label": fact.metric,
                "value": fact.value,
                "context": context,
                "source_file": source_file,
                "page_number": page_number,
                "coordinates": coordinates
            })

        # 4. Extract Summary Data
        metadata = recon_result.metadata or {}
        borrower = metadata.get("borrower") or next((f.value for f in winning_facts if f.metric.lower() == "borrower"), "The Borrower")
        project_name = metadata.get("project_name") or f"{borrower} Financing"
        
        # High-impact summary metrics for 'Transaction at a Glance'
        summary_metrics = {}
        target_metrics = ["Total Debt / Loan Amount", "Loan Tenor", "Interest Rate", "Facility Type", "Project Purpose", "Repayment Schedule"]
        for tm in target_metrics:
            val = next((f.value for f in winning_facts if f.metric.lower() == tm.lower()), None)
            if val:
                summary_metrics[tm] = str(val)

        metadata = recon_result.metadata or {}
        bu_id = str(metadata.get("bu_id", ""))
        deal_id = str(metadata.get("deal_id", ""))
        
        # Fallback: extract from facts if metadata is empty
        if not bu_id and winning_facts:
            bu_id = str(getattr(winning_facts[0], 'business_unit_id', ""))
        if not deal_id and winning_facts:
            deal_id = str(getattr(winning_facts[0], 'document_id', ""))

        # 5. Construct Final Response
        try:
            return IMResponse(
                sections=[IMSection(**s) for s in sections_data],
                sources=sources,
                project_name=project_name,
                borrower=borrower,
                date="February 2026", # Or extract from current date if needed
                bu_id=bu_id,
                deal_id=deal_id,
                summary_metrics=summary_metrics
            )
        except Exception as e:
            print(f"IM Assembly error: {e}")
            return IMResponse(sections=[
                IMSection(id="S1", title="Error", content="Failed to assemble the memorandum structure.")
            ], sources=[])

    def _get_facts_for_section(self, template: Dict[str, Any], all_facts: List[Any]) -> List[Any]:
        mapped = template.get("mapped_metrics", [])
        # Lowercase for loose matching
        mapped_lower = [m.lower() for m in mapped]
        
        section_facts = []
        for f in all_facts:
            metric_lower = f.metric.lower().strip()
            # Loose inclusion: Does the fact metric contain the mapped term, or vice versa?
            if any(m in metric_lower or metric_lower in m for m in mapped_lower):
                section_facts.append(f)
                
        # If no facts mapped and it's the conclusion, we might derive from generic metadata,
        # but for safety, we just return whatever mapped.
        return section_facts

    async def regenerate_section(self, recon_result: ReconciliationResult, section_id: str, tone: str = "Standard") -> IMSection:
        """
        Regenerates a specific section of the IM with a targeted tone and template-scoped facts.
        """
        winning_facts = self._select_truth_facts(recon_result.facts)
        
        # Find the specific template for this section
        template = next((t for t in IM_TEMPLATE if t["id"] == section_id), None)
        
        # Filter facts if template is found
        section_facts = winning_facts
        if template:
            section_facts = self._get_facts_for_section(template, winning_facts)
            
        prompt = self._get_synthesis_prompt(
            facts=section_facts, 
            metadata=recon_result.metadata, 
            section_id=section_id, 
            tone=tone,
            template_config=template
        )

        try:
            response = await asyncio.to_thread(self.model.generate_content, prompt)
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

            data = json.loads(response_text)
            
            # If the LLM returned the whole object or just the section
            section_data = data.get("section", data)
            if not isinstance(section_data, dict):
                raise ValueError("Parsed section data is not a dictionary")

            if not section_data.get("id"):
                section_data["id"] = section_id
                
            return IMSection(**section_data)
        except Exception as e:
            logger.error(f"Section regeneration error: {e}")
            return IMSection(id=section_id, title="Regeneration Error", content="Failed to regenerate section.")

    def _get_synthesis_prompt(self, facts: List[Any], metadata: Optional[Dict], section_id: Optional[str] = None, tone: str = "Standard", template_config: Optional[Dict] = None) -> str:
        # 1. Load External Configs
        global_cfg = self._load_global_config()
        ext_section_cfg = self._load_section_config(section_id) if section_id else None
        
        # Merge template_config with external if needed (external takes precedence for overrides)
        config = template_config.copy() if template_config else {}
        if ext_section_cfg:
            config.update(ext_section_cfg)

        # 2. Prepare Fact Summary
        facts_summary_list = []
        for i, f in enumerate(facts):
            source_info = f" | Source: {f.citation.source_file}, p. {f.citation.page_number}" if f.citation else ""
            period_info = f" ({f.period})" if getattr(f, 'period', None) else ""
            context_snippet = f"\n    Context: {f.context}" if getattr(f, 'context', None) else ""
            facts_summary_list.append(f"Fact [{i+1}] - {f.metric}{period_info}: {f.value}{source_info}{context_snippet}")
            
        facts_summary = "\n".join(facts_summary_list)
        if not facts_summary:
            facts_summary = "No specific facts available for this section. Rely on general deal context or note that specific data is pending."

        # 3. Prepare Metadata/Deal Context
        metadata = metadata or {}
        def _get_meta(key, default):
            val = metadata.get(key) if metadata else None
            if not val:
                for f in facts:
                    if f.metric.lower() == key.lower(): return f.value
                return f"[Infer from Fact Summary or use {default}]"
            return val

        borrower = _get_meta("borrower", "the Borrower")
        project_type = _get_meta("project_type", "Project")
        capacity = _get_meta("capacity", "")
        location = _get_meta("location", "the Project Site")
        sector = _get_meta("sector", "Infrastructure")
        counterparty = _get_meta("counterparty", "the Counterparty")
        technology = _get_meta("Technology Type", "Solar PV")

        # 4. Extract authorized sources
        available_sources = sorted(list(set([f.citation.source_file for f in facts if f.citation])))
        sources_list = ", ".join(available_sources) if available_sources else "Not provided (Use indices only)"

        # 5. Build Dynamic Prompt Sections
        system_role = global_cfg.get("system_role", "You are a senior Project Finance Associate.")
        tone_instr = global_cfg.get("tone_instructions", {}).get(tone, "Ensure professional banking tone.")
        
        # 5a. Determine Writing Framework
        frameworks = global_cfg.get("frameworks", {})
        framework_name = config.get("writing_framework", "Analytical")
        selected_framework = frameworks.get(framework_name, frameworks.get("Analytical", []))
        framework_text = "\n    ".join(selected_framework)
        
        writing_rules = "\n    - ".join(global_cfg.get("writing_rules", []))
        
        prompt_instruction = f"SECTION INSTRUCTION: {config.get('prompt_instruction', '')}"
        special_rule = config.get('special_instruction')
        if special_rule:
            prompt_instruction += f"\n    SPECIAL RULE/RECONCILIATION: {special_rule}"

        title = config.get("title", "Untitled Section")
        section_id = config.get("id", section_id)
        section_scoped_instruction = f"ONLY generate content for section '{title}'. Return a JSON object with a single 'section' field containing 'id' (value: '{section_id}'), 'title' (value: '{title}'), and 'content'."

        return f"""
        {system_role}

        TONE REQUIREMENT: {tone_instr}
        
        CRITICAL STRUCTURAL FRAMEWORK:
        {framework_text}

        {prompt_instruction}
        
        Fact Summary (ONLY FOR THIS SECTION):
        {facts_summary}
  
        DEAL CONTEXT (CRITICAL - ALWAYS USE THESE):
        - Borrower: {borrower}
        - Project: {capacity} {project_type} utilizing {technology} technology
        - Location: {location}
        - Sector/Industry: {sector}
        - Primary Counterparty/Offtaker: {counterparty}
  
        {section_scoped_instruction}
  
        CRITICAL WRITING RULES:
        - {writing_rules}
        - AUTHORIZED SOURCES: You may ONLY cite the following files: [{sources_list}].
        
        RETURN VALID JSON matching the specified response schema. RETURN ONLY THE RAW JSON.
        """

    def _select_truth_facts(self, facts: List[Any]) -> List[Any]:
        """
        Groups facts by metric and picks exactly ONE winner per group based on DB verification and recommendation status.
        """
        grouped: Dict[str, List[Any]] = {}
        for f in facts:
            metric = f.metric.lower().strip()
            period = str(f.period).strip().upper() if getattr(f, 'period', None) else "GLOBAL"
            key = f"{metric}|{period}"
            if key not in grouped: grouped[key] = []
            grouped[key].append(f)
            
        winning_facts = []
        for metric, group in grouped.items():
            # 1. User verified fact is absolute truth
            verified = [f for f in group if getattr(f, 'is_verified', False)]
            if verified:
                winning_facts.append(verified[0])
                continue
                
            # 2. System recommended fact is secondary truth
            recommended = [f for f in group if getattr(f, 'is_recommended', False)]
            if recommended:
                winning_facts.append(recommended[0])
                continue
                
            # 3. Fallback (should theoretically rarely hit if reco engine runs properly)
            winning_facts.append(group[0])
            
        return winning_facts

im_service = IMService()
