from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class VendorType(str, Enum):
    cisco = "cisco"
    fortinet = "fortinet"
    juniper = "juniper"


class UploadRequest(BaseModel):
    vendor: VendorType
    config_text: str
    device_name: Optional[str] = "Unnamed Device"


class RuleResult(BaseModel):
    rule_id: str
    rule_name: str
    status: str  # "PASS" | "FAIL" | "UNKNOWN"
    confidence: float = Field(ge=0.0, le=1.0)
    explanation: str
    config_snippet: Optional[str] = None
    fix_command: Optional[str] = None
    frameworks: List[str] = []


class DeviceResult(BaseModel):
    device_id: str
    device_name: str
    vendor: VendorType
    compliance_score: float
    rule_results: List[RuleResult]
    extracted_settings: Dict[str, Any] = {}


class DriftItem(BaseModel):
    setting: str
    description: str
    devices: List[Dict[str, Any]]  # [{device_name, vendor, value}]
    severity: str  # "HIGH" | "MEDIUM" | "LOW"


class DriftReport(BaseModel):
    inconsistencies: List[DriftItem]
    summary: str


class NLQueryRequest(BaseModel):
    question: str


class NLQueryResponse(BaseModel):
    answer: str
    relevant_devices: List[str] = []
    cited_rules: List[str] = []
