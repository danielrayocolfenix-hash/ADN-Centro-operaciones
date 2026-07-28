import React, { useEffect, useMemo } from "react";
import {
  BrowserRouter, Routes, Route, Navigate,
  useNavigate, useLocation,
} from "react-router-dom";
import "./index.css";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import DashboardPage from "./pages/DashboardPage";
import ClientesPage from "./pages/ClientesPage";
import MantenimientoPage from "./pages/MantenimientosPage";
import NovedadesPage from "./pages/NovedadesPage";
import NovedadDetallePage from "./pages/Novedades/NovedadDetallePage";
import InformesPage from "./pages/InformesPage";
import InformeBuilderPage from "./pages/InformeBuilder/InformeBuilderPage";
import MonitoreoPage from "./pages/MonitoreoPage";
import ConfiguracionSLAPage from "./pages/Administracion/ConfiguracionSLA";
import MetricasAnalistasPage from "./pages/Administracion/MetricasAnalistas";
import LoginPage from "./pages/LoginPage";
import { novedades } from "./data/mockData";
import { API_BASE } from "./config/api";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { setCsrfToken } from "./utils/csrf";

// Deriva el "page id" (usado por Sidebar/Topbar para resaltar la sección activa)
// a partir de la ruta actual. Las rutas anidadas (ej. /novedades/12) heredan
// el id de su sección padre.
function pageIdFromPath(pathname) {
  if (pathname === "/") return "dashboard";
  const primero = pathname.split("/").filter(Boolean)[0];
  if (pathname.startsWith("/administracion")) return "administracion";
  return primero || "dashboard";
}

function MonitoreoRoute() {
  const navigate = useNavigate();
  return (
    <MonitoreoPage
      onNovedad={(vehiculo) => navigate("/novedades", { state: { vehiculoPreseleccionado: vehiculo } })}
    />
  );
}

function NovedadesRoute() {
  const navigate = useNavigate();
  return (
    <NovedadesPage
      onGenerarInforme={(novedad) => navigate("/informes/generar", { state: { novedad } })}
    />
  );
}

function InformesRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  return (
    <InformesPage
      novedadParaInforme={state.novedadParaInforme || null}
      highlightId={state.highlightId || null}
      onClearNovedad={() => navigate(location.pathname, { replace: true, state: {} })}
    />
  );
}

function InformeGenerarRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <InformeBuilderPage
      data={location.state?.novedad || null}
      onVolver={() => navigate("/informes")}
      onGuardar={() => navigate("/informes")}
    />
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: 24, color: "var(--text-muted)" }}>Cargando sesión…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const alertCount = novedades.filter(
    n => n.prioridad === "Alta" && n.estado !== "Cerrada"
  ).length;

  const page = useMemo(() => pageIdFromPath(location.pathname), [location.pathname]);

  const handleNavigate = (id) => navigate(id === "dashboard" ? "/" : `/${id}`);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <Sidebar active={page} onNavigate={handleNavigate} alertCount={alertCount} user={user} onLogout={handleLogout} />
      <div className="main-area">
        <Topbar page={page} alertCount={alertCount} />
        <div className="page-content">
          <Routes>
            <Route path="/" element={<DashboardPage onNavigate={handleNavigate} />} />
            <Route path="/monitoreo" element={<MonitoreoRoute />} />
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/mantenimientos" element={<MantenimientoPage />} />
            <Route path="/novedades" element={<NovedadesRoute />} />
            <Route path="/novedades/:id" element={<NovedadDetallePage />} />
            <Route path="/informes" element={<InformesRoute />} />
            <Route path="/informes/generar" element={<InformeGenerarRoute />} />
            <Route
              path="/administracion/sla"
              element={user?.is_staff ? <ConfiguracionSLAPage /> : <Navigate to="/" replace />}
            />
            <Route
              path="/administracion/metricas-analistas"
              element={user?.is_staff ? <MetricasAnalistasPage /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Al montar la app (con o sin sesión iniciada) pedimos que Django setee
  // la cookie 'csrftoken'. Sin esto, el login mismo falla con 403 porque
  // nunca hay un token que mandar en el primer POST. También guardamos el
  // token del body como respaldo por si frontend y backend viven en hosts
  // distintos (túnel) y JS no puede leer la cookie entre dominios.
  useEffect(() => {
    fetch(`${API_BASE}/api/csrf/`, { credentials: "include" })
      .then(res => res.json())
      .then(data => setCsrfToken(data.csrftoken))
      .catch(err => console.error("No se pudo obtener el CSRF token:", err));
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <Shell />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
