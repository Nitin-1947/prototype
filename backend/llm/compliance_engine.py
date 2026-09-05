import json
import logging
from pathlib import Path
from .gemini_client import call_gemini

# Load CIS rules from JSON
RULES_PATH = Path(__file__).parent.parent / "rules" / "cis_benchmarks.json"
SEVERITY_WEIGHTS = {"critical": 4, "high": 3, "medium": 2, "low": 1}
logger = logging.getLogger(__name__)

def load_rules() -> list[dict]:
    with open(RULES_PATH, "r") as f:
        return json.load(f)


def calculate_risk_weighted_score(rule_results: list[dict]) -> float:
    """Calculate a 0-100 score weighted by severity and exposure risk."""
    if not rule_results:
        return 100.0

    total_possible_risk = sum(int(rule.get("risk_score", 0)) for rule in rule_results)
    if total_possible_risk <= 0:
        return 100.0

    weighted_bad_risk = 0.0
    for rule in rule_results:
        if rule.get("status") not in {"FAIL", "UNKNOWN"}:
            continue
        risk_score = int(rule.get("risk_score", 0))
        penalty_fraction = 1.0
        if rule.get("status") == "UNKNOWN":
            penalty_fraction = 0.5
        weighted_bad_risk += risk_score * penalty_fraction

    score = 100.0 * (1.0 - weighted_bad_risk / total_possible_risk)
    return round(max(0.0, min(100.0, score)), 1)


def get_top_risks(rule_results: list[dict], limit: int = 3) -> list[dict]:
    """Return the highest-risk failed or unknown controls for a device."""
    candidates = [
        {
            "rule_id": rule.get("rule_id", "unknown-rule"),
            "rule_name": rule.get("rule_name", "Unknown rule"),
            "severity": rule.get("severity", "low"),
            "risk_score": rule.get("risk_score", 0),
            "fix_command": rule.get("fix_command"),
        }
        for rule in rule_results
        if rule.get("status") in {"FAIL", "UNKNOWN"}
    ]
    return sorted(candidates, key=lambda item: item["risk_score"], reverse=True)[:limit]


async def evaluate_rules(
    device_name: str,
    vendor: str,
    settings: dict,
) -> list[dict]:
    """
    Evaluate all CIS rules against extracted settings for one device.
    Returns a list of rule result dicts.
    """
    rules = load_rules()
    results = []
    for rule in rules:
        check = rule["check_logic"]
        setting_name = check.split(" must ", 1)[0]
        value = settings.get(setting_name)
        expected = rule.get("expected")
        if value is None:
            status, confidence = "UNKNOWN", 0.4
        elif " or " in check:
            allowed = [part.strip().strip("'") for part in check.split(" must be ", 1)[1].split(" or ")]
            status, confidence = ("PASS", 0.95) if str(value).lower() in allowed else ("FAIL", 0.95)
        else:
            status, confidence = ("PASS", 0.95) if value == expected else ("FAIL", 0.95)
        rule_id = rule.get("id", "unknown-rule")
        severity = str(rule.get("severity", "low")).lower()
        if severity not in SEVERITY_WEIGHTS:
            logger.warning("Invalid severity %r for rule %s; defaulting to low", severity, rule_id)
            severity = "low"
        exposure_weight = rule.get("exposure_weight", 1)
        results.append({
            "rule_id": rule_id,
            "rule_name": rule.get("name", rule_id),
            "status": status,
            "confidence": confidence,
            "explanation": f"{setting_name} is {value!r}; expected {expected!r}.",
            "config_snippet": f"{setting_name}: {value!r}",
            "fix_command": rule.get("fix_commands", {}).get(vendor) if status == "FAIL" else None,
            "severity": severity,
            "exposure_weight": exposure_weight,
            "frameworks": rule.get("frameworks", []),
            "risk_score": SEVERITY_WEIGHTS.get(severity, 1) * exposure_weight,
        })

    return results


DRIFT_PROMPT = """
You are a network policy consistency analyst. Below are the extracted security settings
from multiple network devices across different vendors.

Devices:
{devices_json}

Analyze these settings for cross-vendor policy inconsistencies — cases where different devices
enforce the same policy differently or where one device is more permissive than another.

Return a JSON object with this structure:
{{
  "inconsistencies": [
    {{
      "setting": "<setting name>",
      "description": "<plain-English description of the inconsistency>",
      "devices": [
        {{"device_name": "...", "vendor": "...", "value": "..."}}
      ],
      "severity": "HIGH" | "MEDIUM" | "LOW"
    }}
  ],
  "summary": "<one-paragraph executive summary of the overall cross-vendor policy state>"
}}

Focus on security-impactful inconsistencies (e.g., one vendor allows Telnet while another doesn't,
different SSH versions, inconsistent SNMP versions, etc.).
Return ONLY the JSON object.
"""


async def detect_drift(devices: list[dict]) -> dict:
    """
    Compare settings across all devices and detect policy inconsistencies.
    """
    devices_json = json.dumps(
        [
            {
                "device_name": d["device_name"],
                "vendor": d["vendor"],
                "settings": d["settings"],
            }
            for d in devices
        ],
        indent=2,
    )
    prompt = DRIFT_PROMPT.format(devices_json=devices_json)
    result = await call_gemini(prompt)
    return result if isinstance(result, dict) else {"inconsistencies": [], "summary": ""}
