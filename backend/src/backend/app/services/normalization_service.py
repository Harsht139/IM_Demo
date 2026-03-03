import json
import asyncio
from typing import Dict, Any, Optional
from pydantic import BaseModel
from app.services.vertex_service import vertex_service
from app.logging import get_logger

logger = get_logger(__name__)

class NormalizedValue(BaseModel):
    standard_value: Optional[str] = ""
    unit: Optional[str] = None
    period: Optional[str] = None
    label: Optional[str] = None
    numeric_value: Optional[float] = None # For mathematical comparison

class NormalizationService:
    def __init__(self):
        self._model = None

    @property
    def model(self):
        if self._model is None:
            self._model = vertex_service.get_generative_model("gemini-2.0-flash")
        return self._model

    async def normalize_fact(self, metric: str, raw_value: str) -> NormalizedValue:
        
        prompt = f"""
        You are a financial data normalization engine. Standardize the following fact for a database.
        
        CRITICAL RULES FOR NUMBERS:
        1. Indian Currency Conversion:
           - "₹1200 Cr" or "1200 Crores" -> numeric_value: 1200.0, standard_value: "1200.0"
           - "₹3220 Mn" or "3220 Million" -> numeric_value: 322.0, standard_value: "322.0" (since 1 Mn = 0.1 Cr)
           - "₹45000 Lakhs" -> numeric_value: 450.0, standard_value: "450.0" (since 100 Lakhs = 1 Cr)
        
        2. PREVENT COMMON ERRORS:
           - DO NOT confuse "1200" with "1020" - read numbers carefully
           - If you see "1200 Cr", the numeric_value should be exactly 1200.0, not 1020.0
           - Double-check all digit sequences before converting
        
        3. Units: Convert to INR Cr where possible, or pure numbers for ratios.
        
        4. Time Periods: Standardize "FY24", "Financial Year 2024", "2023-24" into "FY2024".
        
        5. Labels: Keep metric names clear and standardized.
        
        Metric Name: {metric}
        Raw Value: {raw_value}
        
        Return a JSON object with:
        "standard_value": (The cleanest string representation, e.g. "1200.0"),
        "unit": (e.g., "INR Cr", "MW", "x", "%"),
        "period": (e.g., "FY2024", "Q3 2024"),
        "label": (The standardized or provided metric name),
        "numeric_value": (The absolute float value for mathematical comparison - BE VERY CAREFUL WITH DIGITS)
        """

        try:
            # model.generate_content is synchronous, run in thread
            response = await asyncio.to_thread(self.model.generate_content, prompt)
            response_text = response.text
            
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            
            data = json.loads(response_text)
            return NormalizedValue(**data)
            
        except Exception as e:
            logger.warning(f"Normalization error for {raw_value}: {e}")
            # Fallback to raw data if LLM fails
            return NormalizedValue(standard_value=raw_value, label=metric)

normalization_service = NormalizationService()
