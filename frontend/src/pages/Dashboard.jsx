import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAllResults, getDriftReport, nlQuery } from "../api/client";

const VENDOR_META = {
  cisco: { cls: "vendor-cisco", icon: "🔵", label: "Cisco IOS" },
  fortinet: { cls: "vendor-fortinet", icon: "🔴", label: "Fortinet" },
  juniper: { cls: "vendor-juniper", icon: "🟢", label: "Juniper" },
};

function ScoreRing({ score }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="score-ring-wrapper">
      <div className="score-ring">
        <svg width="90" height="90" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="45" cy="45" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="score-ring-text" style={{ color }}>
          <span>{score}%</span>
        </div>
      </div>
    </div>
  );
}

function NLQueryBox({ results }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const EXAMPLES = [
    "Which devices allow Telnet?",
    "Which devices are fully SSH compliant?",
    "Show me all critical failures",
    "Which device has the lowest compliance score?",
  ];

  const ask = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await nlQuery(question);
      setAnswer(res);
    } catch (e) {
      setError(e?.response?.data?.detail || "Query failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nl-query-box">
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <div style={{ fontSize: "1.2rem" }}>🔍</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>Ask a Compliance Question</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Natural-language queries across all device configs
          </div>
        </div>
      </div>

      <div className="nl-input-row">
        <input
          className="nl-input"
          placeholder='e.g. "Which devices allow Telnet?" or "Show me SSH failures"'
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
        />
        <button className="btn btn-primary" onClick={ask} disabled={loading || !question.trim()}>
          {loading ? <div className="spinner" /> : "Ask"}
        </button>
      </div>

      {/* Example chips */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            className="btn btn-secondary btn-sm"
            onClick={() => { setQuestion(ex); }}
            style={{ fontSize: "0.75rem" }}
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: "1rem" }}>⚠️ {error}</div>}

      {answer && (
        <div className="nl-answer">
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, marginBottom: "0.75rem" }}>
            {answer.answer}
          </div>
          {answer.relevant_devices?.filter(Boolean).length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Devices:</span>
              {answer.relevant_devices.filter(Boolean).map((d) => (
                <span key={d} className="badge badge-unknown">{d}</span>
              ))}
            </div>
          )}
          {answer.cited_rules?.filter(Boolean).length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Rules:</span>
              {answer.cited_rules.filter(Boolean).map((r) => (
                <span key={r} className="badge" style={{ background: "var(--accent-primary-glow)", color: "var(--accent-primary)", border: "1px solid rgba(59,130,246,0.3)", fontSize: "0.7rem" }}>{r}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DriftPanel() {
  const [drift, setDrift] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getDriftReport();
      setDrift(d);
    } catch (e) {
      setError(e?.response?.data?.detail || "Drift detection failed.");
    } finally {
      setLoading(false);
    }
  };

  const SEVERITY_MAP = {
    HIGH: "badge-high",
    MEDIUM: "badge-medium",
    LOW: "badge-low",
  };

  if (!drift) {
    return (
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>⚡ Cross-Vendor Drift Detection</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Detects policy inconsistencies between vendors
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={load} disabled={loading}>
            {loading ? <><div className="spinner" /> Analyzing…</> : "Run Drift Analysis"}
          </button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {!error && <div className="empty-state"><div className="empty-state-icon">⚡</div><div className="empty-state-title">Not yet analyzed</div><div className="empty-state-text">Click "Run Drift Analysis" to compare policies across all devices</div></div>}
      </div>
    );
  }

  return (
    <div className="card animate-fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>⚡ Cross-Vendor Drift Report</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{drift.inconsistencies?.length || 0} inconsistencies found</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setDrift(null)}>Refresh</button>
      </div>

      {drift.summary && (
        <div className="alert alert-info" style={{ marginBottom: "1rem", fontSize: "0.85rem" }}>
          {drift.summary}
        </div>
      )}

      {drift.inconsistencies?.length === 0 ? (
        <div className="alert alert-success">✓ No cross-vendor policy inconsistencies detected.</div>
      ) : (
        drift.inconsistencies.map((item, i) => (
          <div className="drift-item" key={i}>
            <div className="drift-item-header">
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{item.setting}</span>
              <span className={`badge ${SEVERITY_MAP[item.severity] || "badge-unknown"}`}>{item.severity}</span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>{item.description}</p>
            <div className="drift-devices">
              {item.devices?.map((d, j) => (
                <div key={j} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}>
                  <span className={`vendor-chip ${VENDOR_META[d.vendor]?.cls || ""}`} style={{ padding: "0.1rem 0.4rem", fontSize: "0.7rem" }}>{d.vendor}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{d.device_name}</span>
                  <span style={{ color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>= {String(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function Dashboard() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getAllResults()
      .then(setResults)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalDevices = results.length;
  const avgScore = totalDevices
    ? Math.round(results.reduce((s, r) => s + r.compliance_score, 0) / totalDevices)
    : 0;
  const criticalFails = results.reduce(
    (s, r) => s + r.rule_results.filter((rr) => rr.status === "FAIL").length,
    0
  );
  const fullyCompliant = results.filter((r) => r.compliance_score === 100).length;

  if (loading) {
    return (
      <div className="page-wrapper" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 1rem" }} />
          <div style={{ color: "var(--text-secondary)" }}>Loading results…</div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="page-wrapper">
        <div className="empty-state" style={{ marginTop: "4rem" }}>
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No results yet</div>
          <div className="empty-state-text">Upload and analyze some device configs first.</div>
          <button className="btn btn-primary" style={{ marginTop: "1.5rem" }} onClick={() => navigate("/upload")}>
            ↑ Upload Configs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-up">
      <div className="section-header">
        <h1 className="section-title">Compliance Dashboard</h1>
        <p className="section-subtitle">{totalDevices} device{totalDevices !== 1 ? "s" : ""} analyzed · CIS Benchmark v8</p>
      </div>

      {/* Summary stats */}
      <div className="grid-4" style={{ marginBottom: "2rem" }}>
        <StatCard icon="🖧" label="Devices Analyzed" value={totalDevices} color="var(--accent-primary)" bg="var(--accent-primary-glow)" />
        <StatCard icon="📊" label="Avg Compliance" value={`${avgScore}%`} color={avgScore >= 80 ? "var(--accent-green)" : avgScore >= 50 ? "var(--accent-amber)" : "var(--accent-red)"} bg={avgScore >= 80 ? "var(--accent-green-glow)" : "var(--accent-amber-glow)"} />
        <StatCard icon="✗" label="Total Failures" value={criticalFails} color="var(--accent-red)" bg="var(--accent-red-glow)" />
        <StatCard icon="✓" label="Fully Compliant" value={fullyCompliant} color="var(--accent-green)" bg="var(--accent-green-glow)" />
      </div>

      {/* Device cards */}
      <div className="section-header">
        <div className="section-title" style={{ fontSize: "1.1rem" }}>Device Overview</div>
      </div>
      <div className="grid-3" style={{ marginBottom: "2rem" }}>
        {results.map((r) => (
          <DeviceCard key={r.device_id} result={r} onClick={() => navigate(`/device/${r.device_id}`)} />
        ))}
      </div>

      {/* Drift Detection */}
      <div style={{ marginBottom: "2rem" }}>
        <DriftPanel />
      </div>

      {/* NL Query */}
      <NLQueryBox results={results} />
    </div>
  );
}

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bg }}>
        <span style={{ fontSize: "1.4rem" }}>{icon}</span>
      </div>
      <div>
        <div className="stat-value" style={{ color }}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function DeviceCard({ result, onClick }) {
  const vm = VENDOR_META[result.vendor] || { cls: "", icon: "●", label: result.vendor };
  const pass = result.rule_results.filter((r) => r.status === "PASS").length;
  const fail = result.rule_results.filter((r) => r.status === "FAIL").length;
  const unknown = result.rule_results.filter((r) => r.status === "UNKNOWN").length;

  return (
    <div className="device-card" onClick={onClick}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.3rem" }}>{result.device_name}</div>
          <span className={`vendor-chip ${vm.cls}`}>{vm.icon} {vm.label}</span>
        </div>
        <ScoreRing score={Math.round(result.compliance_score)} />
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <span className="badge badge-pass">✓ {pass} Pass</span>
        <span className="badge badge-fail">✗ {fail} Fail</span>
        {unknown > 0 && <span className="badge badge-unknown">? {unknown} Unknown</span>}
      </div>

      <div style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
        Click to view detailed rule breakdown →
      </div>
    </div>
  );
}
