import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
  Clock, Save, Plus, Tag, Power, CheckCircle2, XCircle, Timer,
  ChevronDown, ChevronUp, Battery, Radio, SlidersHorizontal,
} from "lucide-react";
import { API_BASE } from "../../config/api";
import { getCsrfToken } from "../../utils/csrf";
import Toast from "../../components/ui/Toast";

// Recorrido guiado (Driver.js) de toda la pantalla -- se dispara "en vivo"
// desde una tarjeta de /manual (ver ManualPage.jsx), igual que
// iniciarTourRevisionDVR en NovedadDetallePage.jsx. `onFinish` navega de
// vuelta al manual al cerrar el recorrido (Listo, X o Escape).
function iniciarTourConfiguracionNovedades(onFinish) {
  const recorrido = driver({
    showProgress: true,
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Listo",
    onDestroyed: onFinish,
    steps: [
      {
        element: "#tour-horario",
        popover: { title: "Horario laboral", description: "Días y horas en que corre el conteo del SLA de revisión de DVR. Fuera de este horario, el tiempo no avanza." },
      },
      {
        element: "#tour-categorias",
        popover: { title: "Categorías de informe", description: "Agrupan los tipos de informe que aparecen en el formulario de Registrar novedad." },
      },
      {
        element: "#tour-tipos-informe",
        popover: { title: "Tiempo máximo por tipo de informe (SLA)", description: "Horas hábiles máximas desde ENCOLADO hasta TERMINADO por cada tipo de informe. Vacío = sin límite." },
      },
      {
        element: "#tour-dispositivos-dvr",
        popover: { title: "Dispositivos DVR", description: "Catálogo de las hasta 2 DVR físicas por vehículo (Máquina 1 y 2), con marca, serie y fecha de último cambio de pila." },
      },
      {
        element: "#tour-caducidad-pila",
        popover: { title: "Caducidad de pila de la DVR", description: "Cada cuántos meses debe cambiarse la pila -- de acá sale el aviso que ve el analista al revisar una novedad." },
      },
      {
        element: "#tour-motivos-positivos",
        popover: { title: "Motivos de positiva", description: "Razones dentro de un resultado Positiva más allá del caso estándar, ej. 'DVR inició proceso de regrabación'." },
      },
      {
        element: "#tour-motivos-negativos",
        popover: { title: "Motivos de negativa", description: "Razones por las que una revisión de DVR resulta Negativa, ej. DVR no enciende, sin grabación del día." },
      },
      {
        element: "#tour-etapas-flujo",
        popover: { title: "Etapas del flujo", description: "Nombre, descripción, orden y activación de cada paso del asistente de revisión (analista) y del portal de clientes." },
      },
    ],
  });
  recorrido.drive();
}

// Contenedor colapsable compartido por todas las secciones de esta pantalla:
// cada una es una configuración/situación distinta (horario, categorías,
// SLA por tipo, motivos...), así que cada una lleva su propio ícono, título
// y subtítulo para que se distingan de un vistazo, y se puede contraer para
// no tener que scrollear entre todas cuando solo se necesita una.
function CollapsibleSection({ id, icon, title, subtitle, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="card">
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

// Agrupa varias CollapsibleSection bajo un mismo encabezado por lógica de
// funcionalidad (ej. "Categorías y tipos de informe"), en vez de que todas
// las tarjetas de la pantalla se vean como una sola lista plana mezclada.
// El encabezado no es una tarjeta más -- es más liviano a propósito, para
// que se note que agrupa, no que compite visualmente con las tarjetas.
function GrupoConfiguracion({ titulo, descripcion, children }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 2, borderLeft: "3px solid var(--accent-primary)" }}>
        <span style={{
          fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
          color: "var(--accent-primary)", paddingLeft: 10,
        }}>
          {titulo}
        </span>
        {descripcion && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", paddingLeft: 10 }}>{descripcion}</span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </div>
    </section>
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

function CategoriasCard({ toast, categorias, loading, onCreada, defaultOpen }) {
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
      id="tour-categorias"
      icon={<Tag size={15} color="var(--accent-primary)" />}
      title="Categorías de informe"
      subtitle="Agrupan los tipos de informe en el formulario de Registrar novedad"
      defaultOpen={defaultOpen}
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

function HorarioLaboralCard({ toast, defaultOpen }) {
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
      id="tour-horario"
      icon={<Clock size={15} color="var(--accent-primary)" />}
      title="Horario laboral"
      subtitle="Cuándo corre el conteo del SLA de revisión"
      defaultOpen={defaultOpen}
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

function TiposInformeCard({ toast, categorias, defaultOpen }) {
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
      id="tour-tipos-informe"
      icon={<Timer size={15} color="var(--accent-primary)" />}
      title="Tiempo máximo por tipo de informe (SLA)"
      subtitle="Límite de horas hábiles desde ENCOLADO hasta TERMINADO"
      defaultOpen={defaultOpen}
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

// Campo híbrido de búsqueda de vehículo por placa (mismo mecanismo de debounce
// + sugerencias que ya usa DynamicForm.jsx para el lookup de placa en el
// formulario de novedad, reimplementado acá en chico porque esta pantalla no
// usa DynamicForm). `onSelect(null)` cuando el usuario vuelve a escribir,
// para no dejar un vehículo viejo seleccionado por error.
function VehiculoLookup({ value, onSelect }) {
  const [texto, setTexto] = useState(value?.label || "");
  const [sugerencias, setSugerencias] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buscar = (q) => {
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setSugerencias([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/vehiculo/buscar/?q=${encodeURIComponent(q)}`, { credentials: "include" });
        if (res.ok) setSugerencias(await res.json());
      } catch {
        // silencioso -- el usuario simplemente no ve sugerencias
      }
    }, 300);
  };

  const elegir = (v) => {
    onSelect(v);
    setTexto(v.label);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        className="form-input"
        placeholder="Buscar por placa..."
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          buscar(e.target.value);
          setOpen(true);
          if (value) onSelect(null);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && sugerencias.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-md, 10px)", padding: "6px 0", maxHeight: 220, overflowY: "auto",
          boxShadow: "0 12px 28px -8px rgba(0,0,0,0.35)",
        }}>
          {sugerencias.map((v) => (
            <button
              key={v.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(v)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "7px 12px",
                background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, color: "var(--text-primary)",
              }}
            >
              {v.label} · {v.cliente}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CaducidadPilaCard({ toast, defaultOpen }) {
  const [meses, setMeses] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/configuracion-dvr/`, { credentials: "include" });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
      const data = await res.json();
      setMeses(data.meses_caducidad_pila);
    } catch (err) {
      toast(`Error cargando la configuración de pila: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/configuracion-dvr/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ meses_caducidad_pila: Number(meses) }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo guardar");
      toast("Configuración de pila actualizada", "success");
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <CollapsibleSection
      id="tour-caducidad-pila"
      icon={<Battery size={15} color="var(--accent-primary)" />}
      title="Caducidad de pila de la DVR"
      subtitle="Cada cuántos meses debe cambiarse la pila"
      defaultOpen={defaultOpen}
    >
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
        Al elegir en una novedad qué máquina DVR entró a revisión, se avisa cuando su pila está por vencer o ya
        venció, contando desde la fecha de su último cambio registrado abajo en "Dispositivos DVR".
      </p>
      {loading ? (
        <div style={{ color: "var(--text-muted)" }}>Cargando…</div>
      ) : (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Meses de caducidad</label>
            <input
              type="number" min="1" step="1" className="form-input" style={{ width: 120 }}
              value={meses}
              onChange={(e) => setMeses(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
            <Save size={14} /> {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}
    </CollapsibleSection>
  );
}

const PILA_ESTADO = {
  vencida: { label: "Vencida", bg: "var(--accent-danger-soft)", color: "var(--accent-danger)" },
  por_vencer: { label: "Por vencer", bg: "var(--accent-warn-soft)", color: "var(--accent-warn)" },
  vigente: { label: "Vigente", bg: "var(--accent-success-soft)", color: "var(--accent-success)" },
  sin_registro: { label: "Sin registro", bg: "var(--bg-surface)", color: "var(--text-muted)" },
};

function EstadoPilaBadge({ estado }) {
  const e = PILA_ESTADO[estado] || PILA_ESTADO.sin_registro;
  return <span className="badge" style={{ background: e.bg, color: e.color }}>{e.label}</span>;
}

const NUEVO_DISPOSITIVO_VACIO = { vehiculo: null, numero_maquina: 1, marca: "", numero_serie: "", fecha_ultimo_cambio_pila: "" };

// Catálogo de las hasta 2 DVR físicas por vehículo (Máquina 1/2) -- mismo
// patrón de "form-grid + tabla" que TiposInformeCard, con edición inline por
// fila (marca/serie/fecha) igual que la columna tiempo_maximo_horas de esa
// misma tarjeta.
function DispositivosDVRCard({ toast, defaultOpen }) {
  const [dispositivos, setDispositivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState(NUEVO_DISPOSITIVO_VACIO);
  const [creando, setCreando] = useState(false);
  const [guardandoId, setGuardandoId] = useState(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/dispositivos-dvr/`, { credentials: "include" });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
      setDispositivos(await res.json());
    } catch (err) {
      toast(`Error cargando dispositivos DVR: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const crear = async (e) => {
    e.preventDefault();
    if (!nuevo.vehiculo || !nuevo.marca.trim()) {
      toast("El vehículo y la marca son obligatorios", "error");
      return;
    }
    setCreando(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/dispositivos-dvr/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({
          vehiculo_id: nuevo.vehiculo.id,
          numero_maquina: Number(nuevo.numero_maquina),
          marca: nuevo.marca.trim(),
          numero_serie: nuevo.numero_serie.trim(),
          fecha_ultimo_cambio_pila: nuevo.fecha_ultimo_cambio_pila || null,
        }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo registrar el dispositivo");
      setNuevo(NUEVO_DISPOSITIVO_VACIO);
      toast("Dispositivo DVR registrado", "success");
      await cargar();
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setCreando(false);
    }
  };

  const actualizarCampo = (id, campo, valor) => {
    setDispositivos((ds) => ds.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)));
  };

  const guardar = async (dispositivo) => {
    setGuardandoId(dispositivo.id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/dispositivos-dvr/${dispositivo.id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({
          marca: dispositivo.marca,
          numero_serie: dispositivo.numero_serie,
          fecha_ultimo_cambio_pila: dispositivo.fecha_ultimo_cambio_pila || null,
        }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo guardar");
      setDispositivos((ds) => ds.map((d) => (d.id === dispositivo.id ? resultado.dispositivo : d)));
      toast(`Dispositivo de ${dispositivo.vehiculo} actualizado`, "success");
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <CollapsibleSection
      id="tour-dispositivos-dvr"
      icon={<Radio size={15} color="var(--accent-primary)" />}
      title="Dispositivos DVR"
      subtitle="Máquina 1 y 2 de cada vehículo, con su último cambio de pila"
      defaultOpen={defaultOpen}
    >
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
        Cada vehículo tiene hasta 2 DVR físicas. Registrarlas acá permite identificar, al revisar una novedad, cuál
        de las 2 entró y si su pila necesita cambio.
      </p>

      <form onSubmit={crear} className="form-grid" style={{ marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Vehículo (placa)<span className="req"> *</span></label>
          <VehiculoLookup value={nuevo.vehiculo} onSelect={(v) => setNuevo((n) => ({ ...n, vehiculo: v }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Máquina</label>
          <select
            className="form-select"
            value={nuevo.numero_maquina}
            onChange={(e) => setNuevo((n) => ({ ...n, numero_maquina: e.target.value }))}
          >
            <option value={1}>Máquina 1</option>
            <option value={2}>Máquina 2</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Marca<span className="req"> *</span></label>
          <input
            className="form-input" placeholder="Ej. Concox"
            value={nuevo.marca}
            onChange={(e) => setNuevo((n) => ({ ...n, marca: e.target.value }))}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Número de serie</label>
          <input
            className="form-input" placeholder="Opcional"
            value={nuevo.numero_serie}
            onChange={(e) => setNuevo((n) => ({ ...n, numero_serie: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Último cambio de pila</label>
          <input
            type="date" className="form-input"
            value={nuevo.fecha_ultimo_cambio_pila}
            onChange={(e) => setNuevo((n) => ({ ...n, fecha_ultimo_cambio_pila: e.target.value }))}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <button type="submit" className="btn btn-primary" disabled={creando}>
            <Plus size={14} /> {creando ? "Registrando..." : "Registrar dispositivo"}
          </button>
        </div>
      </form>

      {loading && <div style={{ color: "var(--text-muted)" }}>Cargando…</div>}
      {!loading && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Vehículo</th><th>Máquina</th><th>Marca</th><th>Serie</th>
              <th>Último cambio de pila</th><th>Estado de pila</th><th></th>
            </tr>
          </thead>
          <tbody>
            {dispositivos.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.vehiculo}</td>
                <td>Máquina {d.numero_maquina}</td>
                <td>
                  <input
                    className="form-input" style={{ width: 120 }}
                    value={d.marca}
                    onChange={(e) => actualizarCampo(d.id, "marca", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="form-input" style={{ width: 120 }}
                    value={d.numero_serie || ""}
                    onChange={(e) => actualizarCampo(d.id, "numero_serie", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="date" className="form-input" style={{ width: 150 }}
                    value={d.fecha_ultimo_cambio_pila || ""}
                    onChange={(e) => actualizarCampo(d.id, "fecha_ultimo_cambio_pila", e.target.value)}
                  />
                </td>
                <td><EstadoPilaBadge estado={d.estado} /></td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => guardar(d)} disabled={guardandoId === d.id}>
                    <Save size={12} /> {guardandoId === d.id ? "Guardando..." : "Guardar"}
                  </button>
                </td>
              </tr>
            ))}
            {dispositivos.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                Sin dispositivos DVR registrados todavía.
              </td></tr>
            )}
          </tbody>
        </table>
      )}
    </CollapsibleSection>
  );
}

const TRACK_LABEL = { ANALISTA: "Analista", CLIENTE: "Cliente" };

// A diferencia de DispositivosDVRCard, acá no hay formulario de alta: las
// etapas son fijas (una por cada clave con criterio de "completado" en
// apps.novedades.etapas.CRITERIOS_ETAPA, del lado del backend) -- esta
// tarjeta solo edita metadata (nombre/descripción/orden/activo) de las que
// ya sembró la migración de datos.
function EtapasFlujoCard({ toast, defaultOpen }) {
  const [etapas, setEtapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardandoId, setGuardandoId] = useState(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/etapas-flujo/`, { credentials: "include" });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
      setEtapas(await res.json());
    } catch (err) {
      toast(`Error cargando etapas del flujo: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const actualizarCampo = (id, campo, valor) => {
    setEtapas((es) => es.map((e) => (e.id === id ? { ...e, [campo]: valor } : e)));
  };

  const guardar = async (etapa) => {
    setGuardandoId(etapa.id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/etapas-flujo/${etapa.id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({
          nombre: etapa.nombre,
          descripcion: etapa.descripcion,
          orden: Number(etapa.orden),
          activo: etapa.activo,
        }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo guardar");
      setEtapas((es) => es.map((e) => (e.id === etapa.id ? resultado.etapa : e)));
      toast(`Etapa "${etapa.nombre}" actualizada`, "success");
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <CollapsibleSection
      id="tour-etapas-flujo"
      icon={<SlidersHorizontal size={15} color="var(--accent-primary)" />}
      title="Etapas del flujo"
      subtitle="Nombre, descripción, orden y activación de los pasos del asistente"
      defaultOpen={defaultOpen}
    >
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
        Cada fila es un paso ya existente del flujo de revisión (Analista) o del portal de clientes (Cliente). Puedes
        renombrarlo, cambiar su descripción, su orden de aparición o desactivarlo — no se pueden crear pasos nuevos
        desde acá.
      </p>
      {loading && <div style={{ color: "var(--text-muted)" }}>Cargando…</div>}
      {!loading && (
        <table className="data-table">
          <thead>
            <tr><th>Track</th><th>Nombre</th><th>Descripción</th><th>Orden</th><th>Activo</th><th></th></tr>
          </thead>
          <tbody>
            {etapas.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}>
                    {TRACK_LABEL[e.track] || e.track}
                  </span>
                </td>
                <td>
                  <input className="form-input" value={e.nombre} onChange={(ev) => actualizarCampo(e.id, "nombre", ev.target.value)} />
                </td>
                <td>
                  <input className="form-input" value={e.descripcion} onChange={(ev) => actualizarCampo(e.id, "descripcion", ev.target.value)} />
                </td>
                <td>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 70 }}
                    value={e.orden}
                    onChange={(ev) => actualizarCampo(e.id, "orden", ev.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={e.activo}
                    onChange={(ev) => actualizarCampo(e.id, "activo", ev.target.checked)}
                    style={{ accentColor: "var(--accent-primary)", width: 14, height: 14 }}
                  />
                </td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => guardar(e)} disabled={guardandoId === e.id}>
                    <Save size={12} /> {guardandoId === e.id ? "Guardando..." : "Guardar"}
                  </button>
                </td>
              </tr>
            ))}
            {etapas.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                Sin etapas registradas todavía.
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
function MotivosCard({ id, toast, icono, titulo, subtitulo, descripcion, placeholderNombre, endpointBase, defaultOpen }) {
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
    <CollapsibleSection id={id} icon={icono} title={titulo} subtitle={subtitulo} defaultOpen={defaultOpen}>
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
  const location = useLocation();
  const navigate = useNavigate();
  const tourIniciadoRef = useRef(false);

  // Llega desde una tarjeta "Ver en vivo" de /manual (ver ManualPage.jsx):
  // navigate("/administracion/sla", { state: { iniciarTour: true, volverA: "/manual" } }).
  useEffect(() => {
    if (!location.state?.iniciarTour || tourIniciadoRef.current) return;
    tourIniciadoRef.current = true;
    const volverA = location.state.volverA || "/manual";
    iniciarTourConfiguracionNovedades(() => navigate(volverA));
  }, [location.state, navigate]);

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
            Agrupado por funcionalidad: categorías y tipos de informe, horario laboral, dispositivos DVR, el flujo del
            proceso, y los motivos de positiva/negativa. Solo el primer grupo empieza abierto — despliega los demás
            según lo que necesites.
          </p>
        </div>
      </div>

      <GrupoConfiguracion
        titulo="Categorías y tipos de informe"
        descripcion="Qué tipos de informe existen, a qué categoría pertenecen y su tiempo máximo de SLA."
      >
        <CategoriasCard toast={toast} categorias={categorias} loading={loadingCategorias} onCreada={cargarCategorias} defaultOpen />
        <TiposInformeCard toast={toast} categorias={categorias} defaultOpen />
      </GrupoConfiguracion>

      <GrupoConfiguracion
        titulo="Horario laboral"
        descripcion="Días y horas en que corre el conteo del SLA de revisión de DVR."
      >
        <HorarioLaboralCard toast={toast} defaultOpen={false} />
      </GrupoConfiguracion>

      <GrupoConfiguracion
        titulo="Dispositivos DVR"
        descripcion="Catálogo de DVR por vehículo y cada cuánto debe cambiarse su pila."
      >
        <DispositivosDVRCard toast={toast} defaultOpen={false} />
        <CaducidadPilaCard toast={toast} defaultOpen={false} />
      </GrupoConfiguracion>

      <GrupoConfiguracion
        titulo="Flujo del proceso"
        descripcion="Nombre, descripción, orden y activación de cada paso del asistente (analista y cliente)."
      >
        <EtapasFlujoCard toast={toast} defaultOpen={false} />
      </GrupoConfiguracion>

      <GrupoConfiguracion
        titulo="Motivos de revisión"
        descripcion="Catálogos que el analista elige al tomar la decisión de una revisión."
      >
        <div className="grid-2" style={{ alignItems: "start" }}>
          <MotivosCard
            id="tour-motivos-positivos"
            toast={toast}
            defaultOpen={false}
            icono={<CheckCircle2 size={15} color="var(--accent-success)" />}
            titulo="Motivos de positiva"
            subtitulo="Razones especiales dentro de un resultado Positiva"
            descripcion='Razones dentro de un resultado Positiva más allá del caso estándar (se encuentran registros) — ej. "DVR inició proceso de regrabación". El analista los elige al marcar la revisión como Positiva.'
            placeholderNombre="Ej. DVR inició proceso de regrabación"
            endpointBase="motivos-positiva"
          />
          <MotivosCard
            id="tour-motivos-negativos"
            toast={toast}
            defaultOpen={false}
            icono={<XCircle size={15} color="var(--accent-danger)" />}
            titulo="Motivos de negativa"
            subtitulo="Por qué una revisión resulta Negativa"
            descripcion="Razones por las que una revisión de DVR resulta Negativa — ej. DVR no enciende, sin grabación del día. El analista los elige al marcar la revisión como Negativa."
            placeholderNombre="Ej. Cámara desconectada"
            endpointBase="motivos-negativa"
          />
        </div>
      </GrupoConfiguracion>

      {toastState && <Toast message={toastState.msg} type={toastState.type} onClose={() => setToastState(null)} />}
    </div>
  );
}
