import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ExcelJS from "exceljs";
import {
  ArrowLeft, Truck, User, MapPin, Hash, Paperclip, Upload,
  CheckCircle2, XCircle, Clock, Save,
  Download, FileDown, SlidersHorizontal, AlertTriangle, Plus, X,
} from "lucide-react";
import { API_BASE } from "../../config/api";
import { getCsrfToken } from "../../utils/csrf";
import { formatFechaHora } from "../../utils/helpers";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { tienePermiso } from "../../utils/permisos";

const ESTADOS_DD = [
  { value: "PENDIENTE_DD", label: "Pendiente DD" },
  { value: "ENCOLADO", label: "Encolado" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "TERMINADO", label: "Terminado" },
];

function Ficha({ novedad, informe }) {
  const campos = [
    { icon: Hash, label: "Código", value: novedad.codigo_novedad },
    { icon: User, label: "Cliente", value: novedad.cliente },
    { icon: Paperclip, label: "Tipo informe", value: informe?.nombre || novedad.informe?.nombre },
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

function Stepper({ estado, onChange, disabled }) {
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
              onClick={() => !disabled && onChange(paso.value)}
              disabled={disabled}
              style={{
                flex: 1, position: "relative", padding: "18px 4px 0", textAlign: "left",
                background: "none", border: "none", cursor: disabled ? "default" : "pointer",
                fontFamily: "inherit", opacity: disabled ? 0.75 : 1,
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

// Select de motivo (Positiva/Negativa) que además permite agregar una
// opción nueva ahí mismo si el catálogo no cubre el caso -- abierto a
// cualquier usuario que pueda editar la revisión, sin necesitar ningún
// permiso de administración (el backend lo respalda: crear un motivo nuevo
// desde acá no requiere administracion.gestionar_novedades).
function MotivoCombobox({ value, options, onSeleccionar, onCrearNuevo, placeholder, emptyLabel, disabled }) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [creando, setCreando] = useState(false);
  const ref = useRef(null);

  const seleccionado = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) setTexto(seleccionado ? seleccionado.label : "");
  }, [value, options]); // eslint-disable-line

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const textoNorm = texto.trim().toLowerCase();
  const filtradas = textoNorm ? options.filter((o) => o.label.toLowerCase().includes(textoNorm)) : options;
  const coincideExacto = options.some((o) => o.label.toLowerCase() === textoNorm);
  const puedeCrear = !!textoNorm && !coincideExacto;

  const elegir = (id, label) => {
    onSeleccionar(id);
    setTexto(label);
    setOpen(false);
  };

  const crear = async () => {
    const nombre = texto.trim();
    if (!nombre || creando) return;
    setCreando(true);
    try {
      const nuevo = await onCrearNuevo(nombre);
      if (nuevo) elegir(nuevo.value, nuevo.label);
    } finally {
      setCreando(false);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        className="form-input"
        placeholder={placeholder}
        value={texto}
        disabled={disabled}
        onChange={(e) => { setTexto(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); setTexto(seleccionado ? seleccionado.label : ""); }}
        autoComplete="off"
      />
      {open && !disabled && (emptyLabel || filtradas.length > 0 || puedeCrear) && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-md, 10px)", padding: "6px 0", maxHeight: 220, overflowY: "auto",
          boxShadow: "0 12px 28px -8px rgba(0,0,0,0.35)",
        }}>
          {emptyLabel && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(null, "")} style={{
              display: "block", width: "100%", textAlign: "left", padding: "7px 12px",
              background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: 13, color: "var(--text-muted)", fontStyle: "italic",
            }}>
              {emptyLabel}
            </button>
          )}
          {filtradas.map((o) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(o.value, o.label)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "7px 12px",
                background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, color: "var(--text-primary)",
              }}
            >
              {o.label}
            </button>
          ))}
          {puedeCrear && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={crear}
              disabled={creando}
              style={{
                display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left",
                padding: "7px 12px", background: "none", border: "none", cursor: creando ? "default" : "pointer",
                fontFamily: "inherit", fontSize: 12.5, color: "var(--accent-primary)", fontWeight: 600,
                borderTop: (filtradas.length > 0 || emptyLabel) ? "1px solid var(--border)" : "none",
              }}
            >
              <Plus size={12} /> {creando ? "Agregando..." : `Agregar "${texto.trim()}" como motivo nuevo`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DecisionRevision({
  respuesta, motivoId, detalle, motivos, onRespuesta, onMotivo, onDetalle,
  motivosPositivos, motivoPositivoId, detallePositivo, onMotivoPositivo, onDetallePositivo,
  onCrearMotivo, onCrearMotivoPositivo,
  disabled,
}) {
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Resultado de la revisión</span></div>
      <div style={{ display: "flex", gap: 10, marginBottom: respuesta ? 16 : 0 }}>
        <button
          className={`btn ${respuesta === "Positiva" ? "btn-success" : "btn-secondary"}`}
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => onRespuesta("Positiva")}
          disabled={disabled}
        >
          <CheckCircle2 size={15} /> Positiva
        </button>
        <button
          className={`btn ${respuesta === "Negativa" ? "btn-danger" : "btn-secondary"}`}
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => onRespuesta("Negativa")}
          disabled={disabled}
        >
          <XCircle size={15} /> Negativa
        </button>
      </div>

      {respuesta === "Positiva" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Motivo</label>
            <MotivoCombobox
              value={motivoPositivoId}
              options={motivosPositivos}
              onSeleccionar={onMotivoPositivo}
              onCrearNuevo={onCrearMotivoPositivo}
              placeholder="Se encuentran registros de grabación (caso estándar)"
              emptyLabel="Se encuentran registros de grabación (caso estándar)"
              disabled={disabled}
            />
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
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}

      {respuesta === "Negativa" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Motivo</label>
            <MotivoCombobox
              value={motivoId}
              options={motivos}
              onSeleccionar={onMotivo}
              onCrearNuevo={onCrearMotivo}
              placeholder="Seleccione o escriba un motivo..."
              disabled={disabled}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Detalle del caso</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Ej. Se intentó encender con batería externa sin éxito..."
              value={detalle}
              onChange={(e) => onDetalle(e.target.value)}
              disabled={disabled}
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

// Ancho de columna / tipo de dato por clave -- ExcelJS necesita esto
// aparte, ya que COLUMNAS_EXPORT solo define la etiqueta visible en el
// selector de columnas (compartido con la vista en pantalla).
const COLUMNA_XLSX = {
  fecha: { width: 13, tipo: "fecha" },
  hora: { width: 11, tipo: "texto" },
  campo: { width: 16, tipo: "texto" },
  valor_anterior: { width: 24, tipo: "texto" },
  valor_nuevo: { width: 24, tipo: "texto" },
  usuario: { width: 22, tipo: "texto" },
  duracion: { width: 32, tipo: "texto" },
};

const NIVEL_FILL_XLSX = {
  alerta: "FFFEE2E2",
  atencion: "FFFEF3C7",
};
const NIVEL_FONT_XLSX = {
  alerta: "FF991B1B",
  atencion: "FF92400E",
};

async function exportarTrazabilidadXLSX(eventosConDelta, columnasVisibles, novedad) {
  const columnas = COLUMNAS_EXPORT.filter((c) => columnasVisibles[c.key]);
  const codigoNovedad = novedad.codigo_novedad || "novedad";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Colfenix GPS";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Trazabilidad", {
    views: [{ state: "frozen", ySplit: 5 }],
  });
  hoja.columns = columnas.map((c) => ({ key: c.key, width: COLUMNA_XLSX[c.key]?.width || 18 }));

  // --- Bloque de encabezado (título + metadata de la novedad) ---
  hoja.mergeCells(1, 1, 1, columnas.length);
  const celdaTitulo = hoja.getCell(1, 1);
  celdaTitulo.value = `Trazabilidad — ${codigoNovedad}`;
  celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };

  hoja.mergeCells(2, 1, 2, columnas.length);
  const celdaMeta = hoja.getCell(2, 1);
  celdaMeta.value = `Cliente: ${novedad.cliente || "—"}   ·   Vehículo: ${novedad.vehiculo || "—"}   ·   Analista: ${novedad.analista || "—"}`;
  celdaMeta.font = { size: 10.5, color: { argb: "FF475569" } };

  hoja.mergeCells(3, 1, 3, columnas.length);
  const celdaExportado = hoja.getCell(3, 1);
  celdaExportado.value = `Exportado: ${new Date().toLocaleString("es-CO")}`;
  celdaExportado.font = { size: 9.5, italic: true, color: { argb: "FF94A3B8" } };

  // --- Encabezado de la tabla ---
  const filaEncabezado = hoja.getRow(5);
  columnas.forEach((c, i) => {
    const celda = filaEncabezado.getCell(i + 1);
    celda.value = c.label;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F8CFF" } };
    celda.alignment = { vertical: "middle", horizontal: "left" };
    celda.border = { bottom: { style: "thin", color: { argb: "FF2563EB" } } };
  });
  filaEncabezado.height = 20;
  hoja.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: columnas.length } };

  // --- Filas de datos ---
  eventosConDelta.forEach((ev) => {
    const fechaObj = new Date(ev.creado);
    const duracionTexto = ev.deltaMs != null
      ? `${ev.esEsperaDD ? "Espera DVR: " : "+"}${formatDuracion(ev.deltaMs)}`
      : "—";
    const valores = {
      fecha: fechaObj,
      hora: fechaObj.toLocaleTimeString("es-CO", { hour12: false }),
      campo: TRAZA_LABELS[ev.campo] || ev.campo,
      valor_anterior: ev.valor_anterior || "—",
      valor_nuevo: ev.valor_nuevo || "—",
      usuario: ev.usuario || "Sistema",
      duracion: duracionTexto,
    };

    const fila = hoja.addRow(columnas.map((c) => valores[c.key]));
    fila.eachCell((celda, colNumero) => {
      const clave = columnas[colNumero - 1].key;
      celda.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
      if (clave === "fecha") celda.numFmt = "dd/mm/yyyy";
      // Resalta la fila igual que el punto de color en la línea de tiempo en
      // pantalla: alerta (rojo) / atención (ámbar) cuando un tramo tardó más
      // de lo normal, para que salte a la vista también en Excel.
      if (ev.nivel && NIVEL_FILL_XLSX[ev.nivel]) {
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NIVEL_FILL_XLSX[ev.nivel] } };
        celda.font = { ...(celda.font || {}), color: { argb: NIVEL_FONT_XLSX[ev.nivel] } };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `trazabilidad_${codigoNovedad}.xlsx`;
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

function Trazabilidad({ novedad, eventos, puedeExportar }) {
  const [columnasVisibles, setColumnasVisibles] = useState(() =>
    Object.fromEntries(COLUMNAS_EXPORT.map((c) => [c.key, true]))
  );
  const [exportando, setExportando] = useState(false);

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

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarTrazabilidadXLSX(eventosConDelta, columnasVisibles, novedad);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><Clock size={15} /> Trazabilidad</span>
        <div style={{ display: "flex", gap: 6 }}>
          {puedeExportar && (
            <>
              <SelectorColumnasExport visibles={columnasVisibles} onToggle={toggleColumna} />
              <button
                className="btn btn-sm btn-secondary"
                onClick={exportar}
                disabled={exportando}
              >
                <Download size={12} /> {exportando ? "Generando..." : "Exportar Excel"}
              </button>
              <button className="btn btn-sm btn-secondary" title="Próximamente">
                <FileDown size={12} /> Exportar PDF
              </button>
            </>
          )}
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

function Evidencia({ evidencias, onUpload, subiendo, puedeSubir, onEliminar }) {
  const [eliminandoId, setEliminandoId] = useState(null);

  const eliminar = async (ev) => {
    if (!window.confirm("¿Quitar esta imagen de evidencia?")) return;
    setEliminandoId(ev.id);
    try {
      await onEliminar(ev.id);
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><Paperclip size={15} /> Evidencia adjunta</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
        {evidencias.map((ev) => (
          <div
            key={ev.id}
            style={{
              aspectRatio: "4 / 3", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)", overflow: "hidden", position: "relative",
              background: "var(--bg-surface)",
            }}
          >
            <a href={`${API_BASE}${ev.archivo}`} target="_blank" rel="noreferrer" style={{ display: "block", width: "100%", height: "100%" }}>
              <img src={`${API_BASE}${ev.archivo}`} alt={ev.descripcion || "Evidencia"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </a>
            {puedeSubir && (
              <button
                type="button"
                title="Quitar imagen"
                onClick={() => eliminar(ev)}
                disabled={eliminandoId === ev.id}
                style={{
                  position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(15, 23, 42, 0.72)", color: "#fff", border: "none",
                  cursor: eliminandoId === ev.id ? "default" : "pointer",
                  opacity: eliminandoId === ev.id ? 0.6 : 1,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {puedeSubir && (
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
        )}
      </div>
    </div>
  );
}

export default function NovedadDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const puedeEditar = tienePermiso(user, "novedades.editar");
  const puedeSubirEvidencia = tienePermiso(user, "novedades.subir_evidencia");
  const puedeExportar = tienePermiso(user, "novedades.exportar");

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

  const handleEliminarEvidencia = async (evidenciaId) => {
    try {
      const res = await fetch(`${API_BASE}/api/novedades/evidencia/${evidenciaId}/eliminar/`, {
        method: "DELETE",
        headers: { "X-CSRFToken": getCsrfToken() },
        credentials: "include",
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo quitar la evidencia");
      setNovedad((prev) => prev && ({ ...prev, evidencias: prev.evidencias.filter((e) => e.id !== evidenciaId) }));
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
    }
  };

  // Agregar un motivo nuevo desde el propio combobox de "Resultado de la
  // revisión" -- abierto a cualquier usuario que pueda editar la revisión,
  // sin permiso de administración (el backend ya no exige
  // administracion.gestionar_novedades para este endpoint puntual).
  const crearMotivo = async (nombre) => {
    try {
      const res = await fetch(`${API_BASE}/api/motivos-negativa/crear/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ nombre }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo agregar el motivo");
      setMotivos((ms) => (ms.some((m) => m.value === resultado.motivo.value) ? ms : [...ms, resultado.motivo]));
      return resultado.motivo;
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
      return null;
    }
  };

  const crearMotivoPositivo = async (nombre) => {
    try {
      const res = await fetch(`${API_BASE}/api/motivos-positiva/crear/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ nombre }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo agregar el motivo");
      setMotivosPositivos((ms) => (ms.some((m) => m.value === resultado.motivo.value) ? ms : [...ms, resultado.motivo]));
      return resultado.motivo;
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
      return null;
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
        {puedeEditar && (
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
              <Save size={15} /> {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}
      </div>

      <Ficha novedad={novedad} />
      <Stepper estado={estadoDD} onChange={setEstadoDD} disabled={!puedeEditar} />

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
          onCrearMotivo={crearMotivo}
          onCrearMotivoPositivo={crearMotivoPositivo}
          disabled={!puedeEditar}
        />
        <Trazabilidad novedad={novedad} eventos={eventos} puedeExportar={puedeExportar} />
      </div>

      <Evidencia
        evidencias={novedad.evidencias || []}
        onUpload={handleUpload}
        subiendo={subiendoEvidencia}
        puedeSubir={puedeSubirEvidencia}
        onEliminar={handleEliminarEvidencia}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
