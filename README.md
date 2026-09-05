# NetSentinel 🛡️ — AI-Powered Network Compliance Analyzer

> **Zero-parser LLM-based config understanding** across Cisco IOS, Fortinet FortiOS, and Juniper JunOS, evaluated against CIS Benchmarks with cross-vendor drift detection and natural-language compliance queries.

---

## Quick Start

### 1. Backend (FastAPI + Ollama)

```bash
cd backend
pip install -r requirements.txt
```

Install Ollama, then download the local model:

```powershell
ollama pull llama3.2:1b
```

Optional `backend/.env` settings:
```
OLLAMA_MODEL=llama3.2:1b
OLLAMA_URL=http://localhost:11434/api/generate
```

Start the server:
```bash
cd backend
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

App runs at: http://localhost:5173

---

## Demo Flow (Hackathon Narrative)

1. **Upload page** → Click "Load Sample" for Cisco, Fortinet, Juniper
2. Click **"Analyze All Devices"** → AI parses all 3 configs
3. **Dashboard** → See compliance scores, pass/fail counts per device
4. Click a device card → **Device Detail** → expand any FAIL row to see:
   - The exact config line that triggered the failure
   - Plain-English explanation
   - Vendor-specific CLI fix command (with copy button)
   - Confidence score + framework tags (CIS, PCI-DSS, NIST)
5. Back on Dashboard → **"Run Drift Analysis"** → Cross-vendor inconsistencies
6. Type in NL Query box: *"Which devices allow Telnet?"* → instant AI answer

---

## Architecture

```
backend/
├── main.py               FastAPI app (upload, analyze, drift, NL query)
├── llm/
│   ├── gemini_client.py  Ollama local model wrapper
│   ├── config_parser.py  Zero-parser config extraction (prompt → JSON)
│   ├── compliance_engine.py  Rule eval + drift detection
│   └── nl_query.py       Natural-language query handler
├── rules/
│   └── cis_benchmarks.json  15 curated CIS rules
└── sample_configs/       Cisco/Fortinet/Juniper demo configs

frontend/
└── src/
    ├── pages/
    │   ├── Upload.jsx      Multi-device upload with drag-drop
    │   ├── Dashboard.jsx   Compliance overview + NL query + drift
    │   └── DeviceDetail.jsx  Rule-by-rule drill down
    └── api/client.js       Axios API calls
```

## Key Differentiators

| Feature | Rule-Based Tools | NetSentinel |
|---------|-----------------|-------------|
| New vendor support | Weeks of parser work | Write a prompt template |
| Messy/partial configs | Parser fails | AI understands context |
| Explanations | "FAIL: Rule 4.3.2" | Plain-English + cited config line |
| Fix commands | None | Vendor-specific CLI commands |
| Cross-vendor comparison | Not possible | Built-in drift detection |
| Query interface | Fixed dashboard | Natural language |
| Framework mapping | One at a time | Automatic multi-framework |
