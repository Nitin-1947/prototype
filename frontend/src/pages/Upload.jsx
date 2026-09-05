import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getSampleConfig, uploadConfig, analyzeDevice } from "../api/client";

const VENDORS = [
  { value: "cisco", label: "Cisco IOS", icon: "🔵", cls: "vendor-cisco" },
  { value: "fortinet", label: "Fortinet FortiOS", icon: "🔴", cls: "vendor-fortinet" },
  { value: "juniper", label: "Juniper JunOS", icon: "🟢", cls: "vendor-juniper" },
];

export default function Upload() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([
    { id: Date.now(), vendor: "cisco", name: "", configText: "", status: "idle" },
  ]);
  const [globalStatus, setGlobalStatus] = useState("idle"); // idle | analyzing | done | error
  const [error, setError] = useState(null);

  const addDevice = () =>
    setDevices((d) => [...d, { id: Date.now(), vendor: "cisco", name: "", configText: "", status: "idle" }]);

  const removeDevice = (id) => setDevices((d) => d.filter((dev) => dev.id !== id));

  const updateDevice = (id, patch) =>
    setDevices((d) => d.map((dev) => (dev.id === id ? { ...dev, ...patch } : dev)));

  const loadSample = async (id, vendor) => {
    try {
      const { config_text } = await getSampleConfig(vendor);
      updateDevice(id, { configText: config_text, vendor });
    } catch {
      setError("Failed to load sample config. Is the backend running?");
    }
  };

  const handleFileUpload = (id, file) => {
    const reader = new FileReader();
    reader.onload = (e) => updateDevice(id, { configText: e.target.result, name: file.name });
    reader.readAsText(file);
  };

  const analyzeAll = async () => {
    if (devices.every((d) => !d.configText.trim())) {
      setError("Please paste or load at least one config.");
      return;
    }
    setError(null);
    setGlobalStatus("analyzing");
    let failed = false;

    for (const dev of devices) {
      if (!dev.configText.trim()) continue;
      try {
        updateDevice(dev.id, { status: "uploading" });
        const { device_id } = await uploadConfig(
          dev.vendor,
          dev.configText,
          dev.name || `${dev.vendor.charAt(0).toUpperCase() + dev.vendor.slice(1)}-Device-${Math.floor(Math.random() * 900 + 100)}`
        );
        updateDevice(dev.id, { status: "analyzing", device_id });
        await analyzeDevice(device_id);
        updateDevice(dev.id, { status: "done" });
      } catch (e) {
        failed = true;
        updateDevice(dev.id, { status: "error" });
        setError(`Analysis failed: ${e?.response?.data?.detail || e.message}`);
      }
    }

    setGlobalStatus(failed ? "error" : "done");
    if (!failed) navigate("/dashboard");
  };

  const allEmpty = devices.every((d) => !d.configText.trim());

  return (
    <div className="page-wrapper animate-fade-up">
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🛡️</div>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem", background: "linear-gradient(135deg, #fff 0%, var(--accent-cyan) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Upload Device Configs
        </h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: 520, margin: "0 auto", fontSize: "0.95rem" }}>
          Paste or upload raw firewall/router configs. NetSentinel's AI will parse any vendor syntax — no manual rules needed.
        </p>
      </div>

      {/* Vendor selection cards */}
      <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        {VENDORS.map((v) => (
          <div key={v.value} className={`vendor-chip ${v.cls}`} style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}>
            {v.icon} {v.label}
          </div>
        ))}
      </div>

      {/* Device rows */}
      {devices.map((dev, idx) => (
        <DeviceRow
          key={dev.id}
          dev={dev}
          idx={idx}
          onUpdate={(patch) => updateDevice(dev.id, patch)}
          onRemove={() => removeDevice(dev.id)}
          onLoadSample={(vendor) => loadSample(dev.id, vendor)}
          onFileUpload={(file) => handleFileUpload(dev.id, file)}
        />
      ))}

      {/* Add device */}
      <button className="btn btn-secondary" onClick={addDevice} style={{ marginBottom: "1.5rem", width: "100%" }}>
        + Add Another Device
      </button>

      {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>⚠️ {error}</div>}

      {/* Analyze button */}
      <button
        className="btn btn-primary btn-lg"
        onClick={analyzeAll}
        disabled={globalStatus === "analyzing" || allEmpty}
        style={{ width: "100%", justifyContent: "center", fontSize: "1rem" }}
      >
        {globalStatus === "analyzing" ? (
          <><div className="spinner" /> Analyzing with AI…</>
        ) : (
          "🚀 Analyze All Devices"
        )}
      </button>
      <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.75rem" }}>
        Powered by Gemini AI · CIS Benchmark v8 · Zero-parser config understanding
      </p>
    </div>
  );
}

function DeviceRow({ dev, idx, onUpdate, onRemove, onLoadSample, onFileUpload }) {
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);

  const statusColor = {
    idle: "var(--text-muted)",
    uploading: "var(--accent-amber)",
    analyzing: "var(--accent-primary)",
    done: "var(--accent-green)",
    error: "var(--accent-red)",
  }[dev.status] || "var(--text-muted)";

  const statusIcon = { idle: "●", uploading: "↑", analyzing: "⟳", done: "✓", error: "✗" }[dev.status] || "●";

  return (
    <div className="card" style={{ marginBottom: "1.25rem", position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-secondary)" }}>
          Device {idx + 1}
        </div>
        <span style={{ color: statusColor, fontWeight: 600, fontSize: "0.8rem" }}>
          {statusIcon} {dev.status.toUpperCase()}
        </span>

        <div style={{ flex: 1 }} />

        {/* Vendor selector */}
        <select
          className="form-select"
          style={{ width: "auto" }}
          value={dev.vendor}
          onChange={(e) => onUpdate({ vendor: e.target.value })}
        >
          {VENDORS.map((v) => <option key={v.value} value={v.value}>{v.icon} {v.label}</option>)}
        </select>

        {/* Device name */}
        <input
          className="form-input"
          style={{ width: 200 }}
          placeholder="Device name (optional)"
          value={dev.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />

        {/* Load sample */}
        <button className="btn btn-secondary btn-sm" onClick={() => onLoadSample(dev.vendor)}>
          📄 Load Sample
        </button>

        {/* File upload */}
        <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current.click()}>
          📁 Upload File
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.cfg,.conf,.log"
          style={{ display: "none" }}
          onChange={(e) => e.target.files[0] && onFileUpload(e.target.files[0])}
        />

        {/* Remove */}
        {idx > 0 && (
          <button className="btn btn-danger btn-sm" onClick={onRemove}>✕</button>
        )}
      </div>

      {/* Drop zone / textarea */}
      <div
        className={`dropzone${dragging ? " active" : ""}`}
        style={{ padding: "1rem", borderStyle: dev.configText ? "solid" : "dashed" }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFileUpload(f); }}
        onClick={() => !dev.configText && fileRef.current.click()}
      >
        {!dev.configText ? (
          <>
            <div className="dropzone-icon">📋</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Drag & drop config file or click to upload
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Or use "Load Sample" to use a demo config
            </div>
          </>
        ) : (
          <textarea
            className="form-textarea"
            style={{ border: "none", background: "transparent", outline: "none", width: "100%" }}
            value={dev.configText}
            onChange={(e) => onUpdate({ configText: e.target.value })}
            placeholder="Paste your config here…"
            onClick={(e) => e.stopPropagation()}
            rows={14}
          />
        )}
      </div>

      {dev.configText && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onUpdate({ configText: "" })}>
            ✕ Clear
          </button>
        </div>
      )}
    </div>
  );
}
