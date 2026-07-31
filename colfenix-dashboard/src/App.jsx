import React, { useEffect, useMemo, useState } from "react";
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
import ConfiguracionSitioPage from "./pages/Administracion/ConfiguracionSitio";
import UsuariosPage from "./pages/Administracion/Usuarios";
import VistaClientePage from "./pages/Administracion/VistaCliente";
import VistaClienteDetallePage from "./pages/Administracion/VistaClienteDetalle";
import ManualPage from "./pages/ManualPage";
import LoginPage from "./pages/LoginPage";
import PortalShell from "./pages/Portal/PortalShell";
import { API_BASE } from "./config/api";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SiteConfigProvider } from "./context/SiteConfigContext";
import { setCsrfToken } from "./utils/csrf";
import { tienePermiso } from "./utils/permisos";
import { ShieldOff } from "lucide-react";

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
      onVerInforme={(informeId) => navigate("/informes", { state: { abrirInformeId: informeId } })}
    />
  );
}

function InformesRoute() {
  return <InformesPage />;
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

// Guarda cada ruta detrás de la vista.* correspondiente. La raíz ("/") es
// el destino de todos los demás redirects, así que si el propio usuario no
// tiene acceso al Dashboard se muestra un mensaje terminal en vez de
// redirigir a "/" de nuevo (evitaría un loop).
function Guard({ user, permiso, children, terminal = false }) {
  if (tienePermiso(user, permiso)) return children;
  return terminal ? <SinAccesoPage /> : <Navigate to="/" replace />;
}

function SinAccesoPage() {
  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 44, height: 44, borderRadius: "var(--radius-sm)",
            background: "var(--accent-danger-soft)", flexShrink: 0,
          }}>
            <ShieldOff size={20} color="var(--accent-danger)" />
          </span>
          <div>
            <h2 className="hero-title">No tienes acceso a esta sección</h2>
            <p className="hero-text">
              Tu usuario no tiene el permiso necesario para ver esta pantalla. Si crees que deberías tenerlo, pide a
              un administrador que te lo asigne desde Usuarios y permisos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dentro del único RequireAuth de más abajo: un usuario tipo=CLIENTE ve el
// Portal (su propio layout, sin el Sidebar/Topbar de staff que están
// construidos alrededor de permisos vista.* que no le aplican); cualquier
// otro usuario ve el Shell interno de siempre. No duplica RequireAuth ni
// toca LoginPage.jsx -- "/" simplemente resuelve distinto según user.tipo.
function AppShellRouter() {
  const { user } = useAuth();
  if (user?.tipo === "CLIENTE") {
    return <PortalShell />;
  }
  return (
    <SiteConfigProvider>
      <Shell />
    </SiteConfigProvider>
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

  // Antes calculado sobre datos mock (con campos que ni siquiera existen en
  // la API real) -- ahora sale de /api/novedades/alertas-criticas/count/,
  // misma fórmula (Prioridad_Alta sin cerrar) que ya usan NovedadesPage y
  // DashboardPage.
  const [alertCount, setAlertCount] = useState(0);
  useEffect(() => {
    if (!tienePermiso(user, "vista.novedades")) return;
    let cancelado = false;
    fetch(`${API_BASE}/api/novedades/alertas-criticas/count/`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { alertas_criticas: 0 }))
      .then((data) => { if (!cancelado) setAlertCount(data.alertas_criticas || 0); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [user]);

  const page = useMemo(() => pageIdFromPath(location.pathname), [location.pathname]);

  const handleNavigate = (id) => navigate(id === "dashboard" ? "/" : `/${id}`);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <Sidebar active={page} currentPath={location.pathname} onNavigate={handleNavigate} alertCount={alertCount} user={user} />
      <div className="main-area">
        <Topbar page={page} alertCount={alertCount} user={user} onNavigate={handleNavigate} onLogout={handleLogout} />
        <div className="page-content">
          <Routes>
            <Route path="/" element={
              <Guard user={user} permiso="vista.dashboard" terminal>
                <DashboardPage onNavigate={handleNavigate} />
              </Guard>
            } />
            <Route path="/monitoreo" element={
              <Guard user={user} permiso="vista.monitoreo"><MonitoreoRoute /></Guard>
            } />
            <Route path="/clientes" element={
              <Guard user={user} permiso="vista.clientes"><ClientesPage /></Guard>
            } />
            <Route path="/mantenimientos" element={
              <Guard user={user} permiso="vista.mantenimientos"><MantenimientoPage /></Guard>
            } />
            <Route path="/novedades" element={
              <Guard user={user} permiso="vista.novedades"><NovedadesRoute /></Guard>
            } />
            <Route path="/novedades/:id" element={
              <Guard user={user} permiso="vista.novedades"><NovedadDetallePage /></Guard>
            } />
            <Route path="/informes" element={
              <Guard user={user} permiso="vista.informes"><InformesRoute /></Guard>
            } />
            <Route path="/informes/generar" element={
              <Guard user={user} permiso="vista.informes"><InformeGenerarRoute /></Guard>
            } />
            <Route path="/administracion/sla" element={
              <Guard user={user} permiso="vista.administracion_novedades"><ConfiguracionSLAPage /></Guard>
            } />
            <Route path="/administracion/metricas-analistas" element={
              <Guard user={user} permiso="vista.administracion_metricas"><MetricasAnalistasPage /></Guard>
            } />
            <Route path="/administracion/sitio" element={
              <Guard user={user} permiso="vista.administracion_sitio"><ConfiguracionSitioPage /></Guard>
            } />
            <Route path="/administracion/usuarios" element={
              <Guard user={user} permiso="vista.administracion_usuarios"><UsuariosPage /></Guard>
            } />
            <Route path="/administracion/vista-cliente" element={
              <Guard user={user} permiso="vista.administracion_novedades"><VistaClientePage /></Guard>
            } />
            <Route path="/administracion/vista-cliente/:id" element={
              <Guard user={user} permiso="vista.administracion_novedades"><VistaClienteDetallePage /></Guard>
            } />
            <Route path="/manual" element={<ManualPage />} />
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
                <AppShellRouter />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
