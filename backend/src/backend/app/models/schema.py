from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid

class Fact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_unit_id: str
    document_id: str
    metric: str
    value: Optional[str] = None
    normalized_value: Optional[str] = None
    numeric_value: Optional[float] = None
    context: Optional[str] = None
    period: Optional[str] = None
    page_number: Optional[int] = None
    coordinates: Optional[List[float]] = None
    reasoning: Optional[str] = None
    is_verified: bool = False
    is_recommended: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class FactUpdate(BaseModel):
    metric: Optional[str] = None
    value: Optional[str] = None
    normalized_value: Optional[str] = None
    numeric_value: Optional[float] = None
    context: Optional[str] = None
    period: Optional[str] = None
    page_number: Optional[int] = None
    coordinates: Optional[List[float]] = None
    reasoning: Optional[str] = None
    is_verified: Optional[bool] = None
    is_recommended: Optional[bool] = None

class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    storage_path: str
    extraction_data: List[Dict[str, Any]] = []
    reconciliation_data: Dict[str, Any] = {}
    docling_json: Optional[Dict[str, Any]] = None
    status: str = "uploaded"
    uploaded_at: datetime = Field(default_factory=datetime.now)
    facts: List[Fact] = []

class GeneratedOutput(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # IM, RISK_REPORT, etc.
    content: Dict[str, Any]
    status: str = "DRAFT"
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class BusinessUnit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    industry: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    documents: List[Document] = []
    generated_outputs: List[GeneratedOutput] = []
    facts: List[Fact] = []

class BusinessUnitCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    description: Optional[str] = None

class BusinessUnitSummary(BaseModel):
    id: str
    name: str
    created_at: str
    document_count: int = 0
    status: str = "active"
