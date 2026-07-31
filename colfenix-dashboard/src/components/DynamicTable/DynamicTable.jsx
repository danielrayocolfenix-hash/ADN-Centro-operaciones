import { useState, useEffect, useMemo, useRef } from "react";
import ExcelJS from "exceljs";
import Tooltip from "../DynamicForm/Tooltip";
import DrawerPanel from "../ui/DrawerPanel";
import { API_BASE } from "../../config/api";
import { hexToArgb, slug, formatFechaCortaISO, formatDuracionLarga } from "../../utils/helpers";

// ─── Configuración de columnas ───────────────────────────────────────────────
// Cada entrada mapea 1:1 con los campos que retorna novedades_view en Django.
// defaultVisible: false → la columna existe pero empieza oculta.
// defaultFilterable: además de visible/oculta, cada columna puede empezar
// mostrando o no un input de filtro rápido en la fila de "Filtros" -- son
// dos cosas independientes (una columna oculta igual se puede filtrar, ej.
// filtrar por cliente sin tener esa columna en pantalla). El set de acá
// abajo es el de las columnas que más se usan para acotar la bandeja de
// un vistazo; el resto se puede activar desde "Elegir filtros".
const COLUMN_DEFINITIONS = [
  { key: "id",                     label: "ID",                   type: "number", defaultVisible: false },
  { key: "codigo_novedad",         label: "Código novedad",       type: "text",   defaultVisible: true  },
  { key: "vehiculo",               label: "Vehículo (placa)",     type: "text",   defaultVisible: true  },
  { key: "numero_interno",         label: "N.º interno",          type: "text",   defaultVisible: true },
  { key: "grupo_flota",            label: "Grupo flota",          type: "text",   defaultVisible: true,  defaultFilterable: true },
  { key: "area_solicitante",       label: "Área solicitante",     type: "text",   defaultVisible: false },
  { key: "tipo_informe",           label: "Tipo informe",         type: "text",   defaultVisible: true  },
  { key: "categoria_informe",      label: "Categoría informe",    type: "text",   defaultVisible: true  },
  { key: "nivel_prioridad",        label: "Prioridad",            type: "badge",  defaultVisible: true, defaultFilterable: true },
  { key: "ruta",                   label: "Ruta Realizada",       type: "text",   defaultVisible: false },
  { key: "analista",               label: "Analista de ingreso",  type: "text",   defaultVisible: true,  defaultFilterable: true },
  { key: "conductor",              label: "Conductor",            type: "text",   defaultVisible: false },
  { key: "nas",                    label: "NAS",                  type: "text",   defaultVisible: false },
  { key: "pasajeros_reportados",   label: "Pasajeros",            type: "number", defaultVisible: false },
  { key: "fecha_novedad",          label: "Fecha novedad",        type: "date",   defaultVisible: true  },
  { key: "fecha_solicitud",        label: "Fecha solicitud",      type: "date",   defaultVisible: false },
  { key: "fecha_recepcion_dd",     label: "Recepción DD",         type: "date",   defaultVisible: false },
  { key: "fecha_inicio_revision",  label: "Inicio revisión",      type: "date",   defaultVisible: false },
  { key: "fecha_fin_revision",     label: "Fin revisión",         type: "date",   defaultVisible: false },
  { key: "estado_dd_display",      label: "Estado DD",            type: "badge",  defaultVisible: true,  defaultFilterable: true },
  { key: "sla_estado_display",     label: "SLA (Tiempo de respuesta)", type: "badge",  defaultVisible: true,  defaultFilterable: true },
  { key: "sla_horas_transcurridas", label: "Tiempo SLA transcurrido", type: "duracion", defaultVisible: true },
  { key: "estado_novedad_display", label: "Estado novedad",       type: "badge",  defaultVisible: true,  defaultFilterable: true },
  { key: "respuesta_novedad",      label: "Respuesta novedad",    type: "badge",  defaultVisible: true  },
  { key: "observaciones",          label: "Observaciones",        type: "textarea",defaultVisible: false },
  { key: "fecha_creacion",         label: "Creado",               type: "date",   defaultVisible: false },
  { key: "fecha_actualizacion",    label: "Actualizado",          type: "date",   defaultVisible: false },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ─── Datos mock — se usan si el backend no responde ─────────────────────────
const MOCK_DATA = Array.from({ length: 47 }, (_, i) => ({
  id: i + 1,
  codigo_novedad: `NOV-${String(i + 1).padStart(4, "0")}`,
  cliente_id: (i % 5) + 1,
  cliente: ["Expreso Brasilia", "Flota Magdalena", "Coomoepal", "Líneas Caribenas", "Flota Cachira"][(i % 5)],
  vehiculo_id: i + 10,
  vehiculo: `BYD-${String(i + 100).padStart(3, "0")}`,
  numero_interno: `INT-${i + 1}`,
  grupo_flota_id: (i % 3) + 1,
  grupo_flota: ["Flota Norte", "Flota Sur", "Flota Centro"][(i % 3)],
  area_solicitante_id: (i % 4) + 1,
  area_solicitante: ["Operaciones", "Mantenimiento", "Seguridad", "Gestión DD"][(i % 4)],
  tipo_informe_id: (i % 3) + 1,
  tipo_informe: ["Informe técnico", "Informe operativo", "Informe de seguridad"][(i % 3)],
  categoria_informe_id: (i % 2) + 1,
  categoria_informe: ["Categoría A", "Categoría B"][(i % 2)],
  ruta_id: (i % 6) + 1,
  ruta: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Bucaramanga", "Villavicencio"][(i % 6)],
  analista_id: (i % 3) + 1,
  analista: ["Diana Salcedo", "Juan Cárdenas", "Marco Estrada"][(i % 3)],
  conductor: `Conductor ${i + 1}`,
  nas: `NAS-${i + 1}`,
  pasajeros_reportados: Math.floor(Math.random() * 50) + 10,
  fecha_novedad: new Date(2024, i % 12, (i % 28) + 1).toISOString().split("T")[0],
  fecha_solicitud: new Date(2024, i % 12, (i % 28) + 2).toISOString().split("T")[0],
  fecha_recepcion_dd: null,
  fecha_inicio_revision: null,
  fecha_fin_revision: null,
  estado_dd: ["P", "E", "C"][i % 3],
  estado_dd_display: ["Pendiente DD", "En proceso", "Completado"][i % 3],
  respuesta_novedad: i % 4 === 0 ? "Se realizó revisión completa del vehículo." : null,
  estado_novedad: ["A", "P", "C", "R"][i % 4],
  estado_novedad_display: ["Abierta", "En proceso", "Cerrada", "Rechazada"][i % 4],
  observaciones: i % 5 === 0 ? "Observación de prueba para este registro." : null,
  fecha_creacion: new Date(2024, 0, i + 1).toISOString(),
  fecha_actualizacion: new Date(2024, 1, i + 1).toISOString(),
}));

// ─── Helpers de celda ────────────────────────────────────────────────────────
function formatCell(value, type) {
  if (value === null || value === undefined || value === "") {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }
  if (type === "date") {
    const d = new Date(value);
    if (isNaN(d)) return String(value);
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  if (type === "badge") return <Badge text={value} />;
  if (type === "duracion") return formatDuracionLarga(value);
  return String(value);
}

function Badge({ text }) {
  const t = String(text).toLowerCase();
  let style = { bg: "var(--accent-glow)", color: "var(--accent-primary)" };
  if (t.includes("pend") || t.includes("proceso") || t.includes("media")) {
    style = { bg: "var(--accent-warn-soft)", color: "var(--accent-warn)" };
  }
  if (t.includes("complet") || t.includes("cerrad") || t.includes("aprobad") || t.includes("baja") || t.includes("positiva")) {
    style = { bg: "var(--accent-success-soft)", color: "var(--accent-success)" };
  }
  if (t.includes("cancel") || t.includes("rechaz") || t.includes("error") || t.includes("alta") || t.includes("negativa")) {
    style = { bg: "var(--accent-danger-soft)", color: "var(--accent-danger)" };
  }
  // Estados de SLA (columna "SLA") — agregados después de los anteriores
  // para no alterar su precedencia; no colisionan con ninguna otra columna.
  if (t.includes("a tiempo")) {
    style = { bg: "var(--accent-success-soft)", color: "var(--accent-success)" };
  }
  if (t.includes("riesgo")) {
    style = { bg: "var(--accent-warn-soft)", color: "var(--accent-warn)" };
  }
  if (t.includes("vencid") || t.includes("fuera de tiempo")) {
    style = { bg: "var(--accent-danger-soft)", color: "var(--accent-danger)" };
  }
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 99,
      fontSize: 11, fontWeight: 600,
      background: style.bg, color: style.color,
      whiteSpace: "nowrap",
    }}>
      {text}
    </span>
  );
}

// ─── Selector de columnas ────────────────────────────────────────────────────
function ColumnSelector({ columns, visible, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const visibleCount = visible.filter(Boolean).length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn btn-secondary btn-sm"
        style={{ gap: 6 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
        Columnas
        <span style={{
          background: "var(--accent-glow)", color: "var(--accent-primary)",
          border: "1px solid var(--border-accent)",
          borderRadius: 99, padding: "0 6px", fontSize: 10, fontWeight: 700,
        }}>
          {visibleCount}
        </span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)", padding: "8px 0", minWidth: 230,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <div style={{ padding: "4px 14px 8px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Columnas visibles
            </span>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {columns.map((col, i) => (
              <label key={col.key} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 14px", cursor: "pointer",
                background: visible[i] ? "var(--accent-glow)" : "transparent",
                transition: "background 0.1s",
              }}>
                <input type="checkbox" checked={!!visible[i]} onChange={() => onChange(i)}
                  style={{ accentColor: "var(--accent-primary)", width: 14, height: 14 }} />
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{col.label}</span>
              </label>
            ))}
          </div>
          <div style={{
            padding: "8px 14px 4px", borderTop: "1px solid var(--border)",
            marginTop: 4, display: "flex", gap: 12,
          }}>
            <button
              onClick={() => columns.forEach((_, i) => { if (!visible[i]) onChange(i); })}
              style={{ fontSize: 12, color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Mostrar todo
            </button>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <button
              onClick={() => columns.forEach((col, i) => { if (visible[i] !== col.defaultVisible) onChange(i); })}
              style={{ fontSize: 12, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Restablecer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Selector de "qué filtros aparecen por defecto" ─────────────────────────
// Mismo componente que ColumnSelector (checklist + Mostrar todo/Restablecer)
// pero para decidir qué columnas traen un input de filtro rápido cuando se
// abre el panel de "Filtros" -- independiente de qué columnas están
// visibles en la tabla.
function FiltrosSelector({ columns, filtrables, onChange }) {
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
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn btn-secondary btn-sm"
        style={{ gap: 6 }}
        title="Elegir qué filtros aparecen por defecto"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09A1.65 1.65 0 0015 4.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
        Elegir filtros
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)", padding: "8px 0", minWidth: 230,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <div style={{ padding: "4px 14px 8px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Filtros mostrados por defecto
            </span>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {columns.map((col, i) => (
              <label key={col.key} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 14px", cursor: "pointer",
                background: filtrables[i] ? "var(--accent-glow)" : "transparent",
              }}>
                <input type="checkbox" checked={!!filtrables[i]} onChange={() => onChange(i)}
                  style={{ accentColor: "var(--accent-primary)", width: 14, height: 14 }} />
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{col.label}</span>
              </label>
            ))}
          </div>
          <div style={{
            padding: "8px 14px 4px", borderTop: "1px solid var(--border)",
            marginTop: 4, display: "flex", gap: 12,
          }}>
            <button
              onClick={() => columns.forEach((_, i) => { if (!filtrables[i]) onChange(i); })}
              style={{ fontSize: 12, color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Mostrar todo
            </button>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <button
              onClick={() => columns.forEach((col, i) => { if (filtrables[i] !== !!col.defaultFilterable) onChange(i); })}
              style={{ fontSize: 12, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Restablecer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Botón "Filtros" ─────────────────────────────────────────────────────────
// Los filtros por columna ya no viven fijos dentro de la tabla (una fila de
// inputs por cada columna visible ensuciaba mucho la vista) -- ahora se
// muestran/ocultan desde este botón, igual de discreto que "Columnas".
function FiltrosToggle({ open, onToggle, activeCount }) {
  return (
    <button
      onClick={onToggle}
      className="btn btn-secondary btn-sm"
      style={{ gap: 6, ...(open ? { color: "var(--accent-primary)", borderColor: "var(--border-accent)" } : {}) }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
      Filtros
      {activeCount > 0 && (
        <span style={{
          background: "var(--accent-glow)", color: "var(--accent-primary)",
          border: "1px solid var(--border-accent)",
          borderRadius: 99, padding: "0 6px", fontSize: 10, fontWeight: 700,
        }}>
          {activeCount}
        </span>
      )}
    </button>
  );
}

// ─── Exportación a Excel ─────────────────────────────────────────────────────
// Valor plano (no JSX) para una celda del xlsx -- espejo de formatCell()
// mismo campo, mismo type, pero devolviendo texto/número en vez de un
// elemento React con badge.
function valorPlano(value, type) {
  if (value === null || value === undefined || value === "") return "";
  if (type === "date") {
    const d = new Date(value);
    if (isNaN(d)) return String(value);
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  if (type === "duracion") return formatDuracionLarga(value);
  return String(value);
}

// Mismo patrón de exportación (ExcelJS, encabezado de color, fila de
// metadata, autofiltro, cabecera congelada) que ya usa Métricas de
// analistas (Administracion/MetricasAnalistas.jsx) y Trazabilidad en
// NovedadDetallePage.jsx -- título, color de encabezado y metadata (cliente,
// rango de fechas) configurables desde ExportModal; rows/columnas ya vienen
// filtrados por lo que el usuario eligió ahí.
async function exportarNovedadesXLSX(rows, columnas, { titulo = "Novedades", colorHex = "#4F8CFF", metaPrefijo = "", cliente = "" } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Colfenix GPS";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Novedades", { views: [{ state: "frozen", ySplit: 5 }] });
  hoja.columns = columnas.map((c) => ({ key: c.key, width: Math.max(14, c.label.length + 4) }));

  hoja.mergeCells(1, 1, 1, columnas.length);
  const celdaTitulo = hoja.getCell(1, 1);
  celdaTitulo.value = titulo;
  celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };

  hoja.mergeCells(2, 1, 2, columnas.length);
  const celdaMeta = hoja.getCell(2, 1);
  celdaMeta.value = [metaPrefijo, `Registros exportados: ${rows.length}`].filter(Boolean).join("   ·   ");
  celdaMeta.font = { size: 10.5, color: { argb: "FF475569" } };

  hoja.mergeCells(3, 1, 3, columnas.length);
  const celdaExportado = hoja.getCell(3, 1);
  celdaExportado.value = `Exportado: ${new Date().toLocaleString("es-CO")}`;
  celdaExportado.font = { size: 9.5, italic: true, color: { argb: "FF94A3B8" } };

  const colorArgb = hexToArgb(colorHex);
  const filaEncabezado = hoja.getRow(5);
  columnas.forEach((c, i) => {
    const celda = filaEncabezado.getCell(i + 1);
    celda.value = c.label;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colorArgb } };
    celda.alignment = { vertical: "middle", horizontal: "left" };
    celda.border = { bottom: { style: "thin", color: { argb: "FF2563EB" } } };
  });
  filaEncabezado.height = 20;
  hoja.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: columnas.length } };

  rows.forEach((row) => {
    const fila = hoja.addRow(
      Object.fromEntries(columnas.map((c) => [c.key, valorPlano(row[c.key], c.type)]))
    );
    fila.eachCell((celda) => {
      celda.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  const sufijoCliente = cliente ? `_${slug(cliente)}` : "";
  enlace.download = `novedades${sufijoCliente}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

// ─── Modal de configuración de exportación ──────────────────────────────────
// Se abre desde el botón "Exportar Excel" -- en vez de descargar de una,
// deja elegir rango de fechas (sobre fecha_novedad), qué columnas van en el
// archivo (independiente de las visibles en pantalla), y cómo se ve el
// encabezado (título + color) antes de generar el xlsx.
function ExportModal({ columns, visibleCols, rows, cliente, onClose }) {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [exportCols, setExportCols] = useState(visibleCols);
  const [titulo, setTitulo] = useState(cliente ? `Novedades — ${cliente}` : "Novedades");
  const [colorHex, setColorHex] = useState("#4F8CFF");
  const [exportando, setExportando] = useState(false);

  const columnasElegidas = useMemo(
    () => columns.filter((_, i) => exportCols[i]),
    [columns, exportCols]
  );

  const filasEnRango = useMemo(() => rows.filter((r) => {
    if (fechaDesde && (!r.fecha_novedad || r.fecha_novedad < fechaDesde)) return false;
    if (fechaHasta && (!r.fecha_novedad || r.fecha_novedad > fechaHasta)) return false;
    return true;
  }), [rows, fechaDesde, fechaHasta]);

  function toggleCol(i) {
    setExportCols((prev) => { const next = [...prev]; next[i] = !next[i]; return next; });
  }

  async function handleExportar() {
    setExportando(true);
    try {
      const piezasMeta = [];
      if (cliente) piezasMeta.push(`Cliente: ${cliente}`);
      if (fechaDesde || fechaHasta) {
        piezasMeta.push(`Rango: ${fechaDesde ? formatFechaCortaISO(fechaDesde) : "inicio"} – ${fechaHasta ? formatFechaCortaISO(fechaHasta) : "hoy"}`);
      }
      await exportarNovedadesXLSX(filasEnRango, columnasElegidas, {
        titulo: titulo.trim() || "Novedades",
        colorHex,
        metaPrefijo: piezasMeta.join("   ·   "),
        cliente,
      });
      onClose();
    } finally {
      setExportando(false);
    }
  }

  return (
    <DrawerPanel
      icon={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      }
      title="Configurar exportación"
      subtitle={cliente ? `${cliente} · ${filasEnRango.length} de ${rows.length} registros` : `${filasEnRango.length} de ${rows.length} registros`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleExportar}
            disabled={exportando || columnasElegidas.length === 0 || filasEnRango.length === 0}
          >
            {exportando ? "Generando..." : `Exportar (${filasEnRango.length})`}
          </button>
        </>
      }
    >
      {cliente && (
        <div className="form-group">
          <label className="form-label">Cliente</label>
          <div style={{
            padding: "8px 12px", borderRadius: "var(--radius-sm)",
            background: "var(--accent-glow)", color: "var(--accent-primary)",
            fontSize: 13, fontWeight: 600,
          }}>
            {cliente}
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Rango de fechas (fecha de la novedad)</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input type="date" className="form-input" value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)} placeholder="Desde" />
          <input type="date" className="form-input" value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)} placeholder="Hasta" />
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
          Déjalo vacío para no acotar por fecha. Solo aplica sobre lo que ya está filtrado en la tabla.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Configuración del encabezado</label>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Título</span>
            <input type="text" className="form-input" value={titulo}
              onChange={(e) => setTitulo(e.target.value)} placeholder="Novedades" />
          </div>
          <div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Color</span>
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              style={{
                display: "block", width: 44, height: 34, padding: 2,
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                background: "var(--bg-surface)", cursor: "pointer",
              }}
            />
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
          El título y el color se aplican a la fila de encabezado del Excel; el texto del encabezado siempre va en blanco.
        </p>
      </div>

      <div className="form-group">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label className="form-label" style={{ marginBottom: 0 }}>
            Columnas a exportar ({columnasElegidas.length})
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setExportCols(columns.map(() => true))}
              style={{ fontSize: 12, color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Todas
            </button>
            <button
              onClick={() => setExportCols(visibleCols)}
              style={{ fontSize: 12, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Solo visibles en tabla
            </button>
          </div>
        </div>
        <div style={{
          maxHeight: 260, overflowY: "auto", marginTop: 8,
          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
        }}>
          {columns.map((col, i) => (
            <label key={col.key} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 12px", cursor: "pointer",
              background: exportCols[i] ? "var(--accent-glow)" : "transparent",
              borderBottom: "1px solid var(--border)",
            }}>
              <input type="checkbox" checked={!!exportCols[i]} onChange={() => toggleCol(i)}
                style={{ accentColor: "var(--accent-primary)", width: 14, height: 14 }} />
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{col.label}</span>
            </label>
          ))}
        </div>
      </div>
    </DrawerPanel>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 14, height: 14, marginRight: 8,
      border: "2px solid var(--border)", borderTopColor: "var(--accent-primary)",
      borderRadius: "50%", animation: "spin 0.7s linear infinite", verticalAlign: "middle",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

// ─── Paginación ──────────────────────────────────────────────────────────────
function PageBtn({ children, onClick, disabled, active, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      minWidth: 30, height: 30, padding: "0 6px", borderRadius: "var(--radius-sm)", fontSize: 13,
      border: active ? "1px solid var(--border-accent)" : "1px solid var(--border)",
      background: active ? "var(--accent-glow)" : "var(--bg-surface)",
      color: active ? "var(--accent-primary)" : "var(--text-primary)",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.35 : 1, fontWeight: active ? 700 : 400,
    }}>
      {children}
    </button>
  );
}

function buildPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  if (current <= 3) return [0, 1, 2, 3, 4, "…", total - 1];
  if (current >= total - 4) return [0, "…", total - 5, total - 4, total - 3, total - 2, total - 1];
  return [0, "…", current - 1, current, current + 1, "…", total - 1];
}

// ─── Componente principal ─────────────────────────────────────────────────────
// Props:
//   apiUrl       — ruta relativa al endpoint, default "/api/novedades/"
//   useMockData  — true para forzar datos de prueba (útil en dev sin backend)
export default function NovedadesTable({
  apiUrl = "/api/novedades/", actions = [],
  useMockData = false, data: externalData = null, cliente = "",
}) {
  const [data, setData]           = useState(externalData || []);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [usingMock, setUsingMock] = useState(false);

  const [globalFilter, setGlobalFilter]   = useState("");
  const [columnFilters, setColumnFilters] = useState({});
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [pageIndex, setPageIndex]         = useState(0);
  const [pageSize, setPageSize]           = useState(25);
  const [sortKey, setSortKey]             = useState(null);
  const [sortDir, setSortDir]             = useState("asc");
  const [visibleCols, setVisibleCols]     = useState(
    COLUMN_DEFINITIONS.map(c => c.defaultVisible)
  );
  const [filterableCols, setFilterableCols] = useState(
    COLUMN_DEFINITIONS.map(c => !!c.defaultFilterable)
  );
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // ── Fetch con fallback a mock ─────────────────────────────────────────────
  useEffect(() => {
    if (externalData) {
      // El padre ya tiene los datos (filtrados/cargados por él) — no dupliques el fetch.
      setData(externalData);
      setUsingMock(false);
      setError(null);
      setLoading(false);
      return;
    }

    if (useMockData) {
      setData(MOCK_DATA);
      setUsingMock(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setUsingMock(false);

    const fullUrl = apiUrl.startsWith("http") ? apiUrl : `${API_BASE}${apiUrl}`;

    fetch(fullUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Si Django usa sesión con cookie, incluye:
        // "X-CSRFToken": getCookie("csrftoken"),
      },
      // Necesario si Django y React corren en dominios/puertos distintos
      // y el backend tiene django-cors-headers configurado con CORS_ALLOW_CREDENTIALS=True
      // credentials: "include",
    })
      .then(res => {
        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(json => {
        // Django devuelve una lista directa (safe=False en JsonResponse)
        if (!Array.isArray(json)) throw new Error("Formato de respuesta inesperado — se esperaba un array");
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.warn("Backend no disponible, usando datos de prueba.", err.message);
        // ── FALLBACK: si el fetch falla, muestra mock con aviso ─────────────
        setData(MOCK_DATA);
        setUsingMock(true);
        setError(err.message);
        setLoading(false);
      });
  }, [apiUrl, useMockData, externalData]);

  // ── Columnas activas ──────────────────────────────────────────────────────
  const activeColumns = useMemo(
    () => COLUMN_DEFINITIONS.filter((_, i) => visibleCols[i]),
    [visibleCols]
  );

  // Independiente de visibleCols a propósito: se puede filtrar por una
  // columna que no está en pantalla (ej. acotar por cliente sin mostrar esa
  // columna en la tabla).
  const filterableColumns = useMemo(
    () => COLUMN_DEFINITIONS.filter((_, i) => filterableCols[i]),
    [filterableCols]
  );

  // ── Filtro global + filtros por columna ───────────────────────────────────
  const filteredData = useMemo(() => {
    let rows = data;
    if (globalFilter.trim()) {
      const q = globalFilter.toLowerCase();
      rows = rows.filter(row =>
        activeColumns.some(col => String(row[col.key] ?? "").toLowerCase().includes(q))
      );
    }
    Object.entries(columnFilters).forEach(([key, val]) => {
      if (val?.trim()) {
        const q = val.toLowerCase();
        rows = rows.filter(row => String(row[key] ?? "").toLowerCase().includes(q));
      }
    });
    return rows;
  }, [data, globalFilter, columnFilters, activeColumns]);

  // ── Ordenamiento ──────────────────────────────────────────────────────────
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      const cmp = String(va).localeCompare(String(vb), "es", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir]);

  // ── Paginación ────────────────────────────────────────────────────────────
  const pageCount = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage  = Math.min(pageIndex, pageCount - 1);
  const pageData  = sortedData.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPageIndex(0);
  }

  function toggleColumn(i) {
    setVisibleCols(prev => { const next = [...prev]; next[i] = !next[i]; return next; });
  }

  function toggleFilterable(i) {
    setFilterableCols(prev => { const next = [...prev]; next[i] = !next[i]; return next; });
  }

  function updateColumnFilter(key, val) {
    setColumnFilters(prev => ({ ...prev, [key]: val }));
    setPageIndex(0);
  }

  const activeFilterCount =
    Object.values(columnFilters).filter(v => v?.trim()).length +
    (globalFilter.trim() ? 1 : 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="novedades-table" style={{ fontFamily: "var(--font-sans, 'Inter', system-ui)", color: "var(--text-primary)", width: "100%" }}>

      {/* Banner de advertencia si está usando mock o hubo error de red */}
      {usingMock && (
        <div style={{
          marginBottom: 12, padding: "10px 16px",
          background: "var(--accent-warn-soft)", border: "1px solid var(--accent-warn)",
          borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--accent-warn)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          {error
            ? `Backend no disponible (${error}). Mostrando datos de prueba.`
            : "Modo de demostración — usando datos de prueba."}
          <button
            onClick={() => { setUsingMock(false); setLoading(true); setError(null); }}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--accent-warn)", fontSize: 12, fontWeight: 600 }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Búsqueda global */}
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 180 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" placeholder="Buscar en todas las columnas…"
              value={globalFilter}
              onChange={e => { setGlobalFilter(e.target.value); setPageIndex(0); }}
              className="form-input"
              style={{ paddingLeft: 30 }}
            />
            {globalFilter && (
              <button onClick={() => { setGlobalFilter(""); setPageIndex(0); }} style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)",
                display: "flex", alignItems: "center", padding: 0,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Botones y contador, agrupados a la derecha */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
            {activeFilterCount > 0 && (
              <button className="btn btn-danger btn-sm"
                onClick={() => { setGlobalFilter(""); setColumnFilters({}); setPageIndex(0); }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Limpiar ({activeFilterCount})
              </button>
            )}

            <FiltrosToggle
              open={filtrosAbiertos}
              onToggle={() => setFiltrosAbiertos(o => !o)}
              activeCount={Object.values(columnFilters).filter(v => v?.trim()).length}
            />
            {filtrosAbiertos && (
              <FiltrosSelector columns={COLUMN_DEFINITIONS} filtrables={filterableCols} onChange={toggleFilterable} />
            )}
            <ColumnSelector columns={COLUMN_DEFINITIONS} visible={visibleCols} onChange={toggleColumn} />

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setExportModalOpen(true)}
              disabled={sortedData.length === 0}
              style={{ gap: 6 }}
              title="Configurar y exportar a Excel"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar Excel
            </button>

            <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {sortedData.length.toLocaleString("es-CO")} / {data.length.toLocaleString("es-CO")} registros
            </span>
          </div>
        </div>

        {/* Filtros por columna -- ocultos por defecto, aparecen en esta misma
            barra (no como fila fija dentro de la tabla) al activar "Filtros",
            ancladas al lado derecho igual que los botones de arriba. */}
        {filtrosAbiertos && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            {filterableColumns.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Sin filtros por defecto — usa "Elegir filtros" para agregar alguno.
              </span>
            ) : filterableColumns.map(col => (
              <input
                key={col.key}
                type="text"
                placeholder={`Filtrar ${col.label}…`}
                value={columnFilters[col.key] || ""}
                onChange={e => updateColumnFilter(col.key, e.target.value)}
                className="form-input"
                style={{ width: 160, fontSize: 12, padding: "5px 8px" }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            <Spinner /> Cargando novedades desde el servidor…
          </div>
        ) : (
          <table className="data-table" style={{ width: "100%", whiteSpace: "nowrap" }}>
            <thead>
              {/* Cabeceras con ordenamiento */}
              <tr>
                {activeColumns.map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}
                    style={{ cursor: "pointer", userSelect: "none", padding: "10px 14px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {col.label}
                      <span style={{ opacity: sortKey === col.key ? 1 : 0.25, fontSize: 10 }}>
                        {sortKey === col.key ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </span>
                  </th>
                ))}
                {actions.length > 0 && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={activeColumns.length}
                    style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                    Sin resultados para los filtros aplicados.
                  </td>
                </tr>
              ) : pageData.map((row, ri) => (
                <tr key={row.id ?? ri}>
                  {activeColumns.map(col => (
                    <td key={col.key} style={{
                      padding: "9px 14px",
                      maxWidth: ["observaciones", "respuesta_novedad"].includes(col.key) ? 220 : undefined,
                      overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {formatCell(row[col.key], col.type)}
                    </td>
                  ))}
                  {actions.length > 0 && (
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {actions.map((action) => {
                          // label/tooltip/icon/variant pueden ser un valor fijo o una
                          // función (row) => valor -- así una misma acción puede
                          // cambiar de "Generar informe" a "Ver informe" según el
                          // estado de la fila, en vez de necesitar dos acciones
                          // separadas que se muestran/ocultan entre sí.
                          const label = typeof action.label === "function" ? action.label(row) : action.label;
                          const tooltip = (typeof action.tooltip === "function" ? action.tooltip(row) : action.tooltip) || label;
                          const icon = typeof action.icon === "function" ? action.icon(row) : action.icon;
                          const variant = typeof action.variant === "function" ? action.variant(row) : action.variant;
                          return (
                            <Tooltip key={action.key} text={tooltip} position="top">
                              <button
                                onClick={() => action.onClick(row)}
                                disabled={action.show && !action.show(row)}
                                className={`action-btn ${variant || ""}`}
                                title={tooltip}
                                aria-label={label}
                              >
                                <span className="action-btn-icon">{icon}</span>
                              </button>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {!loading && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          flexWrap: "wrap", marginTop: 12, justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Filas por página:</span>
            <select value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPageIndex(0); }}
              className="form-select" style={{ width: "auto", padding: "5px 28px 5px 8px" }}>
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 4 }}>
              Pág. {safePage + 1} / {pageCount}
            </span>
            <PageBtn onClick={() => setPageIndex(0)} disabled={safePage === 0} title="Primera">«</PageBtn>
            <PageBtn onClick={() => setPageIndex(p => Math.max(0, p - 1))} disabled={safePage === 0} title="Anterior">‹</PageBtn>
            {buildPageNumbers(safePage, pageCount).map((p, i) =>
              p === "…"
                ? <span key={`e${i}`} style={{ padding: "0 4px", color: "var(--text-muted)", fontSize: 12 }}>…</span>
                : <PageBtn key={p} onClick={() => setPageIndex(p)} active={p === safePage}>{p + 1}</PageBtn>
            )}
            <PageBtn onClick={() => setPageIndex(p => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} title="Siguiente">›</PageBtn>
            <PageBtn onClick={() => setPageIndex(pageCount - 1)} disabled={safePage >= pageCount - 1} title="Última">»</PageBtn>
          </div>
        </div>
      )}

      {exportModalOpen && (
        <ExportModal
          columns={COLUMN_DEFINITIONS}
          visibleCols={visibleCols}
          rows={sortedData}
          cliente={cliente}
          onClose={() => setExportModalOpen(false)}
        />
      )}
    </div>
  );
}
