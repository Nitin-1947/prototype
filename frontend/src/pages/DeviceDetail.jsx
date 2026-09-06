import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAllResults, simulateFix, simulateApply, getFixState } from "../api/client";     

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
  const [fixPreviews, setFixPreviews] = useState({});
  const [fixLoading, setFixLoading] = useState({});

  useEffect(() => {
    getAllResults().then((all) => {
      const found = all.find((r) => r.device_id === deviceId);
      setResult(found || null);
    });
    getFixState(deviceId).then((state) => {
      setFixPreviews((prev) => {
        const restored = { ...prev };
        Object.entries(state || {}).forEach(([ruleId, s]) => {
          if (!restored[ruleId]) restored[ruleId] = { state: s };
        });
        return restored;
      });
    }).catch(() => {});
  }, [deviceId]);

  const handlePreviewFix = async (ruleId) => {
    setFixLoading((p) => ({ ...p, [ruleId]: "preview" }));
    try {
      const preview = await simulateFix(deviceId, ruleId);
      setFixPreviews((p) => ({ ...p, [ruleId]: preview }));
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to preview fix.";
      setFixPreviews((p) => ({ ...p, [ruleId]: { error: msg } }));
    } finally {
      setFixLoading((p) => ({ ...p, [ruleId]: null }));
    }
  };

  const handleSimulateApply = async (ruleId) => {
    setFixLoading((p) => ({ ...p, [ruleId]: "apply" }));
    try {
      const applied = await simulateApply(deviceId, ruleId);
      setFixPreviews((p) => ({ ...p, [ruleId]: applied }));
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to apply fix.";
      setFixPreviews((p) => ({ ...p, [ruleId]: { ...(fixPreviews[ruleId] || {}), error: msg } }));
    } finally {
      setFixLoading((p) => ({ ...p, [ruleId]: null }));
    }
  };

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
              <th>Risk</th>
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <span className={`badge ${rule.risk_score >= 9 ? "badge-fail" : rule.risk_score >= 5 ? "badge-medium" : "badge-low"}`}>
                        {rule.risk_score ?? "-"}/12
                      </span>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.68rem", textTransform: "capitalize" }}>
                        {rule.severity || "unknown"} · exposure {rule.exposure_weight ?? "-"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                      {rule.frameworks?.map((fw) => (
                        <span key={`${fw.name}-${fw.control_id}`} className="badge" style={{ background: "var(--bg-glass)", color: "var(--text-secondary)", border: "1px solid var(--border)", fontSize: "0.68rem" }}>
                          {fw.name}: {fw.control_id}
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
                    <td colSpan={6} style={{ padding: "1rem 1.5rem", background: "var(--bg-surface)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span className="badge badge-unknown">Risk score: {rule.risk_score ?? "-"}/12</span>
                          <span className="badge badge-unknown">Severity: {rule.severity || "unknown"}</span>
                          <span className="badge badge-unknown">Exposure: {rule.exposure_weight ?? "-"}/3</span>
                        </div>
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

                                               {rule.fix_command && rule.status === "FAIL" && (() => {
                          const preview = fixPreviews[rule.rule_id];
                          const loading = fixLoading[rule.rule_id];
                          const state = preview?.state;

                          return (
                            <div>
                              <div style={{ fontSize: "0.75rem", color: "var(--accent-green)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
                                🔧 Remediation ({result.vendor})
                              </div>

                              {!preview && (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                  <div className="code-block" style={{ flex: 1, position: "relative", borderColor: "rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.04)" }}>
                                    {rule.fix_command}
                                    <CopyButton text={rule.fix_command} />
                                  </div>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    disabled={loading === "preview"}
                                    onClick={(e) => { e.stopPropagation(); handlePreviewFix(rule.rule_id); }}
                                  >
                                    {loading === "preview" ? "Checking…" : "🔍 Preview Fix"}
                                  </button>
                                </div>
                              )}

                              {preview?.error && (
                                <div className="alert alert-error" style={{ marginBottom: "0.5rem" }}>{preview.error}</div>
                              )}

                              {preview && !preview.error && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                  {(preview.before || preview.after) && (
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                                      <div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>BEFORE</div>
                                        <div className="code-block" style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.05)", fontSize: "0.78rem" }}>
                                          − {preview.before || rule.config_snippet}
                                        </div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>AFTER</div>
                                        <div className="code-block" style={{ borderColor: "rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.05)", fontSize: "0.78rem", whiteSpace: "pre-wrap" }}>
                                          + {preview.after || rule.fix_command}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {preview.lockout_risk && (
                                    <div className="alert alert-error" style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                                      <span>⚠️</span>
                                      <div>
                                        <strong>Lockout risk detected.</strong> {preview.lockout_warning}
                                      </div>
                                    </div>
                                  )}
                                  {!preview.lockout_risk && preview.lockout_warning && (
                                    <div className="alert" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: "var(--accent-amber)", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                                      <span>ℹ️</span>
                                      <div>{preview.lockout_warning}</div>
                                    </div>
                                  )}

                                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    {state === "simulated_applied" ? (
                                      <span className="badge badge-pass">✓ Simulated Applied — no real device was touched</span>
                                    ) : (
                                      <button
                                        className={`btn btn-sm ${preview.lockout_risk ? "btn-secondary" : "btn-primary"}`}
                                        disabled={loading === "apply"}
                                        onClick={(e) => { e.stopPropagation(); handleSimulateApply(rule.rule_id); }}
                                      >
                                        {loading === "apply"
                                          ? "Applying…"
                                          : preview.lockout_risk
                                          ? "⚠️ Simulate Apply Anyway"
                                          : "✅ Simulate Apply"}
                                      </button>
                                    )}
                                    <button
                                      className="btn btn-sm btn-secondary"
                                      onClick={(e) => { e.stopPropagation(); handlePreviewFix(rule.rule_id); }}
                                    >
                                      🔄 Re-check
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
