import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Truck, User, MapPin, Hash, Paperclip, Upload,
  CheckCircle2, XCircle, Clock, Save,
  Download, FileDown, SlidersHorizontal, AlertTriangle,
} from "lucide-react";
import { API_BASE } from "../../config/api";
import { getCsrfToken } from "../../utils/csrf";
import { formatFechaHora } from "../../utils/helpers";
import Toast from "../../components/ui/Toast";

const ESTADOS_DD = [
  { value: "PENDIENTE_DD", label: "Pendiente DD" },
  { value: "ENCOLADO", label: "Encolado" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "TERMINADO", label: "Terminado" },
];

function Ficha({ novedad }) {
  const campos = [
    { icon: Hash, label: "Código", value: novedad.codigo_novedad },
    { icon: User, label: "Cliente", value: novedad.cliente },
    
    { icon: Truck, label: "Vehículo", value: `${novedad.vehiculo} · ${novedad.numero_interno}` },
    { icon: User, label: "Conductor", value: novedad.conductor },
    { icon: MapPin, label: "Ruta", value: novedad.ruta },
  ];
  return (
    <div className="card">
      <div className="grid-3" style={{ gap: 12 }}>
        {campos.map((c) => (
          <div key={c.label} style={{
            display: "flex", gap: 10, padding: "10px 12px",
            background: "var(--bg-surface)", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}>
            <c.icon size={14} color="var(--accent-primary)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }} title={c.value}>
                {c.value || "—"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stepper({ estado, onChange }) {
  const activeIndex = ESTADOS_DD.findIndex((e) => e.value === estado);
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Estado de revisión DVR</span></div>
      <div style={{ display: "flex" }}>
        {ESTADOS_DD.map((paso, i) => {
          const done = i <= activeIndex;
          const current = i === activeIndex;
          return (
            <button
              key={paso.value}
              onClick={() => onChange(paso.value)}
              style={{
                flex: 1, position: "relative", padding: "18px 4px 0", textAlign: "left",
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span style={{
                position: "absolute", top: 4, left: 0, width: 11, height: 11, borderRadius: "50%",
                background: done ? "var(--accent-primary)" : "var(--bg-surface)",
                border: `2px solid ${done ? "var(--accent-primary)" : "var(--border)"}`,
                boxShadow: current ? "0 0 0 3px var(--accent-glow)" : "none",
                zIndex: 1,
              }} />
              {i > 0 && (
                <span style={{
                  position: "absolute", top: 9, left: "-50%", right: "50%", height: 2,
                  background: i <= activeIndex ? "var(--accent-primary)" : "var(--border)",
                }} />
              )}
              <div style={{
                fontSize: 12, fontWeight: current ? 700 : 500,
                color: current ? "var(--accent-primary)" : done ? "var(--text-primary)" : "var(--text-muted)",
              }}>
                {paso.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DecisionRevision({
  respuesta, motivoId, detalle, motivos, onRespuesta, onMotivo, onDetalle,
  motivosPositivos, motivoPositivoId, detallePositivo, onMotivoPositivo, onDetallePositivo,
}) {
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Resultado de la revisión</span></div>
      <div style={{ display: "flex", gap: 10, marginBottom: respuesta ? 16 : 0 }}>
        <button
          className={`btn ${respuesta === "Positiva" ? "btn-success" : "btn-secondary"}`}
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => onRespuesta("Positiva")}
        >
          <CheckCircle2 size={15} /> Positiva
        </button>
        <button
          className={`btn ${respuesta === "Negativa" ? "btn-danger" : "btn-secondary"}`}
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => onRespuesta("Negativa")}
        >
          <XCircle size={15} /> Negativa
        </button>
      </div>

      {respuesta === "Positiva" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Motivo</label>
            <select
              className="form-select"
              value={motivoPositivoId || ""}
              onChange={(e) => onMotivoPositivo(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Se encuentran registros de grabación (caso estándar)</option>
              {motivosPositivos.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          {!!motivoPositivoId && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Detalle del caso</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Ej. La regrabación inició a las 14:32, se alcanzó a extraer el clip de las 13:00 a 13:15 antes de que se sobrescribiera..."
                value={detallePositivo}
                onChange={(e) => onDetallePositivo(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {respuesta === "Negativa" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Motivo</label>
            <select className="form-select" value={motivoId || ""} onChange={(e) => onMotivo(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Seleccione un motivo...</option>
              {motivos.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Detalle del caso</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Ej. Se intentó encender con batería externa sin éxito..."
              value={detalle}
              onChange={(e) => onDetalle(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const TRAZA_LABELS = { estado_dd: "Estado DD", respuesta_novedad: "Respuesta", creacion: "Creación" };

const COLUMNAS_EXPORT = [
  { key: "fecha", label: "Fecha" },
  { key: "hora", label: "Hora" },
  { key: "campo", label: "Campo" },
  { key: "valor_anterior", label: "Valor anterior" },
  { key: "valor_nuevo", label: "Valor nuevo" },
  { key: "usuario", label: "Usuario" },
  { key: "duracion", label: "Tiempo desde el evento anterior" },
];

// Duración legible (ej. "2h 15m", "1d 4h") a partir de una diferencia en ms.
function formatDuracion(ms) {
  const totalMin = Math.round(ms / 60000);
  const dias = Math.floor(totalMin / 1440);
  const horas = Math.floor((totalMin % 1440) / 60);
  const minutos = totalMin % 60;
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${minutos}m`;
  return `${Math.max(1, minutos)}m`;
}

// Umbral genérico de "esto se está demorando" para el ritmo entre eventos
// consecutivos de la bitácora — no es el SLA formal por tipo de informe
// (ese vive en PanelSLA), es solo una señal visual rápida dentro del propio
// historial para detectar pasos que tardaron más de lo normal.
function nivelDemora(deltaMs) {
  const horas = deltaMs / 3_600_000;
  if (horas > 24) return "alerta";
  if (horas > 8) return "atencion";
  return "normal";
}

// Umbral propio (en días, no horas) para el primer tramo del historial —
// creación de la novedad hasta el primer cambio real (normalmente ENCOLADO)
// — porque esa espera depende de cuándo llega la DVR física, no del ritmo
// de trabajo del analista, y "unos días" ahí es normal, no una alerta.
function nivelEsperaDD(deltaMs) {
  const dias = deltaMs / (3_600_000 * 24);
  if (dias > 7) return "alerta";
  if (dias > 3) return "atencion";
  return "normal";
}

function exportarTrazabilidadCSV(eventosConDelta, columnasVisibles, codigoNovedad) {
  const columnas = COLUMNAS_EXPORT.filter((c) => columnasVisibles[c.key]);
  const encabezado = columnas.map((c) => c.label).join(",");
  const filas = eventosConDelta.map((ev) => {
    const fechaObj = new Date(ev.creado);
    const fila = {
      fecha: fechaObj.toLocaleDateString("es-CO"),
      hora: fechaObj.toLocaleTimeString("es-CO", { hour12: false }),
      campo: TRAZA_LABELS[ev.campo] || ev.campo,
      valor_anterior: ev.valor_anterior || "—",
      valor_nuevo: ev.valor_nuevo || "—",
      usuario: ev.usuario || "Sistema",
      duracion: ev.deltaMs != null ? formatDuracion(ev.deltaMs) : "—",
    };
    return columnas.map((c) => `"${String(fila[c.key]).replace(/"/g, '""')}"`).join(",");
  });

  const csv = [encabezado, ...filas].join("\r\n");
  // BOM al inicio para que Excel detecte UTF-8 y no rompa las tildes/ñ.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `trazabilidad_${codigoNovedad || "novedad"}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

function SelectorColumnasExport({ visibles, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn btn-sm btn-secondary" onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal size={12} /> Columnas
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)", padding: "8px 0", minWidth: 230,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {COLUMNAS_EXPORT.map((col) => (
            <label key={col.key} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "6px 14px", cursor: "pointer",
              background: visibles[col.key] ? "var(--accent-glow)" : "transparent",
            }}>
              <input
                type="checkbox"
                checked={!!visibles[col.key]}
                onChange={() => onToggle(col.key)}
                style={{ accentColor: "var(--accent-primary)", width: 14, height: 14 }}
              />
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const NIVEL_COLOR = {
  alerta: "var(--accent-danger)",
  atencion: "var(--accent-warn)",
  normal: "var(--text-muted)",
};
const NIVEL_BG = {
  alerta: "var(--accent-danger-soft)",
  atencion: "var(--accent-warn-soft)",
  normal: "var(--bg-surface)",
};

function Trazabilidad({ novedad, eventos }) {
  const [columnasVisibles, setColumnasVisibles] = useState(() =>
    Object.fromEntries(COLUMNAS_EXPORT.map((c) => [c.key, true]))
  );

  const toggleColumna = (key) => setColumnasVisibles((prev) => ({ ...prev, [key]: !prev[key] }));

  // El historial arranca desde que se creó la novedad (no desde el primer
  // cambio de estado_dd): las novedades llegan por correo y se registran de
  // inmediato, pero la DVR física puede tardar días en llegar — ese primer
  // tramo (creación -> primer cambio real) es justo lo que se quiere ver
  // reflejado en la trazabilidad, no solo el SLA formal de revisión.
  const eventoCreacion = {
    id: "creacion",
    campo: "creacion",
    valor_anterior: null,
    valor_nuevo: "Registrada",
    usuario: novedad.analista,
    creado: novedad.fecha_creacion,
    esCreacion: true,
  };
  const linea = [eventoCreacion, ...eventos];

  // Cada evento con el tiempo transcurrido desde el anterior: el primer
  // tramo (espera de la DVR) usa umbrales en días; el resto (ritmo de
  // revisión entre analistas) usa los umbrales en horas de siempre.
  const eventosConDelta = linea.map((ev, i) => {
    if (i === 0) return { ...ev, deltaMs: null, nivel: null };
    const anterior = linea[i - 1];
    const deltaMs = new Date(ev.creado) - new Date(anterior.creado);
    const esEsperaDD = !!anterior.esCreacion;
    return { ...ev, deltaMs, esEsperaDD, nivel: esEsperaDD ? nivelEsperaDD(deltaMs) : nivelDemora(deltaMs) };
  });

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><Clock size={15} /> Trazabilidad</span>
        <div style={{ display: "flex", gap: 6 }}>
          <SelectorColumnasExport visibles={columnasVisibles} onToggle={toggleColumna} />
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => exportarTrazabilidadCSV(eventosConDelta, columnasVisibles, novedad.codigo_novedad)}
          >
            <Download size={12} /> Exportar CSV
          </button>
          <button className="btn btn-sm btn-secondary" title="Próximamente">
            <FileDown size={12} /> Exportar PDF
          </button>
        </div>
      </div>
      <div style={{ position: "relative", paddingLeft: 22 }}>
        <span style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: 2, background: "var(--border)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {eventosConDelta.map((ev) => (
            <div key={ev.id} style={{ position: "relative", fontSize: 12.5 }}>
              <span style={{
                position: "absolute", left: -22, top: 3, width: 10, height: 10, borderRadius: "50%",
                background: ev.nivel ? NIVEL_COLOR[ev.nivel] : "var(--accent-primary)",
                border: "2px solid var(--bg-card)",
              }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                <span style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                  {formatFechaHora(ev.creado)}
                </span>
                {ev.deltaMs != null && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700,
                    padding: "1px 7px", borderRadius: 99,
                    background: NIVEL_BG[ev.nivel], color: NIVEL_COLOR[ev.nivel],
                  }}>
                    {ev.nivel === "alerta" && <AlertTriangle size={10} />}
                    {ev.esEsperaDD ? "Espera DVR: " : "+"}{formatDuracion(ev.deltaMs)}
                  </span>
                )}
              </div>
              {ev.esCreacion ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  {ev.usuario || "Sistema"} registró la novedad <b style={{ color: "var(--text-primary)" }}>{novedad.codigo_novedad}</b>
                </div>
              ) : (
                <div style={{ color: "var(--text-secondary)" }}>
                  {ev.usuario || "Sistema"} cambió <b style={{ color: "var(--text-primary)" }}>{TRAZA_LABELS[ev.campo] || ev.campo}</b> de "{ev.valor_anterior || "—"}" a "{ev.valor_nuevo || "—"}"
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SLA_COLOR = {
  A_TIEMPO: "var(--accent-success)",
  FINALIZADO_A_TIEMPO: "var(--accent-success)",
  EN_RIESGO: "var(--accent-warn)",
  VENCIDO: "var(--accent-danger)",
  FINALIZADO_FUERA_DE_TIEMPO: "var(--accent-danger)",
};

const SLA_BG = {
  A_TIEMPO: "var(--accent-success-soft)",
  FINALIZADO_A_TIEMPO: "var(--accent-success-soft)",
  EN_RIESGO: "var(--accent-warn-soft)",
  VENCIDO: "var(--accent-danger-soft)",
  FINALIZADO_FUERA_DE_TIEMPO: "var(--accent-danger-soft)",
};

const ESPERA_COLOR = { alerta: "var(--accent-danger)", atencion: "var(--accent-warn)", normal: "var(--accent-success)" };
const ESPERA_BG = { alerta: "var(--accent-danger-soft)", atencion: "var(--accent-warn-soft)", normal: "var(--accent-success-soft)" };
const ESPERA_LABEL = { alerta: "Demora prolongada", atencion: "Demorando", normal: "En tiempo normal" };

// Distinto del SLA de revisión (PanelSLA, que solo corre ENCOLADO -> TERMINADO):
// las novedades llegan por correo y se registran de inmediato, pero la DVR
// física puede tardar varios días en llegar. Este panel mide justamente esa
// espera — desde que se creó la novedad hasta que quedó ENCOLADA.
function PanelEsperaDD({ novedad }) {
  const nivel = novedad.nivel_espera_dd;
  const color = ESPERA_COLOR[nivel] || "var(--text-muted)";
  const bg = ESPERA_BG[nivel] || "var(--accent-glow)";
  const horas = novedad.horas_espera_dd ?? 0;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><Truck size={15} /> Espera de la DVR</span>
        <span className="badge" style={{ background: bg, color }}>
          {novedad.en_espera_dd ? ESPERA_LABEL[nivel] : "Ya llegó"}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>
        {novedad.en_espera_dd
          ? "Tiempo transcurrido desde que se registró la novedad, mientras se espera que la DVR llegue y quede ENCOLADA."
          : "Tiempo que tardó la DVR en llegar: desde que se registró la novedad hasta que quedó ENCOLADA."}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: novedad.en_espera_dd ? color : "var(--text-primary)" }}>
        {formatDuracion(horas * 3_600_000)}
      </div>
    </div>
  );
}

function PanelSLA({ novedad }) {
  const estado = novedad.sla_estado;

  if (estado === "SIN_SLA" || estado === "SIN_INICIAR") {
    return (
      <div className="card">
        <div className="card-header"><span className="card-title"><Clock size={15} /> Tiempo de revisión (SLA)</span></div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {estado === "SIN_SLA"
            ? "Este tipo de informe no tiene un tiempo máximo configurado."
            : "El conteo iniciará cuando el estado pase a ENCOLADO."}
        </div>
      </div>
    );
  }

  const color = SLA_COLOR[estado] || "var(--accent-primary)";
  const bg = SLA_BG[estado] || "var(--accent-glow)";
  const transcurridas = novedad.sla_horas_transcurridas ?? 0;
  const limite = novedad.sla_horas;
  const pct = limite ? Math.min(100, (transcurridas / limite) * 100) : 0;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><Clock size={15} /> Tiempo de revisión (SLA)</span>
        <span className="badge" style={{ background: bg, color }}>
          {novedad.sla_estado_display}
        </span>
      </div>
      <div className="grid-3" style={{ gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
            Transcurridas
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{transcurridas}h</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
            Límite
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{limite}h</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
            {novedad.sla_horas_restantes != null && novedad.sla_horas_restantes < 0 ? "Vencida por" : "Restantes"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color }}>
            {novedad.sla_horas_restantes != null ? `${Math.abs(novedad.sla_horas_restantes)}h` : "—"}
          </div>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "var(--bg-surface)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function Evidencia({ evidencias, onUpload, subiendo }) {
  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><Paperclip size={15} /> Evidencia adjunta</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
        {evidencias.map((ev) => (
          <a
            key={ev.id}
            href={`${API_BASE}${ev.archivo}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block", aspectRatio: "4 / 3", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)", overflow: "hidden", position: "relative",
              background: "var(--bg-surface)",
            }}
          >
            <img src={`${API_BASE}${ev.archivo}`} alt={ev.descripcion || "Evidencia"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </a>
        ))}
        <label style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
          aspectRatio: "4 / 3", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border)",
          color: "var(--text-muted)", fontSize: 11, cursor: subiendo ? "default" : "pointer",
        }}>
          <Upload size={16} />
          {subiendo ? "Subiendo..." : "Agregar"}
          <input type="file" accept="image/*" style={{ display: "none" }} disabled={subiendo}
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
      </div>
    </div>
  );
}

export default function NovedadDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [novedad, setNovedad] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [motivosPositivos, setMotivosPositivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [subiendoEvidencia, setSubiendoEvidencia] = useState(false);
  const [toast, setToast] = useState(null);

  const [estadoDD, setEstadoDD] = useState("PENDIENTE_DD");
  const [respuesta, setRespuesta] = useState(null);
  const [motivoId, setMotivoId] = useState(null);
  const [detalle, setDetalle] = useState("");
  const [motivoPositivoId, setMotivoPositivoId] = useState(null);
  const [detallePositivo, setDetallePositivo] = useState("");

  const cargarNovedad = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/novedades/${id}/`, { credentials: "include" });
    if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
    const data = await res.json();
    setNovedad(data);
    setEstadoDD(data.estado_dd);
    setRespuesta(data.respuesta_novedad);
    setMotivoId(data.motivo_negativo_id);
    setDetalle(data.detalle_motivo_negativo || "");
    setMotivoPositivoId(data.motivo_positivo_id);
    setDetallePositivo(data.detalle_motivo_positivo || "");
  }, [id]);

  const cargarEventos = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/novedades/${id}/eventos/`, { credentials: "include" });
    if (res.ok) setEventos(await res.json());
  }, [id]);

  // Actualiza solo los campos de SLA/estado_dd en vivo, sin tocar el estado
  // editable local (estadoDD, respuesta, motivoId, detalle) — un refresco
  // completo vía cargarNovedad() revertiría cualquier cambio sin guardar del
  // analista en el Stepper o la Decisión de revisión.
  const actualizarSLA = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/novedades/${id}/`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setNovedad((prev) => prev && ({
      ...prev,
      sla_horas: data.sla_horas,
      sla_horas_transcurridas: data.sla_horas_transcurridas,
      sla_horas_restantes: data.sla_horas_restantes,
      sla_estado: data.sla_estado,
      sla_estado_display: data.sla_estado_display,
      horas_espera_dd: data.horas_espera_dd,
      en_espera_dd: data.en_espera_dd,
      nivel_espera_dd: data.nivel_espera_dd,
      estado_dd: data.estado_dd,
    }));
  }, [id]);

  useEffect(() => {
    if (!novedad || novedad.estado_dd === "TERMINADO") return;
    const intervalo = setInterval(() => { actualizarSLA(); cargarEventos(); }, 60000);
    return () => clearInterval(intervalo);
  }, [novedad?.estado_dd, actualizarSLA, cargarEventos]);

  useEffect(() => {
    let cancelado = false;
    async function cargarTodo() {
      setLoading(true);
      setLoadError(null);
      try {
        await Promise.all([
          cargarNovedad(),
          cargarEventos(),
          fetch(`${API_BASE}/api/motivos-negativa/`, { credentials: "include" })
            .then((r) => r.json()).then((data) => { if (!cancelado) setMotivos(data); }),
          fetch(`${API_BASE}/api/motivos-positiva/`, { credentials: "include" })
            .then((r) => r.json()).then((data) => { if (!cancelado) setMotivosPositivos(data); }),
        ]);
      } catch (err) {
        if (!cancelado) setLoadError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    }
    cargarTodo();
    return () => { cancelado = true; };
  }, [cargarNovedad, cargarEventos]);

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/novedades/${id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({
          estado_dd: estadoDD,
          respuesta_novedad: respuesta,
          motivo_negativo_id: respuesta === "Negativa" ? motivoId : null,
          detalle_motivo_negativo: respuesta === "Negativa" ? detalle : "",
          motivo_positivo_id: respuesta === "Positiva" ? motivoPositivoId : null,
          detalle_motivo_positivo: respuesta === "Positiva" ? detallePositivo : "",
        }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo guardar");
      await Promise.all([cargarNovedad(), cargarEventos()]);
      setToast({ msg: "Revisión actualizada", type: "success" });
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (archivo) => {
    setSubiendoEvidencia(true);
    try {
      const form = new FormData();
      form.append("archivo", archivo);
      const res = await fetch(`${API_BASE}/api/novedades/${id}/evidencia/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: form,
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo subir la evidencia");
      await cargarNovedad();
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
    } finally {
      setSubiendoEvidencia(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: "var(--text-muted)" }}>Cargando novedad…</div>;
  }

  if (loadError || !novedad) {
    return (
      <div className="card" style={{ color: "var(--accent-danger)" }}>
        No se pudo cargar la novedad: {loadError || "no encontrada"}
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/novedades")} style={{ marginBottom: 10 }}>
            <ArrowLeft size={14} /> Volver a novedades
          </button>
          <div className="hero-eyebrow">Revisión de DVR</div>
          <h2 className="hero-title">{novedad.codigo_novedad}</h2>
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
            <Save size={15} /> {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>

      <Ficha novedad={novedad} />
      <Stepper estado={estadoDD} onChange={setEstadoDD} />

      <div className="grid-2" style={{ alignItems: "start" }}>
        <PanelEsperaDD novedad={novedad} />
        <PanelSLA novedad={novedad} />
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <DecisionRevision
          respuesta={respuesta}
          motivoId={motivoId}
          detalle={detalle}
          motivos={motivos}
          onRespuesta={setRespuesta}
          onMotivo={setMotivoId}
          onDetalle={setDetalle}
          motivosPositivos={motivosPositivos}
          motivoPositivoId={motivoPositivoId}
          detallePositivo={detallePositivo}
          onMotivoPositivo={setMotivoPositivoId}
          onDetallePositivo={setDetallePositivo}
        />
        <Trazabilidad novedad={novedad} eventos={eventos} />
      </div>

      <Evidencia evidencias={novedad.evidencias || []} onUpload={handleUpload} subiendo={subiendoEvidencia} />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
