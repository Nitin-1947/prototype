import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import Upload from "./pages/Upload";
import Dashboard from "./pages/Dashboard";
import DeviceDetail from "./pages/DeviceDetail";
import Operations from "./pages/Operations";
import { resetAll } from "./api/client";
import "./index.css";

function Navbar() {
  const navigate = useNavigate();

  const handleReset = async () => {
    if (!confirm("Clear all devices and results?")) return;
    await resetAll();
    navigate("/upload");
  };

  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand-lockup">
          <span className="brand-mark">shield</span>
          <span>
            <strong>NetSentinel</strong>
            <small>AI compliance workbench</small>
          </span>
        </NavLink>
        <div className="topbar-links">
          <NavLink to="/upload" className={({ isActive }) => `top-link${isActive ? " active" : ""}`}>Upload</NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => `top-link${isActive ? " active" : ""}`}>Dashboard</NavLink>
          <NavLink to="/dashboard" className="top-link">Device Details</NavLink>
        </div>
        <div className="topbar-actions">
          <span className="engine-status"><i /> Ollama LLM: Active</span>
          <button className="icon-button" title="Reset workspace" onClick={handleReset}>restart_alt</button>
        </div>
      </header>
      <aside className="tactical-rail">
        <div className="rail-emblem">verified_user</div>
        <div className="rail-label">NetSentinel SOC<span>Local LLM engine</span></div>
        <NavLink to="/dashboard" className={({ isActive }) => `rail-link${isActive ? " active" : ""}`}>
          <span>security</span><b>Workbench</b>
        </NavLink>
        <NavLink to="/upload" className={({ isActive }) => `rail-link${isActive ? " active" : ""}`}>
          <span>router</span><b>Audited Nodes</b>
        </NavLink>
        <NavLink to="/benchmarks" className={({ isActive }) => `rail-link${isActive ? " active" : ""}`}>
          <span>verified</span><b>CIS Benchmarks</b>
        </NavLink>
        <NavLink to="/telemetry" className={({ isActive }) => `rail-link${isActive ? " active" : ""}`}>
          <span>terminal</span><b>Telemetry Logs</b>
        </NavLink>
        <div className="rail-spacer" />
        <NavLink to="/settings" className={({ isActive }) => `rail-link${isActive ? " active" : ""}`}>
          <span>settings</span><b>Settings</b>
        </NavLink>
      </aside>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/device/:deviceId" element={<DeviceDetail />} />
        <Route path="/benchmarks" element={<Operations view="benchmarks" />} />
        <Route path="/telemetry" element={<Operations view="telemetry" />} />
        <Route path="/settings" element={<Operations view="settings" />} />
      </Routes>
    </BrowserRouter>
  );
}
