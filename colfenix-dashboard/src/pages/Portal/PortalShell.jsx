import React from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { LogOut, Compass } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import PortalNovedadesPage from "./PortalNovedadesPage";
import PortalNovedadDetallePage from "./PortalNovedadDetallePage";
import NotificacionesBell from "./NotificacionesBell";

// Layout propio del portal de cliente -- deliberadamente NO reutiliza
// Sidebar/Topbar (están construidos alrededor de los permisos vista.* del
// staff, que no aplican acá) ni SiteConfigProvider (esa configuración es de
// branding del dashboard interno). Reutiliza sí las clases .app-shell/
// .main-area/.topbar/.page-content ya existentes para el mismo layout de
// altura completa, y toda la vocabulario visual (.card/.badge/.btn) del
// resto de la app.
export default function PortalShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <div className="main-area">
        <div className="topbar">
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: "var(--radius-sm)",
              background: "var(--accent-glow)", color: "var(--accent-primary)", flexShrink: 0,
            }}>
              <Compass size={17} />
            </span>
            <div>
              <div className="topbar-title">Portal de cliente</div>
              <div className="topbar-subtitle">{user?.cliente || user?.nombre}</div>
            </div>
          </div>
          <NotificacionesBell />
          <button className="btn-icon" onClick={handleLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut size={16} />
          </button>
        </div>
        <div className="page-content">
          <Routes>
            <Route path="/" element={<PortalNovedadesPage />} />
            <Route path="/novedades/:id" element={<PortalNovedadDetallePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
