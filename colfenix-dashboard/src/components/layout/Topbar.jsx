import React, { useEffect, useRef, useState } from "react";
import { Bell, Clock, Sun, Moon, Flame, X, ChevronDown, Settings, LogOut } from "lucide-react";
import { useSiteConfig } from "../../context/SiteConfigContext";

const pageTitles = {
  dashboard: { title: "Dashboard Operativo", sub: "Resumen general del sistema de monitoreo" },
  monitoreo: { title: "Monitoreo en Vivo", sub: "Estado en tiempo real de unidades activas" },
  clientes: { title: "Gestión de Clientes", sub: "Empresas y operadores afiliados" },
  novedades: { title: "Registro de Novedades", sub: "Incidentes y eventos del sistema de transporte" },
  mantenimientos: { title: "Mantenimientos", sub: "Intervenciones técnicas sobre GPS, DVR y cámaras" },
  informes: { title: "Informes Legales", sub: "Documentos generados desde novedades" },
  administracion: { title: "Administración", sub: "Catálogos y configuración del sistema" },
};

// Metadata de cada tema: ícono + color de acento usado en el swatch activo.
// Centralizado aquí para no repetir lógica condicional en el render.
const THEMES = [
  { key: "dark",  label: "Oscuro", icon: Moon,  accent: "#818CF8" },
  { key: "fenix", label: "Fénix",  icon: Flame, accent: "#F97362" },
  { key: "light", label: "Claro",  icon: Sun,   accent: "#F59E0B" },
];

// Severidad → color, reutilizado por el dropdown de alertas.
const SEVERIDAD_COLOR = {
  alta: "var(--accent-danger)",
  media: "var(--accent-warn)",
  baja: "var(--accent-primary)",
};

const alertasMock = [
  { id: 1, severidad: "alta",  texto: "Pérdida de señal GPS — vehículo PAL-654",        hace: "hace 4 min" },
  { id: 2, severidad: "media", texto: "Cámara sin imagen — vehículo MNZ-789",           hace: "hace 22 min" },
  { id: 3, severidad: "baja",  texto: "Mantenimiento preventivo programado — VEH-006",  hace: "hace 1 h" },
];

function inicialesDe(nombre) {
  if (!nombre) return "??";
  const partes = nombre.trim().split(/\s+/);
  const primeras = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() || "");
  return primeras.join("") || "??";
}

function ThemeSelect({ theme, onChange }) {
  const current = THEMES.find(t => t.key === theme) || THEMES[0];
  const Icon = current.icon;

  return (
    <div
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 6,
        height: 28, padding: "0 8px 0 8px",
        borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      <Icon size={13} color={current.accent} style={{ flexShrink: 0 }} />
      <select
        aria-label="Seleccionar tema"
        value={theme}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
          background: "transparent", border: "none", outline: "none",
          color: "var(--text-secondary)", fontSize: 12, fontWeight: 500,
          cursor: "pointer", paddingRight: 4,
        }}
      >
        {THEMES.map(({ key, label }) => (
          <option key={key} value={key} style={{ color: "#111", background: "#fff" }}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

function AlertDropdown({ alertas, onClose }) {
  return (
    <div
      className="alert-dropdown"
      style={{
        position: "absolute", top: "calc(100% + 10px)", right: 0,
        width: 320, maxHeight: 360, overflowY: "auto",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-md, 10px)",
        boxShadow: "0 12px 28px -8px rgba(0,0,0,0.35)",
        zIndex: 60,
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Alertas
        </span>
        <button className="btn-icon" onClick={onClose} aria-label="Cerrar alertas">
          <X size={13} />
        </button>
      </div>

      {alertas.length === 0 ? (
        <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
          Sin alertas pendientes
        </div>
      ) : (
        <div>
          {alertas.map(a => (
            <div key={a.id} style={{
              display: "flex", gap: 10, padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                background: SEVERIDAD_COLOR[a.severidad] || "var(--text-muted)",
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.4 }}>{a.texto}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{a.hace}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Reemplaza lo que antes era el bloque fijo de usuario + botón de cerrar
// sesión al fondo del sidebar: ahora vive acá, agrupado en un único menú
// desplegable junto con el acceso a Configuración y Notificaciones.
function UserMenu({ user, alertCount, onNavigate, onLogout, onAbrirAlertas }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleEscape = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        className="user-menu-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label="Menú de usuario"
        aria-expanded={open}
      >
        <span className="user-menu-avatar">{inicialesDe(user?.nombre)}</span>
        <span className="user-menu-name">{user?.nombre || "—"}</span>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <span className="user-menu-avatar" style={{ width: 38, height: 38, fontSize: 14 }}>
              {inicialesDe(user?.nombre)}
            </span>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.nombre || "—"}
              </strong>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{user?.rol || "Sin rol asignado"}</span>
            </div>
          </div>

          <div className="user-menu-divider" />

          {user?.is_staff && (
            <button
              className="user-menu-item"
              onClick={() => { setOpen(false); onNavigate("administracion/sitio"); }}
            >
              <Settings size={15} /> Configuración del sitio
            </button>
          )}
          <button
            className="user-menu-item"
            onClick={() => { setOpen(false); onAbrirAlertas(); }}
          >
            <Bell size={15} /> Notificaciones
            {alertCount > 0 && <span className="user-menu-item-badge">{alertCount > 9 ? "9+" : alertCount}</span>}
          </button>

          <div className="user-menu-divider" />

          <button className="user-menu-item user-menu-item-danger" onClick={() => { setOpen(false); onLogout?.(); }}>
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export default function Topbar({ page, alertCount, alertas = alertasMock, user, onNavigate, onLogout }) {
  const { config } = useSiteConfig();
  const [now, setNow] = useState(new Date());
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const actionsRef = useRef(null);

  const info = pageTitles[page] || pageTitles.dashboard;
  const hora = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const fecha = now.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  // El reloj ahora se actualiza solo, en vez de quedar congelado en el momento del primer render.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.body.classList.remove("light-theme", "fenix-theme");
    if (theme === "light") document.body.classList.add("light-theme");
    if (theme === "fenix") document.body.classList.add("fenix-theme");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Cierra el dropdown de alertas al hacer clic afuera de toda la fila de
  // acciones (incluye el ícono de campana y el menú de usuario, ya que
  // "Notificaciones" ahí adentro también puede abrirlo).
  useEffect(() => {
    if (!alertsOpen) return;
    const handleClick = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setAlertsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [alertsOpen]);

  return (
    <div className="topbar">
      <div style={{ flex: 1 }}>
        <div className="topbar-title">{info.title}</div>
        <div className="topbar-subtitle">{info.sub}</div>
      </div>

      <div className="topbar-actions" ref={actionsRef}>
        {config.mostrar_reloj_topbar && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 999, background: "rgba(255,255,255,0.03)" }}>
            <Clock size={13} />
            <span>{fecha} · {hora}</span>
          </div>
        )}

        {config.mostrar_reloj_topbar && (config.mostrar_tema_topbar || config.mostrar_alertas_topbar || config.mostrar_estado_sistema_topbar) && (
          <div style={{ width: 1, height: 18, background: "var(--border)" }} />
        )}

        {config.mostrar_tema_topbar && <ThemeSelect theme={theme} onChange={setTheme} />}

        {config.mostrar_alertas_topbar && (
          <button
            className="btn-icon"
            onClick={() => setAlertsOpen(o => !o)}
            aria-label="Ver alertas"
            aria-expanded={alertsOpen}
            style={{ position: "relative" }}
          >
            <Bell size={16} />
            {alertCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                background: "var(--accent-danger)", color: "white",
                fontSize: 9, fontWeight: 700, borderRadius: "50%",
                width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
                border: "1.5px solid var(--bg-base, var(--bg-card))",
              }}>
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </button>
        )}

        {config.mostrar_estado_sistema_topbar && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-success)" }}>
            <span className="pulse-dot" />
            Sistema activo
          </div>
        )}

        <div style={{ width: 1, height: 18, background: "var(--border)" }} />

        <UserMenu
          user={user}
          alertCount={alertCount}
          onNavigate={onNavigate}
          onLogout={onLogout}
          onAbrirAlertas={() => setAlertsOpen(true)}
        />

        {alertsOpen && (
          <AlertDropdown alertas={alertas} onClose={() => setAlertsOpen(false)} />
        )}
      </div>
    </div>
  );
}
