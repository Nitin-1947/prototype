import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import Upload from "./pages/Upload";
import Dashboard from "./pages/Dashboard";
import DeviceDetail from "./pages/DeviceDetail";
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
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand" style={{ textDecoration: "none" }}>
        <div className="navbar-logo">🛡️</div>
        <div>
          <div className="navbar-title">NetSentinel</div>
          <div className="navbar-subtitle">AI Compliance Analyzer</div>
        </div>
      </NavLink>
      <div className="navbar-nav">
        <NavLink to="/upload" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          ↑ Upload
        </NavLink>
        <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          ▦ Dashboard
        </NavLink>
        <button className="btn btn-danger btn-sm" onClick={handleReset}>
          ↺ Reset
        </button>
      </div>
    </nav>
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
      </Routes>
    </BrowserRouter>
  );
}
