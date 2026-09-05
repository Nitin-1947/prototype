import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAllResults } from "../api/client";

const VENDOR_META = {
  cisco: { cls: "vendor-cisco", icon: "🔵", label: "Cisco IOS" },
  fortinet: { cls: "vendor-fortinet", icon: "🔴", label: "Fortinet" },
  juniper: { cls: "vendor-juniper", icon: "🟢", label: "Juniper" },
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button className="copy-btn" onClick={copy}>
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function ScoreRing({ score }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ position: "relative", width: 110, height: 110 }}>
      <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="55" cy="55" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dasharray 1.2s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color }}>
        <span style={{ fontSize: "1.4rem", fontWeight: 800 }}>{score}%</span>
        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Compliant</span>
      </div>
    </div>
  );
}

export default function DeviceDetail() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [expandedRule, setExpandedRule] = useState(null);

  useEffect(() => {
    getAllResults().then((all) => {
      const found = all.find((r) => r.device_id === deviceId);
      setResult(found || null);
    });
  }, [deviceId]);

  if (!result) {
    return (
      <div className="page-wrapper" style={{ textAlign: "center", paddingTop: "4rem" }}>
        <div className="spinner" style={{ margin: "0 auto 1rem", width: 40, height: 40 }} />
        <div style={{ color: "var(--text-secondary)" }}>Loading device…</div>
      </div>
    );
  }

  const vm = VENDOR_META[result.vendor] || { cls: "", icon: "●", label: result.vendor };
  const pass = result.rule_results.filter((r) => r.status === "PASS").length;
  const fail = result.rule_results.filter((r) => r.status === "FAIL").length;
  const unknown = result.rule_results.filter((r) => r.status === "UNKNOWN").length;

  const filtered =
    filter === "ALL"
      ? result.rule_results
      : result.rule_results.filter((r) => r.status === filter);

  const statusBadge = (status) => {
    if (status === "PASS") return <span className="badge badge-pass">✓ PASS</span>;
    if (status === "FAIL") return <span className="badge badge-fail">✗ FAIL</span>;
    return <span className="badge badge-unknown">? UNKNOWN</span>;
  };

  const confidenceColor = (c) => {
    if (c >= 0.8) return "var(--accent-green)";
    if (c >= 0.5) return "var(--accent-amber)";
    return "var(--accent-red)";
  };

  return (
    <div className="page-wrapper animate-fade-up">
      {/* Back */}
      <button className="btn btn-secondary btn-sm" onClick={() => navigate("/dashboard")} style={{ marginBottom: "1.5rem" }}>
        ← Back to Dashboard
      </button>

      {/* Device header */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          <ScoreRing score={Math.round(result.compliance_score)} />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.4rem" }}>{result.device_name}</h1>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
              <span className={`vendor-chip ${vm.cls}`}>{vm.icon} {vm.label}</span>
              <span className="badge badge-pass">✓ {pass}</span>
              <span className="badge badge-fail">✗ {fail}</span>
              {unknown > 0 && <span className="badge badge-unknown">? {unknown}</span>}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              CIS Benchmark v8 · {result.rule_results.length} rules evaluated
            </div>
          </div>

          {/* Extracted settings summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            {Object.entries(result.extracted_settings || {}).slice(0, 8).map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: "0.4rem" }}>
                <span style={{ color: "var(--text-muted)" }}>{k}:</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: v === true ? "var(--accent-green)" : v === false ? "var(--accent-red)" : "var(--text-code)" }}>
                  {v === null ? "null" : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {["ALL", "FAIL", "PASS", "UNKNOWN"].map((f) => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilter(f)}
          >
            {f} {f === "ALL" ? `(${result.rule_results.length})` : f === "FAIL" ? `(${fail})` : f === "PASS" ? `(${pass})` : `(${unknown})`}
          </button>
        ))}
      </div>

      {/* Rules table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Status</th>
              <th>Confidence</th>
              <th>Frameworks</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rule) => (
              <>
                <tr
                  key={rule.rule_id}
                  style={{ cursor: "pointer" }}
                  onClick={() => setExpandedRule(expandedRule === rule.rule_id ? null : rule.rule_id)}
                >
                  <td>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{rule.rule_name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{rule.rule_id}</div>
                  </td>
                  <td>{statusBadge(rule.status)}</td>
                  <td>
                    <div className="confidence-bar" style={{ minWidth: 100 }}>
                      <div className="confidence-track">
                        <div
                          className="confidence-fill"
                          style={{ width: `${Math.round(rule.confidence * 100)}%`, background: confidenceColor(rule.confidence) }}
                        />
                      </div>
                      <span>{Math.round(rule.confidence * 100)}%</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                      {rule.frameworks?.map((fw) => (
                        <span key={fw} className="badge" style={{ background: "var(--bg-glass)", color: "var(--text-secondary)", border: "1px solid var(--border)", fontSize: "0.68rem" }}>
                          {fw}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                    {expandedRule === rule.rule_id ? "▲" : "▼"}
                  </td>
                </tr>

                {expandedRule === rule.rule_id && (
                  <tr key={`${rule.rule_id}-expanded`}>
                    <td colSpan={5} style={{ padding: "1rem 1.5rem", background: "var(--bg-surface)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {/* Explanation */}
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
                            📝 Explanation
                          </div>
                          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{rule.explanation}</p>
                        </div>

                        {/* Config snippet */}
                        {rule.config_snippet && (
                          <div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
                              📋 Config Evidence
                            </div>
                            <div className="code-block" style={{ position: "relative" }}>
                              {rule.config_snippet}
                              <CopyButton text={rule.config_snippet} />
                            </div>
                          </div>
                        )}

                        {/* Fix command */}
                        {rule.fix_command && rule.status === "FAIL" && (
                          <div>
                            <div style={{ fontSize: "0.75rem", color: "var(--accent-green)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
                              🔧 Remediation Command ({result.vendor})
                            </div>
                            <div className="code-block" style={{ position: "relative", borderColor: "rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.04)" }}>
                              {rule.fix_command}
                              <CopyButton text={rule.fix_command} />
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">✓</div>
            <div className="empty-state-title">No {filter.toLowerCase()} rules</div>
          </div>
        )}
      </div>
    </div>
  );
}
