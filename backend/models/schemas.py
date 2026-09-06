from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
import json
from pathlib import Path


class VendorType(str, Enum):
    cisco = "cisco"
    fortinet = "fortinet"
    juniper = "juniper"


class UploadRequest(BaseModel):
    vendor: VendorType
    config_text: str
    device_name: Optional[str] = "Unnamed Device"


class FrameworkReference(BaseModel):
    name: str
    control_id: str


def _rule_metadata(rule_id: str) -> dict:
    rules_path = Path(__file__).parent.parent / "rules" / "cis_benchmarks.json"
    try:
        rules = json.loads(rules_path.read_text())
    except (OSError, json.JSONDecodeError):
        return {}
    return next((rule for rule in rules if rule.get("id") == rule_id), {})


class RuleResult(BaseModel):
    rule_id: str
    rule_name: str
    status: str  # "PASS" | "FAIL" | "UNKNOWN"
    confidence: float = Field(ge=0.0, le=1.0)
    explanation: str
    config_snippet: Optional[str] = None
    fix_command: Optional[str] = None
    severity: str = "medium"
    exposure_weight: int = Field(default=1, ge=1, le=3)
    frameworks: List[FrameworkReference] = []
    risk_score: int = Field(default=1, ge=1, le=12)

    def model_post_init(self, __context: Any) -> None:
        metadata = _rule_metadata(self.rule_id)
        if metadata:
            self.severity = metadata.get("severity", self.severity)
            self.exposure_weight = metadata.get("exposure_weight", self.exposure_weight)
            self.frameworks = [FrameworkReference(**item) for item in metadata.get("frameworks", [])]
            severity_weight = {"critical": 4, "high": 3, "medium": 2, "low": 1}
            self.risk_score = severity_weight.get(self.severity, 1) * self.exposure_weight


class RiskItem(BaseModel):
    rule_id: str
    rule_name: str
    severity: str
    risk_score: int = Field(ge=1, le=12)
    fix_command: Optional[str] = None


class DeviceResult(BaseModel):
    device_id: str
    device_name: str
    vendor: VendorType
    compliance_score: float
    rule_results: List[RuleResult]
    extracted_settings: Dict[str, Any] = {}
    top_risks: List[RiskItem] = []

    def model_post_init(self, __context: Any) -> None:
        try:
            from llm.compliance_engine import calculate_risk_weighted_score, get_top_risks
        except ImportError:
            from backend.llm.compliance_engine import calculate_risk_weighted_score, get_top_risks
        rule_data = [rule.model_dump() for rule in self.rule_results]
        self.compliance_score = calculate_risk_weighted_score(rule_data)
        self.top_risks = [RiskItem(**item) for item in get_top_risks(rule_data)]


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


class FixPreview(BaseModel):
    rule_id: str
    rule_name: str
    before: Optional[str] = None
    after: Optional[str] = None
    severity: str
    risk_score: int
    lockout_risk: bool
    lockout_warning: Optional[str] = None
    state: str = "dry_run_reviewed"  # not_applied | dry_run_reviewed | simulated_applied
