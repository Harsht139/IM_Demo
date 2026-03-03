import re
from typing import List, Dict
from app.logging import get_logger

logger = get_logger(__name__)

class SchemaAligner:
    """
    Handles semantic alignment of extracted facts to a target schema.
    Ensures consistent terminology across documents.
    """

    def _clean_metric_name(self, name: str) -> str:
        """Strip prefixes like 'Metric 1:', '1.', etc."""
        # Remove "Metric XX:" or "Metric XX."
        s = re.sub(r'^metric\s*\d+[:\.]\s*', '', name, flags=re.IGNORECASE)
        # Remove "XX." or "XX:" at start
        s = re.sub(r'^\d+[:\.]\s*', '', s)
        return s.strip().lower()

    def align_schema(self, facts: List[any], discovered_schema: List[str]) -> List[any]:
        """
        Aligns extracted metrics to the discovered schema using normalized mapping.
        """
        schema_map = {self._clean_metric_name(s): s for s in discovered_schema}
        
        for fact in facts:
            clean_fact_metric = self._clean_metric_name(fact.metric)
            
            # 1. Exact cleaned match
            if clean_fact_metric in schema_map:
                fact.metric = schema_map[clean_fact_metric]
                continue
                
            # 2. Substring match
            aligned = False
            for s_clean, s_orig in schema_map.items():
                if len(s_clean) > 4 and len(clean_fact_metric) > 4:
                    if s_clean in clean_fact_metric or clean_fact_metric in s_clean:
                        logger.debug(f"Aligning '{fact.metric}' to '{s_orig}' via substring.")
                        fact.metric = s_orig
                        aligned = True
                        break
            
            if not aligned:
                logger.debug(f"Metric '{fact.metric}' remained unaligned.")
                    
        return facts
