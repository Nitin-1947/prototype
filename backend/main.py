import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from models.schemas import (
    UploadRequest,
    NLQueryRequest,
    NLQueryResponse,
    DeviceResult,
    RuleResult,
    DriftReport,
    DriftItem,
    FixPreview,
)
from llm.config_parser import extract_config_settings
from llm.compliance_engine import evaluate_rules, detect_drift, build_fix_preview
from llm.nl_query import answer_nl_query

app = FastAPI(title="NetSentinel API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory store (fine for hackathon)
# ---------------------------------------------------------------------------
_device_store: dict[str, dict] = {}  # device_id -> raw data
_results_store: dict[str, DeviceResult] = {}  # device_id -> result
_fix_state_store: dict[str, dict[str, str]] = {}  # device_id -> {rule_id: state}

# ---------------------------------------------------------------------------
# Sample config loader helper
# ---------------------------------------------------------------------------
SAMPLE_DIR = Path(__file__).parent / "sample_configs"


@app.get("/api/samples/{vendor}")
async def get_sample_config(vendor: str):
    """Return a sample config text for a given vendor (cisco/fortinet/juniper)."""
    file_map = {
        "cisco": "cisco_ios.txt",
        "fortinet": "fortios.txt",
        "juniper": "junos.txt",
    }
    if vendor not in file_map:
        raise HTTPException(status_code=404, detail="Unknown vendor")
    path = SAMPLE_DIR / file_map[vendor]
    return {"config_text": path.read_text()}


# ---------------------------------------------------------------------------
# Upload + Analyze
# ---------------------------------------------------------------------------
@app.post("/api/upload")
async def upload_config(req: UploadRequest):
    """Register a device config. Returns a device_id for subsequent analysis."""
    device_id = str(uuid.uuid4())
    _device_store[device_id] = {
        "device_id": device_id,
        "device_name": req.device_name,
        "vendor": req.vendor,
        "config_text": req.config_text,
    }
    return {"device_id": device_id, "device_name": req.device_name}


@app.post("/api/analyze/{device_id}")
async def analyze_device(device_id: str):
    """
    Run full LLM analysis on a registered device:
    1. Extract settings from raw config
    2. Evaluate all CIS rules
    3. Return structured DeviceResult
    """
    if device_id not in _device_store:
        raise HTTPException(status_code=404, detail="Device not found. Upload first.")

    device = _device_store[device_id]

    # Step 1: Extract settings via LLM
    try:
        settings = await extract_config_settings(
            vendor=device["vendor"],
            config_text=device["config_text"],
        )

        # Step 2: Evaluate CIS rules
        raw_results = await evaluate_rules(
            device_name=device["device_name"],
            vendor=device["vendor"],
            settings=settings,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    
    rule_results = [
        RuleResult(
            rule_id=r["rule_id"],
            rule_name=r["rule_name"],
            status=r.get("status", "UNKNOWN"),
            confidence=float(r.get("confidence", 0.5)),
            explanation=r.get("explanation", ""),
            config_snippet=r.get("config_snippet"),
            fix_command=r.get("fix_command"),
            frameworks=r.get("frameworks", []),
        )
        for r in raw_results
    ]

    result = DeviceResult(
        device_id=device_id,
        device_name=device["device_name"],
        vendor=device["vendor"],
        compliance_score=0.0,  # recalculated by DeviceResult.model_post_init from rule_results
        rule_results=rule_results,
        extracted_settings=settings,
    )
    _results_store[device_id] = result

    # Also store settings for drift detection
    _device_store[device_id]["settings"] = settings

    return result


@app.post("/api/analyze-all")
async def analyze_all():
    """Analyze all uploaded devices that haven't been analyzed yet."""
    results = []
    for device_id in list(_device_store.keys()):
        if device_id not in _results_store:
            r = await analyze_device(device_id)
            results.append(r)
        else:
            results.append(_results_store[device_id])
    return results

# ---------------------------------------------------------------------------
# Safety Envelope: Dry-Run Preview + Simulated Apply
# ---------------------------------------------------------------------------
@app.post("/api/simulate-fix/{device_id}/{rule_id}", response_model=FixPreview)
async def simulate_fix(device_id: str, rule_id: str):
    """
    Dry-run preview of a rule's remediation. Shows a before/after diff and flags
    lockout risk. Does NOT touch any real device and does NOT apply anything.
    """
    if device_id not in _results_store:
        raise HTTPException(status_code=404, detail="No analysis found for this device. Run /analyze first.")

    result = _results_store[device_id]
    rule = next((r for r in result.rule_results if r.rule_id == rule_id), None)
    if rule is None:
        raise HTTPException(status_code=404, detail="Rule not found for this device.")
    if rule.status != "FAIL":
        raise HTTPException(status_code=400, detail="Only FAILED rules have a remediation to preview.")

    settings = _device_store[device_id].get("settings", {})
    preview = build_fix_preview(rule.model_dump(), settings)

    _fix_state_store.setdefault(device_id, {})[rule_id] = "dry_run_reviewed"

    return FixPreview(**preview, state="dry_run_reviewed")


@app.post("/api/simulate-apply/{device_id}/{rule_id}", response_model=FixPreview)
async def simulate_apply(device_id: str, rule_id: str):
    """
    Marks a fix as simulated-applied. Requires a prior dry-run preview for that
    rule, mirroring the real-world "review before apply" workflow. No real
    device is touched — this only updates in-memory demo state.
    """
    if device_id not in _results_store:
        raise HTTPException(status_code=404, detail="No analysis found for this device. Run /analyze first.")

    current_state = _fix_state_store.get(device_id, {}).get(rule_id, "not_applied")
    if current_state == "not_applied":
        raise HTTPException(
            status_code=400,
            detail="Preview the fix (dry run) before simulating apply.",
        )

    result = _results_store[device_id]
    rule = next((r for r in result.rule_results if r.rule_id == rule_id), None)
    if rule is None:
        raise HTTPException(status_code=404, detail="Rule not found for this device.")

    settings = _device_store[device_id].get("settings", {})
    preview = build_fix_preview(rule.model_dump(), settings)

    _fix_state_store[device_id][rule_id] = "simulated_applied"

    return FixPreview(**preview, state="simulated_applied")


@app.get("/api/fix-state/{device_id}")
async def get_fix_state(device_id: str):
    """Return the current dry-run/apply state of every rule for a device."""
    return _fix_state_store.get(device_id, {})
# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------
@app.get("/api/results")
async def get_all_results():
    """Return all analyzed device results."""
    return list(_results_store.values())


@app.get("/api/results/{device_id}")
async def get_device_result(device_id: str):
    if device_id not in _results_store:
        raise HTTPException(status_code=404, detail="No results yet. Run /analyze first.")
    return _results_store[device_id]


# ---------------------------------------------------------------------------
# Drift Detection
# ---------------------------------------------------------------------------
@app.get("/api/drift")
async def get_drift_report():
    """
    Cross-vendor drift detection across all analyzed devices.
    Identifies inconsistent policy enforcement across vendors.
    """
    devices_with_settings = [
        {
            "device_name": d["device_name"],
            "vendor": d["vendor"],
            "settings": d.get("settings", {}),
        }
        for d in _device_store.values()
        if "settings" in d
    ]

    if len(devices_with_settings) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 analyzed devices required for drift detection.",
        )

    raw = await detect_drift(devices_with_settings)

    inconsistencies = [
        DriftItem(
            setting=item.get("setting", ""),
            description=item.get("description", ""),
            devices=item.get("devices", []),
            severity=item.get("severity", "LOW"),
        )
        for item in raw.get("inconsistencies", [])
    ]

    return DriftReport(
        inconsistencies=inconsistencies,
        summary=raw.get("summary", ""),
    )


# ---------------------------------------------------------------------------
# Natural Language Query
# ---------------------------------------------------------------------------
@app.post("/api/query", response_model=NLQueryResponse)
async def nl_query(req: NLQueryRequest):
    """Answer a natural-language compliance question against all device results."""
    if not _results_store:
        raise HTTPException(
            status_code=400,
            detail="No analyzed devices yet. Upload and analyze configs first.",
        )

    all_results = [r.model_dump() for r in _results_store.values()]
    answer = await answer_nl_query(
        question=req.question,
        all_results=all_results,
    )
    return NLQueryResponse(**answer)


# ---------------------------------------------------------------------------
# Reset (useful for demo resets)
# ---------------------------------------------------------------------------
@app.delete("/api/reset")
async def reset():
    """Clear all stored devices and results."""
    _device_store.clear()
    _results_store.clear()
    return {"message": "All data cleared."}


@app.get("/")
async def root():
    return {"message": "NetSentinel API is running. Docs at /docs"}
