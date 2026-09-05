import json
from pathlib import Path
from .gemini_client import call_gemini

# Load CIS rules from JSON
RULES_PATH = Path(__file__).parent.parent / "rules" / "cis_benchmarks.json"

def load_rules() -> list[dict]:
    with open(RULES_PATH, "r") as f:
        return json.load(f)


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
    severity_weights = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    for rule in rules:
        check = rule["check_logic"]
        setting_name = check.split(" must ", 1)[0]
        value = settings.get(setting_name)
        expected = rule["expected"]
        if value is None:
            status, confidence = "UNKNOWN", 0.4
        elif " or " in check:
            allowed = [part.strip().strip("'") for part in check.split(" must be ", 1)[1].split(" or ")]
            status, confidence = ("PASS", 0.95) if str(value).lower() in allowed else ("FAIL", 0.95)
        else:
            status, confidence = ("PASS", 0.95) if value == expected else ("FAIL", 0.95)
        severity = rule["severity"]
        exposure_weight = rule["exposure_weight"]
        results.append({
            "rule_id": rule["id"],
            "rule_name": rule["name"],
            "status": status,
            "confidence": confidence,
            "explanation": f"{setting_name} is {value!r}; expected {expected!r}.",
            "config_snippet": f"{setting_name}: {value!r}",
            "fix_command": rule.get("fix_commands", {}).get(vendor) if status == "FAIL" else None,
            "severity": severity,
            "exposure_weight": exposure_weight,
            "frameworks": rule.get("frameworks", []),
            "risk_score": severity_weights[severity] * exposure_weight,
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
