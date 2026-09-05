const VIEWS = {
  benchmarks: {
    icon: "verified",
    eyebrow: "CONTROL LIBRARY",
    title: "CIS Benchmarks",
    description: "The active hardening controls used to evaluate analyzed device configurations.",
    cards: [
      ["CIS-1.1", "Disable Telnet Access", "HIGH", "Management access must use encrypted protocols only."],
      ["CIS-1.2", "Enforce SSH Version 2", "HIGH", "Only SSHv2 should be permitted for encrypted management."],
      ["CIS-1.5", "Enable Logging", "HIGH", "System logging supports audit trails and incident response."],
      ["CIS-1.8", "Use SNMPv3 Only", "HIGH", "Legacy community strings must not expose management traffic."],
      ["CIS-1.14", "Set Idle Session Timeout", "MEDIUM", "Inactive management sessions should close automatically."],
    ],
  },
  telemetry: {
    icon: "terminal",
    eyebrow: "SYSTEM ACTIVITY",
    title: "Telemetry Logs",
    description: "A lightweight activity view for the local analysis engine and workspace events.",
    cards: [
      ["ENGINE", "Ollama local inference", "ONLINE", "The local model endpoint is configured for configuration extraction."],
      ["SCORING", "Deterministic rule evaluation", "READY", "CIS controls are evaluated locally after settings extraction."],
      ["STORE", "In-memory result store", "ACTIVE", "Results remain available until the backend process restarts."],
      ["API", "FastAPI service", "READY", "Upload, analysis, drift, and query routes are available."],
    ],
  },
  settings: {
    icon: "settings",
    eyebrow: "WORKSPACE CONFIGURATION",
    title: "Settings",
    description: "Runtime settings for this local NetSentinel workbench.",
    cards: [
      ["MODEL", "Ollama model", "LOCAL", "Configured through OLLAMA_MODEL in backend/.env."],
      ["TRANSPORT", "Local model endpoint", "HTTP", "Configured through OLLAMA_URL in backend/.env."],
      ["DATA", "Storage mode", "MEMORY", "The prototype intentionally uses an in-memory store."],
      ["ACCESS", "CORS mode", "DEMO", "Local demo access is permissive and should be restricted before deployment."],
    ],
  },
};

export default function Operations({ view }) {
  const content = VIEWS[view];
  return (
    <main className="page-wrapper operations-page animate-fade-up">
      <div className="operations-heading">
        <div className="operations-icon">{content.icon}</div>
        <div>
          <div className="eyebrow">{content.eyebrow}</div>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
      </div>
      <div className="operations-grid">
        {content.cards.map(([code, title, status, description]) => (
          <article className="operations-card" key={code}>
            <div className="operations-card-top">
              <span className="mono-label">{code}</span>
              <span className={`ops-status ops-${status.toLowerCase()}`}>{status}</span>
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
