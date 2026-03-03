import uuid
import re
from typing import List, Dict, Any, Optional
from app.logging import get_logger

logger = get_logger(__name__)

class ConflictDetector:
    """
    Specialized module for grouping facts and identifying discrepancies.
    Implements truth heuristics to recommend the most likely correct value.
    """

    def __init__(self, numeric_tolerance: float = 0.001):
        self.numeric_tolerance = numeric_tolerance

    def _get_fact_attr(self, fact, attr_name, default=None):
        citation = getattr(fact, 'citation', None)
        if citation:
            val = getattr(citation, attr_name, None)
            if val is not None:
                return val
        
        # Mapping rules for flat facts (DB)
        if attr_name == 'source_file':
            return getattr(fact, 'source_file', getattr(fact, 'document_id', default))
            
        val = getattr(fact, attr_name, None)
        return val if val is not None else default

    def _normalize_time_units(self, val: str) -> str:
        """Convert time expressions to a standard format (months)."""
        if not val:
            return ""
        
        s = val.lower().strip()
        
        # Convert years to months
        year_patterns = [
            (r'(\d+)\s*year(s)?', lambda m: str(int(m.group(1)) * 12) + " months"),
            (r'(\d+)\s*yr(s)?', lambda m: str(int(m.group(1)) * 12) + " months"),
            (r'(\d+)\s*y$', lambda m: str(int(m.group(1)) * 12) + " months"),
        ]
        
        for pattern, converter in year_patterns:
            if re.search(pattern, s):
                s = re.sub(pattern, converter, s)
                break
        
        # Handle "months" already in months format
        month_patterns = [
            (r'(\d+)\s*month(s)?', r'\1 months'),
            (r'(\d+)\s*mo$', r'\1 months'),
        ]
        
        for pattern, replacement in month_patterns:
            s = re.sub(pattern, replacement, s)
        
        return s

    def _clean_value(self, val: any) -> str:
        """Standardize strings for comparison, ignoring formatting/noise."""
        if val is None: return ""
        # 1. Basic formatting cleanup
        s = str(val).replace(',', '').replace('\xa0', ' ').strip().lower()
        
        # 2. Normalize time units first (before other cleaning)
        s = self._normalize_time_units(s)
        
        # 3. Aggressive regex: Remove currency symbols and scale words
        # This handles symbols (₹ $ £) and words (crore, cr, lakh, mn, etc.)
        s = re.sub(r'[₹\$£€]', '', s)
        s = re.sub(r'\b(crore|crores|cr|lakh|lakhs|lac|lacs|mn|million|bn|billion|mw|kw)\b', '', s)
        
        # 4. Final trim and handle decimals
        s = s.strip()
        if s.endswith('.0'): s = s[:-2]
        return s

    async def detect_conflicts(self, facts: List[any]) -> List[any]:
        """
        Groups facts by metric and identifies conflicts based on value variations.
        Deduplicates identical values from the same document.
        """
        from app.services.reconciliation_service import Conflict, ConflictSource, is_na_value
        
        # Defensive NA filter
        facts = [f for f in facts if not is_na_value(f.value)]
        
        grouped_facts: Dict[str, List[any]] = {}
        for fact in facts:
            metric = fact.metric.lower().strip()
            period = str(fact.period).strip().upper() if fact.period else "GLOBAL"
            metric_key = f"{metric}|{period}"
            
            if metric_key not in grouped_facts:
                grouped_facts[metric_key] = []
            grouped_facts[metric_key].append(fact)
        
        conflicts: List[Conflict] = []
        for metric_name, fact_list in grouped_facts.items():
            # First, deduplicate identical values within the same document
            # (e.g. if 'Annual Report' mentions '2000' twice, it's one source point)
            doc_dedup: Dict[str, any] = {} # (doc_name, cleaned_val) -> fact
            for f in fact_list:
                doc_name = self._get_fact_attr(f, 'source_file', "Unknown Document")
                clean_val = self._clean_value(f.value)
                key = (doc_name, clean_val)
                if key not in doc_dedup:
                    doc_dedup[key] = f
            
            unique_fact_list = list(doc_dedup.values())
            
            if len(unique_fact_list) < 2:
                continue
            
            # Now check if these UNIQUE source points actually vary
            has_conflict = self._check_for_variation(unique_fact_list)
            
            if has_conflict:
                # Apply Truth Heuristics to pick recommended source
                recommended_idx = self._apply_truth_heuristics(unique_fact_list)
                
                sources = [
                    ConflictSource(
                        name=self._get_fact_attr(f, 'source_file', "Unknown Document"),
                        value=f.value,
                        normalized_value=f.normalized_value,
                        context=self._get_fact_attr(f, 'context', ""),
                        period=f.period,
                        isRecommended=(idx == recommended_idx),
                        reasoning=f.reasoning,
                        fact_id=getattr(f, 'id', None),
                        page_number=self._get_fact_attr(f, 'page_number'),
                        coordinates=self._get_fact_attr(f, 'coordinates')
                    ) for idx, f in enumerate(unique_fact_list)
                ]
                
                conflicts.append(Conflict(
                    id=f"conf-{uuid.uuid4().hex[:8]}",
                    metric=unique_fact_list[0].metric,
                    sources=sources
                ))
        
        return conflicts


    def _check_for_variation(self, fact_list: List[any]) -> bool:
        """
        Returns True if there is a significant variation between facts.
        """
        if len(fact_list) < 2:
            return False
            
        for i in range(len(fact_list)):
            for j in range(i + 1, len(fact_list)):
                f1 = fact_list[i]
                f2 = fact_list[j]
                
                # 1. Numeric check (if both have numeric values)
                if f1.numeric_value is not None and f2.numeric_value is not None:
                    diff = abs(f1.numeric_value - f2.numeric_value)
                    threshold = self.numeric_tolerance * max(abs(f1.numeric_value), 1.0)
                    if diff > threshold:
                        return True
                    else:
                        continue # These match numerically

                # 2. Strict cleaned string check (Fallback and safety net)
                v1 = self._clean_value(f1.value)
                v2 = self._clean_value(f2.value)
                if v1 == v2:
                    continue # These match as strings
                
                # 3. Normalized value check
                nv1 = self._clean_value(f1.normalized_value)
                nv2 = self._clean_value(f2.normalized_value)
                if nv1 and nv2 and nv1 != nv2:
                    return True
                
                # If we reach here and strings match, it's not a variation
                if v1 != v2:
                    return True
                    
        return False

    def _apply_truth_heuristics(self, fact_list: List[any]) -> int:
        """
        Scores each fact to determine the most reliable source.
        Returns the index of the recommended fact.
        
        Heuristics:
        1. Recency: If one source is clearly newer (placeholder for date metadata).
        2. Source Type: Certain documents (e.g., "PPA", "Sanction Letter") rank higher.
        3. Specificity: Longer context or reasoning.
        """
        best_score = -1
        recommended_idx = 0
        
        for idx, fact in enumerate(fact_list):
            score = 0
            filename = self._get_fact_attr(fact, 'source_file', "").lower()
            
            # Heuristic 1: Official/Final Documents
            if any(k in filename for k in ["final", "signed", "sanction", "ppa", "om"]):
                score += 50
            
            # Heuristic 2: Information richness
            if fact.reasoning and len(fact.reasoning) > 20:
                score += 10
            context = self._get_fact_attr(fact, 'context', "")
            if context and len(context) > 50:
                score += 5
                
            # Heuristic 3: Page number presence (implies structured doc)
            if self._get_fact_attr(fact, 'page_number'):
                score += 10
                
            if score > best_score:
                best_score = score
                recommended_idx = idx
                
        return recommended_idx
