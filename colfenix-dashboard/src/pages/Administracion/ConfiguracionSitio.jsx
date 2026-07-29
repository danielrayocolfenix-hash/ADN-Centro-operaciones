import React, { useEffect, useState } from "react";
import {
  Image as ImageIcon, Save, Trash2, ChevronDown, ChevronUp,
  LayoutPanelTop, Clock, Palette, Bell, Activity,
} from "lucide-react";
import { API_BASE } from "../../config/api";
import { getCsrfToken } from "../../utils/csrf";
import { useSiteConfig } from "../../context/SiteConfigContext";
import Toast from "../../components/ui/Toast";

// Mismo patrón que ConfiguracionSLA.jsx: cada bloque es una configuración
// distinta (identidad de marca vs. qué se ve en el topbar), con su propio
// ícono/título/subtítulo y colapsable para no scrollear de más.
function CollapsibleSection({ icon, title, subtitle, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left",
          marginBottom: open ? 16 : 0, fontFamily: "inherit",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: "var(--radius-sm)", background: "var(--bg-surface)",
            border: "1px solid var(--border)", flexShrink: 0,
          }}>
            {icon}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
            {subtitle && (
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 400 }}>{subtitle}</span>
            )}
          </span>
        </span>
        {open ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </button>
      {open && children}
    </div>
  );
}

const OPCIONES_TOPBAR = [
  { key: "mostrar_reloj_topbar", label: "Fecha y hora", desc: "El reloj con la fecha actual", icon: Clock },
  { key: "mostrar_tema_topbar", label: "Selector de tema", desc: "Oscuro / Fénix / Claro", icon: Palette },
  { key: "mostrar_alertas_topbar", label: "Campana de alertas", desc: "Acceso rápido a notificaciones (siempre queda disponible también desde el menú de usuario)", icon: Bell },
  { key: "mostrar_estado_sistema_topbar", label: "Indicador \"Sistema activo\"", desc: "Punto verde de estado", icon: Activity },
];

function IdentidadCard({ toast }) {
  const { config, refrescar } = useSiteConfig();
  const [nombreSitio, setNombreSitio] = useState(config.nombre_sitio);
  const [descripcion, setDescripcion] = useState(config.descripcion_sidebar);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [quitarLogo, setQuitarLogo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setNombreSitio(config.nombre_sitio);
    setDescripcion(config.descripcion_sidebar);
  }, [config.nombre_sitio, config.descripcion_sidebar]);

  const elegirLogo = (file) => {
    if (!file) return;
    setLogoFile(file);
    setQuitarLogo(false);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const quitar = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setQuitarLogo(true);
  };

  const logoActualUrl = config.logo ? `${API_BASE}${config.logo}` : null;
  const mostrarPreview = logoPreview || (!quitarLogo ? logoActualUrl : null);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const form = new FormData();
      form.append("nombre_sitio", nombreSitio.trim());
      form.append("descripcion_sidebar", descripcion.trim());
      if (logoFile) form.append("logo", logoFile);
      if (quitarLogo) form.append("quitar_logo", "true");

      const res = await fetch(`${API_BASE}/api/admin/configuracion-sitio/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: form,
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo guardar la identidad del sitio");
      setLogoFile(null);
      setLogoPreview(null);
      setQuitarLogo(false);
      await refrescar();
      toast("Identidad del sitio actualizada", "success");
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <CollapsibleSection
      icon={<ImageIcon size={15} color="var(--accent-primary)" />}
      title="Identidad del sitio"
      subtitle="Logo y nombre que se muestran en el sidebar"
    >
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
        El logo y el nombre se ven en la parte superior del sidebar, en todo el dashboard, para cualquier usuario.
      </p>

      <form onSubmit={guardar}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 18 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
            background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", flexShrink: 0,
          }}>
            {mostrarPreview ? (
              <img src={mostrarPreview} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <ImageIcon size={22} color="var(--text-muted)" />
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", width: "fit-content" }}>
              <ImageIcon size={12} /> Subir logo
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => elegirLogo(e.target.files?.[0])}
              />
            </label>
            {mostrarPreview && (
              <button type="button" className="btn btn-sm btn-secondary" onClick={quitar} style={{ width: "fit-content" }}>
                <Trash2 size={12} /> Quitar logo
              </button>
            )}
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>PNG o SVG con fondo transparente recomendado.</span>
          </div>
        </div>

        <div className="form-grid" style={{ marginBottom: 18 }}>
          <div className="form-group">
            <label className="form-label">Nombre del sitio<span className="req"> *</span></label>
            <input
              className="form-input"
              value={nombreSitio}
              onChange={(e) => setNombreSitio(e.target.value)}
              placeholder="Ej. COLFENIX GPS"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Subtítulo del sidebar</label>
            <input
              className="form-input"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Centro de operaciones"
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={guardando}>
          <Save size={14} /> {guardando ? "Guardando..." : "Guardar identidad"}
        </button>
      </form>
    </CollapsibleSection>
  );
}

function OpcionesTopbarCard({ toast }) {
  const { config, refrescar } = useSiteConfig();
  const [valores, setValores] = useState(config);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setValores(config); }, [config]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const form = new FormData();
      OPCIONES_TOPBAR.forEach(({ key }) => form.append(key, valores[key] ? "true" : "false"));

      const res = await fetch(`${API_BASE}/api/admin/configuracion-sitio/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: form,
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo guardar");
      await refrescar();
      toast("Opciones del topbar actualizadas", "success");
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <CollapsibleSection
      icon={<LayoutPanelTop size={15} color="var(--accent-primary)" />}
      title="Opciones del topbar"
      subtitle="Qué widgets ve todo el equipo en la barra superior"
    >
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
        El menú de usuario (perfil, configuración, notificaciones, cerrar sesión) siempre está disponible — estas
        opciones solo controlan los accesos rápidos adicionales de la barra superior.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 18 }}>
        {OPCIONES_TOPBAR.map(({ key, label, desc, icon: Icon }) => (
          <label
            key={key}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
              borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", cursor: "pointer",
            }}
          >
            <Icon size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)" }}>{desc}</span>
            </span>
            <input
              type="checkbox"
              checked={!!valores[key]}
              onChange={(e) => setValores((v) => ({ ...v, [key]: e.target.checked }))}
              style={{ accentColor: "var(--accent-primary)", width: 16, height: 16, flexShrink: 0 }}
            />
          </label>
        ))}
      </div>

      <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
        <Save size={14} /> {guardando ? "Guardando..." : "Guardar opciones"}
      </button>
    </CollapsibleSection>
  );
}

export default function ConfiguracionSitioPage() {
  const [toastState, setToastState] = useState(null);
  const toast = (msg, type) => setToastState({ msg, type });

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <div className="hero-eyebrow">Administración · Configuración del sitio</div>
          <h2 className="hero-title">Marca y barra superior</h2>
          <p className="hero-text">
            Configuración global visible para todo el equipo: el logo y el nombre del sidebar, y qué widgets se
            muestran en el topbar. Los cambios se aplican de inmediato para todos los usuarios.
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <IdentidadCard toast={toast} />
        <OpcionesTopbarCard toast={toast} />
      </div>

      {toastState && <Toast message={toastState.msg} type={toastState.type} onClose={() => setToastState(null)} />}
    </div>
  );
}
