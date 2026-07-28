import React, { useEffect, useState } from "react";
import {
  Clock, Save, Plus, Tag, Power, CheckCircle2, XCircle, Timer,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { API_BASE } from "../../config/api";
import { getCsrfToken } from "../../utils/csrf";
import Toast from "../../components/ui/Toast";

// Contenedor colapsable compartido por todas las secciones de esta pantalla:
// cada una es una configuración/situación distinta (horario, categorías,
// SLA por tipo, motivos...), así que cada una lleva su propio ícono, título
// y subtítulo para que se distingan de un vistazo, y se puede contraer para
// no tener que scrollear entre todas cuando solo se necesita una.
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

const DIAS = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

const PRIORIDADES = [
  { value: "Prioridad_Alta", label: "Alta" },
  { value: "Prioridad_Media", label: "Media" },
  { value: "Prioridad_Baja", label: "Baja" },
];

function PrioridadBadge({ text }) {
  const t = String(text).toLowerCase();
  let style = { bg: "var(--accent-glow)", color: "var(--accent-primary)" };
  if (t.includes("media")) style = { bg: "var(--accent-warn-soft)", color: "var(--accent-warn)" };
  if (t.includes("baja")) style = { bg: "var(--accent-success-soft)", color: "var(--accent-success)" };
  if (t.includes("alta")) style = { bg: "var(--accent-danger-soft)", color: "var(--accent-danger)" };
  return (
    <span className="badge" style={{ background: style.bg, color: style.color }}>
      {text}
    </span>
  );
}

function CategoriasCard({ toast, categorias, loading, onCreada }) {
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);

  const crear = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCreando(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/categorias-tipo-informe/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo crear la categoría");
      setNombre("");
      toast("Categoría creada", "success");
      onCreada();
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setCreando(false);
    }
  };

  return (
    <CollapsibleSection
      icon={<Tag size={15} color="var(--accent-primary)" />}
      title="Categorías de informe"
      subtitle="Agrupan los tipos de informe en el formulario de Registrar novedad"
    >
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
        Agrupan los tipos de informe en el selector de "Registrar novedad" — ej. "Novedad Específica" agrupando
        Choque simple, Queja de pasajero, Fallecido...
      </p>
      <form onSubmit={crear} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          className="form-input"
          placeholder="Nombre de la categoría, ej. Novedad Específica"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={creando}>
          <Plus size={14} /> {creando ? "Creando..." : "Agregar categoría"}
        </button>
      </form>
      {loading ? (
        <div style={{ color: "var(--text-muted)" }}>Cargando…</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {categorias.map((c) => (
            <span key={c.id} className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}>
              {c.nombre}
            </span>
          ))}
          {categorias.length === 0 && (
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Sin categorías todavía.</span>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

function HorarioLaboralCard({ toast }) {
  const [horario, setHorario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/horario-laboral/`, { credentials: "include" });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
      setHorario(await res.json());
    } catch (err) {
      toast(`Error cargando el horario laboral: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/horario-laboral/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify(horario),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo guardar el horario");
      toast("Horario laboral actualizado", "success");
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <CollapsibleSection
      icon={<Clock size={15} color="var(--accent-primary)" />}
      title="Horario laboral"
      subtitle="Cuándo corre el conteo del SLA de revisión"
    >
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
        Define en qué días y horas corre el conteo de tiempo del SLA de revisión de DVR. Fuera de este horario el
        tiempo no avanza.
      </p>
      {loading || !horario ? (
        <div style={{ color: "var(--text-muted)" }}>Cargando…</div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
            {DIAS.map((d) => (
              <label key={d.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!!horario[d.key]}
                  onChange={(e) => setHorario((h) => ({ ...h, [d.key]: e.target.checked }))}
                  style={{ accentColor: "var(--accent-primary)", width: 14, height: 14 }}
                />
                {d.label}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Hora de inicio</label>
              <input
                type="time"
                className="form-input"
                value={horario.hora_inicio}
                onChange={(e) => setHorario((h) => ({ ...h, hora_inicio: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Hora de fin</label>
              <input
                type="time"
                className="form-input"
                value={horario.hora_fin}
                onChange={(e) => setHorario((h) => ({ ...h, hora_fin: e.target.value }))}
              />
            </div>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
              <Save size={14} /> {guardando ? "Guardando..." : "Guardar horario"}
            </button>
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}

const NUEVO_TIPO_VACIO = { nombre: "", categoria_informe_id: "", nivel_prioridad: "Prioridad_Media", tiempo_maximo_horas: "" };

function TiposInformeCard({ toast, categorias }) {
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardandoId, setGuardandoId] = useState(null);
  const [nuevo, setNuevo] = useState(NUEVO_TIPO_VACIO);
  const [creando, setCreando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/tipos-informe/`, { credentials: "include" });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
      setTipos(await res.json());
    } catch (err) {
      toast(`Error cargando tipos de informe: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const crear = async (e) => {
    e.preventDefault();
    if (!nuevo.nombre.trim() || !nuevo.categoria_informe_id) {
      toast("El nombre y la categoría son obligatorios", "error");
      return;
    }
    setCreando(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/tipos-informe/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({
          nombre: nuevo.nombre.trim(),
          categoria_informe_id: Number(nuevo.categoria_informe_id),
          nivel_prioridad: nuevo.nivel_prioridad,
          tiempo_maximo_horas: nuevo.tiempo_maximo_horas ? Number(nuevo.tiempo_maximo_horas) : null,
        }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo crear el tipo de informe");
      setNuevo(NUEVO_TIPO_VACIO);
      toast("Tipo de informe creado", "success");
      await cargar();
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setCreando(false);
    }
  };

  const actualizarHoras = (id, valor) => {
    setTipos((ts) => ts.map((t) => (t.id === id ? { ...t, tiempo_maximo_horas: valor } : t)));
  };

  const guardar = async (tipo) => {
    setGuardandoId(tipo.id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/tipos-informe/${tipo.id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ tiempo_maximo_horas: tipo.tiempo_maximo_horas || null }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo guardar");
      toast(`SLA de "${tipo.nombre}" actualizado`, "success");
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <CollapsibleSection
      icon={<Timer size={15} color="var(--accent-primary)" />}
      title="Tiempo máximo por tipo de informe (SLA)"
      subtitle="Límite de horas hábiles desde ENCOLADO hasta TERMINADO"
    >
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
        Horas hábiles máximas desde que una novedad entra en <b>ENCOLADO</b> hasta que llega a <b>TERMINADO</b>. Deja
        el campo vacío si ese tipo de informe no debe tener un límite de tiempo.
      </p>

      <form onSubmit={crear} className="form-grid" style={{ marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Nombre<span className="req"> *</span></label>
          <input
            className="form-input"
            placeholder="Ej. Choque simple"
            value={nuevo.nombre}
            onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Categoría<span className="req"> *</span></label>
          <select
            className="form-select"
            value={nuevo.categoria_informe_id}
            onChange={(e) => setNuevo((n) => ({ ...n, categoria_informe_id: e.target.value }))}
            required
          >
            <option value="">Seleccione...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Prioridad</label>
          <select
            className="form-select"
            value={nuevo.nivel_prioridad}
            onChange={(e) => setNuevo((n) => ({ ...n, nivel_prioridad: e.target.value }))}
          >
            {PRIORIDADES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Tiempo máximo (horas hábiles)</label>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Sin límite"
            className="form-input"
            value={nuevo.tiempo_maximo_horas}
            onChange={(e) => setNuevo((n) => ({ ...n, tiempo_maximo_horas: e.target.value }))}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <button type="submit" className="btn btn-primary" disabled={creando}>
            <Plus size={14} /> {creando ? "Creando..." : "Agregar tipo de informe"}
          </button>
        </div>
      </form>

      {loading && <div style={{ color: "var(--text-muted)" }}>Cargando…</div>}
      {!loading && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo de informe</th>
              <th>Categoría</th>
              <th>Prioridad</th>
              <th>Tiempo máximo (horas hábiles)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tipos.map((t) => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.nombre}</td>
                <td>{t.categoria_informe || "—"}</td>
                <td><PrioridadBadge text={t.nivel_prioridad_display} /></td>
                <td>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Sin límite"
                    className="form-input"
                    style={{ width: 120 }}
                    value={t.tiempo_maximo_horas ?? ""}
                    onChange={(e) => actualizarHoras(t.id, e.target.value ? Number(e.target.value) : null)}
                  />
                </td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => guardar(t)} disabled={guardandoId === t.id}>
                    <Save size={12} /> {guardandoId === t.id ? "Guardando..." : "Guardar"}
                  </button>
                </td>
              </tr>
            ))}
            {tipos.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                Sin tipos de informe registrados.
              </td></tr>
            )}
          </tbody>
        </table>
      )}
    </CollapsibleSection>
  );
}

// Catálogo de motivos (Negativa o Positiva, según `endpointBase`) — mismo
// patrón de crear + tabla + activar/desactivar, parametrizado para no
// duplicar el componente entre los dos catálogos.
function MotivosCard({ toast, icono, titulo, subtitulo, descripcion, placeholderNombre, endpointBase }) {
  const [motivos, setMotivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [descripcionNueva, setDescripcionNueva] = useState("");
  const [creando, setCreando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/${endpointBase}/`, { credentials: "include" });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
      setMotivos(await res.json());
    } catch (err) {
      toast(`Error cargando motivos: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const crear = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCreando(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/${endpointBase}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcionNueva.trim() }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo crear el motivo");
      setNombre("");
      setDescripcionNueva("");
      toast("Motivo creado", "success");
      await cargar();
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setCreando(false);
    }
  };

  const toggleActivo = async (motivo) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/${endpointBase}/${motivo.id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ activo: !motivo.activo }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo actualizar");
      setMotivos((ms) => ms.map((m) => (m.id === motivo.id ? { ...m, activo: !m.activo } : m)));
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    }
  };

  return (
    <CollapsibleSection icon={icono} title={titulo} subtitle={subtitulo}>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>{descripcion}</p>
      <form onSubmit={crear} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <input
          className="form-input"
          placeholder={placeholderNombre}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <input
          className="form-input"
          placeholder="Descripción (opcional)"
          value={descripcionNueva}
          onChange={(e) => setDescripcionNueva(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={creando} style={{ alignSelf: "flex-start" }}>
          <Plus size={14} /> {creando ? "Creando..." : "Agregar motivo"}
        </button>
      </form>
      {loading && <div style={{ color: "var(--text-muted)" }}>Cargando…</div>}
      {!loading && (
        <table className="data-table">
          <thead>
            <tr><th>Nombre</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {motivos.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600, color: "var(--text-primary)" }} title={m.descripcion || undefined}>
                  {m.nombre}
                </td>
                <td>
                  <span className="badge" style={{
                    background: m.activo ? "var(--accent-success-soft)" : "var(--accent-danger-soft)",
                    color: m.activo ? "var(--accent-success)" : "var(--accent-danger)",
                  }}>
                    {m.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => toggleActivo(m)}>
                    <Power size={12} /> {m.activo ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
            {motivos.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                Sin motivos registrados todavía.
              </td></tr>
            )}
          </tbody>
        </table>
      )}
    </CollapsibleSection>
  );
}

export default function ConfiguracionSLAPage() {
  const [toastState, setToastState] = useState(null);
  const toast = (msg, type) => setToastState({ msg, type });

  const [categorias, setCategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);

  const cargarCategorias = async () => {
    setLoadingCategorias(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/categorias-tipo-informe/`, { credentials: "include" });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
      setCategorias(await res.json());
    } catch (err) {
      toast(`Error cargando categorías: ${err.message}`, "error");
    } finally {
      setLoadingCategorias(false);
    }
  };

  useEffect(() => { cargarCategorias(); }, []); // eslint-disable-line

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <div className="hero-eyebrow">Administración · Configuración de novedades</div>
          <h2 className="hero-title">Configuración del flujo de revisión de DVR</h2>
          <p className="hero-text">
            Cada bloque de abajo es una configuración o situación distinta del formulario de novedades — categorías y
            tipos de informe, su prioridad y SLA, el horario laboral, y los motivos de positiva/negativa. Puedes
            contraer los que no estés usando.
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <HorarioLaboralCard toast={toast} />
        <CategoriasCard toast={toast} categorias={categorias} loading={loadingCategorias} onCreada={cargarCategorias} />
      </div>
      <TiposInformeCard toast={toast} categorias={categorias} />

      <div className="grid-2" style={{ alignItems: "start" }}>
        <MotivosCard
          toast={toast}
          icono={<CheckCircle2 size={15} color="var(--accent-success)" />}
          titulo="Motivos de positiva"
          subtitulo="Razones especiales dentro de un resultado Positiva"
          descripcion='Razones dentro de un resultado Positiva más allá del caso estándar (se encuentran registros) — ej. "DVR inició proceso de regrabación". El analista los elige al marcar la revisión como Positiva.'
          placeholderNombre="Ej. DVR inició proceso de regrabación"
          endpointBase="motivos-positiva"
        />
        <MotivosCard
          toast={toast}
          icono={<XCircle size={15} color="var(--accent-danger)" />}
          titulo="Motivos de negativa"
          subtitulo="Por qué una revisión resulta Negativa"
          descripcion="Razones por las que una revisión de DVR resulta Negativa — ej. DVR no enciende, sin grabación del día. El analista los elige al marcar la revisión como Negativa."
          placeholderNombre="Ej. Cámara desconectada"
          endpointBase="motivos-negativa"
        />
      </div>

      {toastState && <Toast message={toastState.msg} type={toastState.type} onClose={() => setToastState(null)} />}
    </div>
  );
}
