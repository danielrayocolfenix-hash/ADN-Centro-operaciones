import React, { useMemo, useState } from "react";
import {
  Wrench, Plus, Search, FileText, Eye, Edit2,
  MapPin, Clock, User, Truck, AlertOctagon,
  Wifi, Camera, Cpu, Radio, TriangleAlert, ShieldCheck, ExternalLink,
} from "lucide-react";
import { clientes, vehiculos } from "../data/mockData";
import { formatFechaHora } from "../utils/helpers";
import Toast from "../components/ui/Toast";
import DrawerPanel from "../components/ui/DrawerPanel";

// ─── CATÁLOGOS DE MANTENIMIENTO ──────────────────────────────────────────────
// Cada catálogo centraliza su propia metadata (ícono, color, label) para que
// el resto del componente nunca tenga que mantener switch/if paralelos.

const SISTEMAS = {
  GPS:       { label: "GPS",      icon: Radio  },
  "Cámara":  { label: "Cámara",   icon: Camera },
  DVR:       { label: "DVR",      icon: Cpu    },
  Antena:    { label: "Antena",   icon: Wifi   },
  Cableado:  { label: "Cableado", icon: Wrench },
  Todos:     { label: "Todos",    icon: Wrench },
};

const PRIORIDADES = {
  Alta:  { label: "Alta",  color: "var(--accent-danger)" },
  Media: { label: "Media", color: "var(--accent-warn)"   },
  Baja:  { label: "Baja",  color: "var(--accent-success)" },
};

const ESTADOS = {
  "Abierto":            { label: "Abierto",            bg: "#FEF3C7", text: "#92400E" },
  "En proceso":         { label: "En proceso",         bg: "#DBEAFE", text: "#1E40AF" },
  "Pendiente repuesto":  { label: "Pendiente repuesto", bg: "#FEE2E2", text: "#991B1B" },
  "Cerrado":            { label: "Cerrado",            bg: "#D1FAE5", text: "#065F46" },
  "Requiere informe":   { label: "Requiere informe",   bg: "#EDE9FE", text: "#5B21B6" },
};

const TIPOS_POR_SISTEMA = {
  GPS: [
    "Falla de GPS — Sin señal",
    "Falla de GPS — Señal intermitente",
    "Falla de GPS — Datos incorrectos",
    "Actualización de firmware",
    "Cambio de equipo GPS",
  ],
  "Cámara": [
    "Falla de cámara — Sin imagen",
    "Falla de cámara — Imagen distorsionada",
    "Falla de cámara — Grabación detenida",
    "Cambio de cámara",
  ],
  DVR: [
    "Falla de DVR — Sin respuesta",
    "Falla de DVR — Pérdida de video",
    "Reemplazo de DVR",
  ],
  Antena: ["Falla de antena GPS"],
  Cableado: ["Falla de cableado / conexión"],
  Todos: ["Revisión preventiva", "Otro"],
};

const TODOS_LOS_TIPOS = Object.values(TIPOS_POR_SISTEMA).flat();

const SISTEMA_KEYS = Object.keys(SISTEMAS);
const PRIORIDAD_KEYS = Object.keys(PRIORIDADES);
const ESTADO_KEYS = Object.keys(ESTADOS);

// ─── DATOS MOCK DE MANTENIMIENTOS ────────────────────────────────────────────
const mantenimientosIniciales = [
  {
    id: "MNT-2024-001",
    fecha: "2024-06-10T08:32:00",
    cliente: "CLI-001",
    vehiculo: "VEH-001",
    tipo: "Falla de GPS — Sin señal",
    sistema: "GPS",
    descripcion: "La unidad GPS del vehículo TBD-123 dejó de transmitir posición por más de 2 horas. Se verificó conexión de antena y se detectó desconexión por vibración.",
    prioridad: "Alta",
    estado: "Cerrado",
    operador: "Diana Salcedo",
    tecnico: "Carlos Ruiz",
    ubicacion: "Bogotá — Taller central",
    generadoInforme: true,
    informeId: "INF-MNT-2024-001",
  },
  {
    id: "MNT-2024-002",
    fecha: "2024-06-11T14:15:00",
    cliente: "CLI-002",
    vehiculo: "VEH-003",
    tipo: "Falla de cámara — Sin imagen",
    sistema: "Cámara",
    descripcion: "Cámara delantera del vehículo MNZ-789 sin imagen en el DVR. Se revisa cableado y estado del lente. Posible daño por humedad.",
    prioridad: "Alta",
    estado: "En proceso",
    operador: "Juan Cárdenas",
    tecnico: "Pedro López",
    ubicacion: "Villavicencio — Sede cliente",
    generadoInforme: false,
    informeId: null,
  },
  {
    id: "MNT-2024-003",
    fecha: "2024-06-11T16:45:00",
    cliente: "CLI-003",
    vehiculo: "VEH-004",
    tipo: "Actualización de firmware",
    sistema: "GPS",
    descripcion: "Actualización de firmware del módulo GPS a versión 4.2.1. Programada por ciclo preventivo trimestral.",
    prioridad: "Baja",
    estado: "Cerrado",
    operador: "Diana Salcedo",
    tecnico: "Diana Salcedo",
    ubicacion: "Remoto — Acceso OTA",
    generadoInforme: false,
    informeId: null,
  },
  {
    id: "MNT-2024-004",
    fecha: "2024-06-12T09:20:00",
    cliente: "CLI-005",
    vehiculo: "VEH-005",
    tipo: "Falla de DVR — Pérdida de video",
    sistema: "DVR",
    descripcion: "DVR del vehículo PAL-654 dejó de grabar. Al revisar remotamente, el disco duro presenta sectores defectuosos. Se requiere reemplazo físico.",
    prioridad: "Alta",
    estado: "Pendiente repuesto",
    operador: "Marco Estrada",
    tecnico: "Carlos Ruiz",
    ubicacion: "Barranquilla — Sede Líneas Caribeñas",
    generadoInforme: false,
    informeId: null,
  },
  {
    id: "MNT-2024-005",
    fecha: "2024-06-09T11:00:00",
    cliente: "CLI-001",
    vehiculo: "VEH-002",
    tipo: "Cambio de equipo GPS",
    sistema: "GPS",
    descripcion: "Reemplazo completo del módulo GPS por daño irreparable tras accidente. Se instala equipo nuevo con número de serie CF-GPS-00892.",
    prioridad: "Alta",
    estado: "Cerrado",
    operador: "Juan Cárdenas",
    tecnico: "Pedro López",
    ubicacion: "Bogotá — Taller central",
    generadoInforme: true,
    informeId: "INF-MNT-2024-002",
  },
  {
    id: "MNT-2024-006",
    fecha: "2024-06-12T17:30:00",
    cliente: "CLI-001",
    vehiculo: "VEH-006",
    tipo: "Falla de GPS — Señal intermitente",
    sistema: "GPS",
    descripcion: "Señal GPS pierde posición cada 15-20 minutos. Se sospecha de antena dañada por golpe en la parte superior del vehículo.",
    prioridad: "Media",
    estado: "Abierto",
    operador: "Diana Salcedo",
    tecnico: "Sin asignar",
    ubicacion: "Armenia — En ruta",
    generadoInforme: false,
    informeId: null,
  },
];

function generarIdMantenimiento(lista) {
  const anio = new Date().getFullYear();
  const siguiente = lista.length + 1;
  return `MNT-${anio}-${String(siguiente).padStart(3, "0")}`;
}

// ─── PEQUEÑOS COMPONENTES DE PRESENTACIÓN ────────────────────────────────────

function SistemaIcon({ sistema, size = 14 }) {
  const Icon = SISTEMAS[sistema]?.icon || Wrench;
  return <Icon size={size} color="var(--accent-primary)" />;
}

function SistemaTag({ sistema }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--accent-primary)" }}>
      <SistemaIcon sistema={sistema} />
      {SISTEMAS[sistema]?.label || sistema}
    </span>
  );
}

function PrioridadTag({ prioridad }) {
  const color = PRIORIDADES[prioridad]?.color || "var(--text-muted)";
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {PRIORIDADES[prioridad]?.label || prioridad}
    </span>
  );
}

function EstadoBadge({ estado, fontSize = 11 }) {
  const s = ESTADOS[estado] || { bg: "#F3F4F6", text: "#374151", label: estado };
  return (
    <span className="badge" style={{ background: s.bg, color: s.text, fontSize }}>
      {s.label}
    </span>
  );
}

// Indicador discreto de informe: un ícono pequeño, no una columna ancha.
// - Generado  → ícono relleno + click navega al informe (sin badge verde llamativo)
// - Pendiente → ícono outline tenue + click genera el informe
function InformeIndicator({ mantenimiento, onGenerar, onNavigate }) {
  if (mantenimiento.generadoInforme && mantenimiento.informeId) {
    return (
      <button
        className="btn-icon"
        title={`Ver informe ${mantenimiento.informeId}`}
        onClick={() => onNavigate(mantenimiento.informeId)}
        style={{ color: "var(--text-secondary)" }}
      >
        <FileText size={14} />
      </button>
    );
  }
  return (
    <button
      className="btn-icon"
      title="Generar informe técnico"
      onClick={() => onGenerar(mantenimiento)}
      style={{ color: "var(--text-muted)" }}
    >
      <FileText size={14} strokeOpacity={0.55} />
    </button>
  );
}

// ─── MODAL REGISTRAR / EDITAR ─────────────────────────────────────────────────
function ModalMantenimiento({ mantenimiento, onClose, onSave }) {
  const isEdit = !!mantenimiento?.id;
  const [form, setForm] = useState(
    mantenimiento || {
      fecha: new Date().toISOString().slice(0, 16),
      cliente: "",
      vehiculo: "",
      tipo: TODOS_LOS_TIPOS[0],
      sistema: "GPS",
      descripcion: "",
      prioridad: "Media",
      estado: "Abierto",
      operador: "Diana Salcedo",
      tecnico: "",
      ubicacion: "",
      generadoInforme: false,
      informeId: null,
    }
  );

  const vehiculosCliente = vehiculos.filter(v => v.cliente === form.cliente);
  const tiposDisponibles = TIPOS_POR_SISTEMA[form.sistema] || TODOS_LOS_TIPOS;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Al cambiar de sistema, si el tipo actual ya no aplica, se reinicia al primero del nuevo sistema.
  const handleSistema = (sistema) => {
    setForm(f => ({
      ...f,
      sistema,
      tipo: (TIPOS_POR_SISTEMA[sistema] || TODOS_LOS_TIPOS).includes(f.tipo)
        ? f.tipo
        : (TIPOS_POR_SISTEMA[sistema] || TODOS_LOS_TIPOS)[0],
    }));
  };

  return (
    <DrawerPanel
      icon={<Wrench size={18} />}
      title={isEdit ? "Editar mantenimiento" : "Registrar mantenimiento"}
      onClose={onClose}
      width={640}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>
            {isEdit ? "Guardar cambios" : "Registrar mantenimiento"}
          </button>
        </>
      }
    >
          <div className="form-grid">
            {/* Fecha */}
            <div className="form-group">
              <label className="form-label">Fecha y hora <span className="req">*</span></label>
              <input className="form-input" type="datetime-local" value={form.fecha}
                onChange={e => set("fecha", e.target.value)} />
            </div>

            {/* Sistema afectado */}
            <div className="form-group">
              <label className="form-label">Sistema afectado <span className="req">*</span></label>
              <select className="form-select" value={form.sistema} onChange={e => handleSistema(e.target.value)}>
                {SISTEMA_KEYS.map(s => <option key={s} value={s}>{SISTEMAS[s].label}</option>)}
              </select>
            </div>

            {/* Tipo — ahora filtrado por el sistema elegido */}
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label className="form-label">Tipo de mantenimiento <span className="req">*</span></label>
              <select className="form-select" value={form.tipo} onChange={e => set("tipo", e.target.value)}>
                {tiposDisponibles.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            {/* Cliente */}
            <div className="form-group">
              <label className="form-label">Cliente <span className="req">*</span></label>
              <select className="form-select" value={form.cliente}
                onChange={e => { set("cliente", e.target.value); set("vehiculo", ""); }}>
                <option value="">Seleccionar...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
              </select>
            </div>

            {/* Vehículo */}
            <div className="form-group">
              <label className="form-label">Vehículo</label>
              <select className="form-select" value={form.vehiculo} onChange={e => set("vehiculo", e.target.value)}
                disabled={!form.cliente}>
                <option value="">Seleccionar...</option>
                {vehiculosCliente.map(v => (
                  <option key={v.id} value={v.id}>{v.placa} — {v.conductor}</option>
                ))}
              </select>
            </div>

            {/* Prioridad */}
            <div className="form-group">
              <label className="form-label">Prioridad</label>
              <select className="form-select" value={form.prioridad} onChange={e => set("prioridad", e.target.value)}>
                {PRIORIDAD_KEYS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>

            {/* Estado */}
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-select" value={form.estado} onChange={e => set("estado", e.target.value)}>
                {ESTADO_KEYS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>

            {/* Operador */}
            <div className="form-group">
              <label className="form-label">Operador que reporta</label>
              <input className="form-input" value={form.operador} onChange={e => set("operador", e.target.value)} />
            </div>

            {/* Técnico */}
            <div className="form-group">
              <label className="form-label">Técnico asignado</label>
              <input className="form-input" value={form.tecnico}
                onChange={e => set("tecnico", e.target.value)} placeholder="Sin asignar" />
            </div>

            {/* Ubicación */}
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label className="form-label">Ubicación / Lugar de intervención</label>
              <input className="form-input" value={form.ubicacion}
                onChange={e => set("ubicacion", e.target.value)}
                placeholder="Ej: Bogotá — Taller central / Remoto OTA" />
            </div>

            {/* Descripción */}
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label className="form-label">Descripción del problema <span className="req">*</span></label>
              <textarea className="form-textarea" rows={4} value={form.descripcion}
                onChange={e => set("descripcion", e.target.value)}
                placeholder="Describe la falla detectada, diagnóstico y acciones realizadas..." />
            </div>
          </div>
    </DrawerPanel>
  );
}

// ─── MODAL DETALLE ────────────────────────────────────────────────────────────
function ModalDetalle({ mantenimiento, onClose, onGenerarInforme, onNavigateInforme }) {
  const cliente = clientes.find(c => c.id === mantenimiento.cliente);
  const vehiculo = vehiculos.find(v => v.id === mantenimiento.vehiculo);

  return (
    <DrawerPanel
      icon={<Eye size={18} />}
      title={mantenimiento.id}
      onClose={onClose}
      width={640}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={onClose}>Listo</button>
        </>
      }
    >
          {/* Badges */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            <span className="badge" style={{
              background: `${PRIORIDADES[mantenimiento.prioridad]?.color}20`,
              color: PRIORIDADES[mantenimiento.prioridad]?.color,
              border: `1px solid ${PRIORIDADES[mantenimiento.prioridad]?.color}40`,
            }}>
              <AlertOctagon size={11} /> Prioridad {mantenimiento.prioridad}
            </span>
            <EstadoBadge estado={mantenimiento.estado} />
            <span className="tag" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <SistemaIcon sistema={mantenimiento.sistema} size={11} />
              {mantenimiento.sistema}
            </span>
          </div>

          {/* Info grid */}
          <div className="grid-2" style={{ gap: 10, marginBottom: 16 }}>
            {[
              { icon: Clock,         label: "Fecha y hora",     value: formatFechaHora(mantenimiento.fecha) },
              { icon: User,          label: "Operador",         value: mantenimiento.operador },
              { icon: ShieldCheck,   label: "Técnico asignado", value: mantenimiento.tecnico || "Sin asignar" },
              { icon: Truck,         label: "Vehículo",         value: vehiculo ? `${vehiculo.placa} — ${vehiculo.conductor}` : "—" },
              { icon: TriangleAlert, label: "Cliente",          value: cliente?.razonSocial || "—" },
              { icon: MapPin,        label: "Ubicación",        value: mantenimiento.ubicacion || "—" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{
                display: "flex", gap: 10, padding: "10px 12px",
                background: "var(--bg-surface)", borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)"
              }}>
                <Icon size={14} color="var(--accent-primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 1, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Tipo completo */}
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <Wrench size={14} color="var(--accent-primary)" />
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 1 }}>Tipo de mantenimiento</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{mantenimiento.tipo}</div>
            </div>
          </div>

          {/* Descripción */}
          <div style={{
            background: "var(--bg-surface)", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", padding: "14px 16px"
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Descripción / Diagnóstico
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              {mantenimiento.descripcion}
            </p>
          </div>

          {/* Informe — referencia discreta, ya no un botón principal en el footer */}
          <div style={{ marginTop: 14, textAlign: "right" }}>
            {mantenimiento.generadoInforme && mantenimiento.informeId ? (
              <button
                onClick={() => { onClose(); onNavigateInforme(mantenimiento.informeId); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, color: "var(--text-muted)", padding: 0,
                }}
              >
                <FileText size={12} /> Informe {mantenimiento.informeId} <ExternalLink size={11} />
              </button>
            ) : (
              <button
                onClick={() => onGenerarInforme(mantenimiento)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, color: "var(--text-muted)", padding: 0,
                }}
              >
                <FileText size={12} /> Generar informe técnico
              </button>
            )}
          </div>
    </DrawerPanel>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function MantenimientoPage({ onGenerarInforme, onNavigateInforme }) {
  const [mantenimientos, setMantenimientos] = useState(mantenimientosIniciales);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroSistema, setFiltroSistema] = useState("Todos");
  const [filtroPrioridad, setFiltroPrioridad] = useState("Todos");
  const [modal, setModal] = useState(null); // null | "nuevo" | "editar" | "detalle"
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);

  // KPIs derivados en un solo paso, en vez de 4 .filter() repetidos sobre el array completo.
  const stats = useMemo(() => {
    const base = { Abierto: 0, "En proceso": 0, "Pendiente repuesto": 0, Cerrado: 0, "Requiere informe": 0, sinTecnico: 0 };
    for (const m of mantenimientos) {
      if (base[m.estado] !== undefined) base[m.estado]++;
      if (!m.tecnico || m.tecnico === "Sin asignar") base.sinTecnico++;
    }
    return base;
  }, [mantenimientos]);

  const abiertos = mantenimientos.length - stats.Cerrado;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return mantenimientos
      .filter(m => {
        const matchSearch = !q ||
          m.id.toLowerCase().includes(q) ||
          m.tipo.toLowerCase().includes(q) ||
          m.sistema.toLowerCase().includes(q) ||
          (m.ubicacion || "").toLowerCase().includes(q);
        const matchEstado   = filtroEstado   === "Todos" || m.estado    === filtroEstado;
        const matchSistema  = filtroSistema  === "Todos" || m.sistema   === filtroSistema;
        const matchPrio     = filtroPrioridad === "Todos" || m.prioridad === filtroPrioridad;
        return matchSearch && matchEstado && matchSistema && matchPrio;
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [mantenimientos, search, filtroEstado, filtroSistema, filtroPrioridad]);

  const handleSave = (form) => {
    if (modal === "editar" && selected) {
      setMantenimientos(ms => ms.map(m => m.id === selected.id ? { ...m, ...form } : m));
      setToast({ msg: "Mantenimiento actualizado", type: "success" });
    } else {
      const nuevo = {
        ...form,
        id: generarIdMantenimiento(mantenimientos),
        generadoInforme: false,
        informeId: null,
      };
      setMantenimientos(ms => [nuevo, ...ms]);
      setToast({ msg: `Mantenimiento ${nuevo.id} registrado`, type: "success" });
    }
    setModal(null);
    setSelected(null);
  };

  const handleGenerarInforme = (mnt) => {
    setModal(null);
    setSelected(null);
    onGenerarInforme(mnt);
  };

  return (
    <div className="page-wrapper">
      {/* Encabezado */}
      <div className="section-header">
        <div>
          <div className="section-title">Mantenimientos</div>
          <div className="section-sub">
            {mantenimientos.length} registros · {abiertos} abiertos
            {stats.sinTecnico > 0 && ` · ${stats.sinTecnico} sin técnico asignado`}
          </div>
        </div>
        <button className="btn btn-primary"
          onClick={() => { setSelected(null); setModal("nuevo"); }}>
          <Plus size={15} /> Registrar mantenimiento
        </button>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        {[
          { label: "Abiertos",       value: stats.Abierto,            color: "var(--accent-warn)" },
          { label: "En proceso",     value: stats["En proceso"],      color: "var(--accent-primary)" },
          { label: "Pend. repuesto", value: stats["Pendiente repuesto"], color: "var(--accent-danger)" },
          { label: "Cerrados",       value: stats.Cerrado,            color: "var(--accent-success)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", padding: "10px 18px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color }}>{value}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.3 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="card">
        {/* Filtros */}
        <div className="filters-bar">
          <div className="search-bar">
            <Search size={14} />
            <input
              placeholder="Buscar por ID, tipo, sistema o ubicación..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Todos", ...SISTEMA_KEYS].map(s => (
              <button key={s}
                className={`btn btn-sm ${filtroSistema === s ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setFiltroSistema(s)}>{s === "Todos" ? s : SISTEMAS[s].label}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Todos", ...ESTADO_KEYS].map(e => (
              <button key={e}
                className={`btn btn-sm ${filtroEstado === e ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setFiltroEstado(e)}>{e === "Todos" ? e : ESTADOS[e].label}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {["Todos", ...PRIORIDAD_KEYS].map(p => (
              <button key={p}
                className={`btn btn-sm ${filtroPrioridad === p ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setFiltroPrioridad(p)}>{p}</button>
            ))}
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Sistema</th>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Vehículo</th>
              <th>Técnico</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th style={{ width: 36 }} />{/* informe: ícono discreto, sin header llamativo */}
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11}>
                  <div className="empty-state">
                    <Wrench size={32} />
                    <p>Sin registros de mantenimiento</p>
                  </div>
                </td>
              </tr>
            )}

            {filtered.map(m => {
              const cli = clientes.find(c => c.id === m.cliente);
              const veh = vehiculos.find(v => v.id === m.vehiculo);

              return (
                <tr key={m.id}>
                  <td><span className="mono text-accent">{m.id}</span></td>
                  <td style={{ fontSize: 12 }}>{formatFechaHora(m.fecha)}</td>
                  <td><SistemaTag sistema={m.sistema} /></td>

                  <td style={{ color: "var(--text-primary)", fontWeight: 500, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.tipo}
                  </td>

                  <td style={{ fontSize: 12 }}>{cli?.codigo || "—"}</td>
                  <td><span className="mono" style={{ fontSize: 12 }}>{veh?.placa || "—"}</span></td>

                  <td style={{ fontSize: 12, color: m.tecnico && m.tecnico !== "Sin asignar" ? "var(--text-secondary)" : "var(--accent-warn)" }}>
                    {m.tecnico && m.tecnico !== "Sin asignar" ? m.tecnico : "Sin asignar"}
                  </td>

                  <td><PrioridadTag prioridad={m.prioridad} /></td>
                  <td><EstadoBadge estado={m.estado} /></td>

                  <td>
                    <InformeIndicator
                      mantenimiento={m}
                      onGenerar={handleGenerarInforme}
                      onNavigate={onNavigateInforme}
                    />
                  </td>

                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-icon" title="Ver detalle"
                        onClick={() => { setSelected(m); setModal("detalle"); }}>
                        <Eye size={14} />
                      </button>
                      <button className="btn-icon" title="Editar"
                        onClick={() => { setSelected(m); setModal("editar"); }}>
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modales */}
      {(modal === "nuevo" || modal === "editar") && (
        <ModalMantenimiento
          mantenimiento={modal === "editar" ? selected : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {modal === "detalle" && selected && (
        <ModalDetalle
          mantenimiento={selected}
          onClose={() => setModal(null)}
          onGenerarInforme={handleGenerarInforme}
          onNavigateInforme={onNavigateInforme}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}