import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Radio, AlertTriangle, Users, FileText,
  TrendingUp, Clock, CheckCircle2, ShieldAlert, Download,
} from "lucide-react";
import ExcelJS from "exceljs";
import { formatFechaHora, formatFecha, hexToArgb, formatFechaCortaISO, formatDuracionLarga } from "../utils/helpers";
import { API_BASE } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { tienePermiso } from "../utils/permisos";
import DrawerPanel from "../components/ui/DrawerPanel";

// Colores por sla_estado -- mismo mapeo que ya usa PanelSLA en
// NovedadDetallePage.jsx (SLA_COLOR/SLA_BG), acá recortado a los dos únicos
// estados que le interesan a esta tarjeta.
const SLA_RIESGO_COLOR = {
  EN_RIESGO: { color: "var(--accent-warn)", bg: "var(--accent-warn-soft)" },
  VENCIDO: { color: "var(--accent-danger)", bg: "var(--accent-danger-soft)" },
};

// Cola de prioridad por riesgo de SLA -- a diferencia del resto de esta
// página (100% datos mock), esta tarjeta trae datos reales de
// /api/novedades/ (mismo endpoint que usa NovedadesPage) y no depende de
// ../data/mockData. Filtra a EN_RIESGO/VENCIDO, ordena por horas restantes
// (lo más urgente primero) y muestra el top 5, cruzando todos los clientes
// -- algo que NovedadesPage no puede mostrar bien porque agrupa por cliente.
function CasosPrioritariosCard({ onNavigate }) {
  const { user } = useAuth();
  const puedeVer = tienePermiso(user, "vista.novedades");
  const [casos, setCasos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!puedeVer) { setLoading(false); return; }
    let cancelado = false;
    fetch(`${API_BASE}/api/novedades/`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelado) return;
        const prioritarios = data
          .filter((n) => n.sla_estado === "EN_RIESGO" || n.sla_estado === "VENCIDO")
          .sort((a, b) => (a.sla_horas_restantes ?? 0) - (b.sla_horas_restantes ?? 0))
          .slice(0, 5);
        setCasos(prioritarios);
      })
      .catch((err) => { if (!cancelado) setError(err.message); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [puedeVer]);

  if (!puedeVer) return null;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title"><ShieldAlert size={16} /> Casos que necesitan atención</div>
        <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("novedades")}>Ver todas</button>
      </div>
      {loading && <div style={{ color: "var(--text-muted)", fontSize: 12.5 }}>Cargando…</div>}
      {error && <div style={{ color: "var(--accent-danger)", fontSize: 12.5 }}>Error: {error}</div>}
      {!loading && !error && casos.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={15} color="var(--accent-success)" /> Ningún caso en riesgo de incumplir su SLA ahora mismo.
        </div>
      )}
      {!loading && !error && casos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {casos.map((n) => {
            const sla = SLA_RIESGO_COLOR[n.sla_estado] || SLA_RIESGO_COLOR.EN_RIESGO;
            return (
              <button
                key={n.id}
                onClick={() => onNavigate(`novedades/${n.id}`)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  padding: "10px 12px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {n.codigo_novedad} · {n.vehiculo}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{n.cliente}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {n.sla_horas_restantes != null ? `${Math.abs(Math.round(n.sla_horas_restantes))}h ${n.sla_horas_restantes < 0 ? "vencidas" : "restantes"}` : "—"}
                  </span>
                  <span className="badge" style={{ background: sla.bg, color: sla.color }}>{n.sla_estado_display}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const COLORS = ["#00C6FF", "#0057FF", "#F59E0B", "#EF4444", "#22C55E", "#8B5CF6"];
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
        <div style={{ color: "var(--accent-primary)", fontWeight: 700 }}>{payload[0].value} novedades</div>
      </div>
    );
  }
  return null;
};

// Mismo mapeo por palabra clave que ya usa Badge en
// components/DynamicTable/DynamicTable.jsx, para que "Prioridad Alta",
// "Pendiente por responder", etc. (los valores reales que devuelve el
// backend) se vean con el color correcto sin depender de los enums cortos
// que solo existían en el mock ("Alta", "Abierta"...).
function colorPorTexto(texto) {
  const t = String(texto || "").toLowerCase();
  if (t.includes("pend") || t.includes("proceso") || t.includes("media") || t.includes("riesgo")) {
    return { bg: "var(--accent-warn-soft)", color: "var(--accent-warn)" };
  }
  if (t.includes("complet") || t.includes("baja") || t.includes("positiva") || t.includes("a tiempo")) {
    return { bg: "var(--accent-success-soft)", color: "var(--accent-success)" };
  }
  if (t.includes("alta") || t.includes("negativa") || t.includes("vencid") || t.includes("incompleta")) {
    return { bg: "var(--accent-danger-soft)", color: "var(--accent-danger)" };
  }
  return { bg: "var(--accent-glow)", color: "var(--accent-primary)" };
}

const COLUMNAS_DASHBOARD_EXPORT = [
  { key: "codigo_novedad", label: "Código", width: 16 },
  { key: "cliente", label: "Cliente", width: 26 },
  { key: "vehiculo", label: "Placa", width: 14 },
  { key: "numero_interno", label: "N° Interno", width:14},
  { key: "grupo_flota", label: "Grupo flota", width: 14},
  { key: "tipo_informe", label: "Tipo de informe", width: 22 },
  { key: "nivel_prioridad_display", label: "Prioridad", width: 14 },
  { key: "estado_novedad_display", label: "Estado", width: 20 },
  { key: "sla_estado_display", label: "SLA", width: 16 },
  { key: "sla_horas_transcurridas", label: "Tiempo SLA transcurrido", width: 22 },
  { key: "fecha_novedad", label: "Fecha Novedad", width: 14 },
];

// Recharts (BarChart/PieChart dentro de ResponsiveContainer) renderiza un
// <svg> real en el DOM -- lo clonamos, lo serializamos y lo dibujamos en un
// <canvas> para sacar un PNG. ExcelJS no sabe crear gráficos nativos de
// Excel (no expone esa API); esto es lo más cercano posible: una imagen del
// gráfico tal como se ve en pantalla, incrustada en el archivo. `container`
// debe envolver *solo* el ResponsiveContainer (nunca la tarjeta completa),
// porque los íconos de encabezado (lucide-react) también son <svg> y
// querySelector('svg') tomaría el primero que encuentre.
function capturarGraficoComoPng(container, { scale = 2, background = "#ffffff" } = {}) {
  return new Promise((resolve) => {
    const original = container?.querySelector("svg");
    if (!original) { resolve(null); return; }

    const width = Number(original.getAttribute("width")) || original.clientWidth || 600;
    const height = Number(original.getAttribute("height")) || original.clientHeight || 300;

    const clon = original.cloneNode(true);
    clon.setAttribute("width", width);
    clon.setAttribute("height", height);
    clon.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const svgString = new XMLSerializer().serializeToString(clon);
    const svgUrl = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }));

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(svgUrl);
      resolve({ dataUrl: canvas.toDataURL("image/png"), width, height });
    };
    img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(null); };
    img.src = svgUrl;
  });
}

function valorPlanoDashboard(n, key) {
  const valor = n[key];
  if (valor === null || valor === undefined || valor === "") return "";
  if (key === "fecha_novedad") return formatFecha(valor);
  if (key === "sla_horas_transcurridas") return formatDuracionLarga(valor);
  return valor;
}

// Mismo patrón de exportación que Novedades/Trazabilidad/Métricas/Clientes
// -- acá con un bloque extra de metadata: los mismos KPI que se ven arriba
// en la pantalla, congelados al momento de exportar.
async function exportarDashboardXLSX(novedadesFiltradas, columnas, kpis, graficos, { titulo = "Resumen operativo", colorHex = "#4F8CFF" } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Colfenix GPS";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Resumen", { views: [{ state: "frozen", ySplit: 6 }] });
  hoja.columns = columnas.map((c) => ({ key: c.key, width: c.width }));

  hoja.mergeCells(1, 1, 1, columnas.length);
  const celdaTitulo = hoja.getCell(1, 1);
  celdaTitulo.value = titulo || "Resumen operativo";
  celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };

  hoja.mergeCells(2, 1, 2, columnas.length);
  const celdaMeta = hoja.getCell(2, 1);
  celdaMeta.value = [
    `Alertas críticas: ${kpis.alertasCriticas}`,
    `Novedades hoy: ${kpis.novedadesHoy}`,
    `En el mes: ${kpis.novedadesMes}`,
    `Pendientes: ${kpis.pendientes}`,
  ].join("   ·   ");
  celdaMeta.font = { size: 10.5, color: { argb: "FF475569" } };

  hoja.mergeCells(3, 1, 3, columnas.length);
  const celdaMeta2 = hoja.getCell(3, 1);
  celdaMeta2.value = `Registros exportados: ${novedadesFiltradas.length}`;
  celdaMeta2.font = { size: 10.5, color: { argb: "FF475569" } };

  hoja.mergeCells(4, 1, 4, columnas.length);
  const celdaExportado = hoja.getCell(4, 1);
  celdaExportado.value = `Exportado: ${new Date().toLocaleString("es-CO")}`;
  celdaExportado.font = { size: 9.5, italic: true, color: { argb: "FF94A3B8" } };

  const colorArgb = hexToArgb(colorHex);
  const filaEncabezado = hoja.getRow(6);
  columnas.forEach((c, i) => {
    const celda = filaEncabezado.getCell(i + 1);
    celda.value = c.label;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colorArgb } };
    celda.alignment = { vertical: "middle", horizontal: "left" };
    celda.border = { bottom: { style: "thin", color: { argb: "FF2563EB" } } };
  });
  filaEncabezado.height = 20;
  hoja.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: columnas.length } };

  novedadesFiltradas.forEach((n) => {
    const fila = hoja.addRow(
      Object.fromEntries(columnas.map((c) => [c.key, valorPlanoDashboard(n, c.key)]))
    );
    fila.eachCell((celda) => {
      celda.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  // Hoja aparte para no pelear con el autofiltro/cabecera congelada de la
  // hoja de datos -- cada gráfico incluido (según lo elegido en el modal)
  // va con su propio título encima, apilados verticalmente.
  if (graficos?.barra || graficos?.pie) {
    const hojaGraficos = workbook.addWorksheet("Gráficos");
    hojaGraficos.getColumn(1).width = 90;
    let fila = 1;
    hojaGraficos.getCell(fila, 1).value = titulo || "Resumen operativo";
    hojaGraficos.getCell(fila, 1).font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
    fila += 2;

    const bloques = [
      graficos.barra && { etiqueta: "Novedades — últimos 7 días", img: graficos.barra },
      graficos.pie && { etiqueta: "Distribución por tipo de informe", img: graficos.pie },
    ].filter(Boolean);

    for (const { etiqueta, img } of bloques) {
      hojaGraficos.getCell(fila, 1).value = etiqueta;
      hojaGraficos.getCell(fila, 1).font = { bold: true, size: 11.5, color: { argb: "FF0F172A" } };
      fila += 1;
      const imgId = workbook.addImage({ base64: img.dataUrl, extension: "png" });
      hojaGraficos.addImage(imgId, { tl: { col: 0, row: fila - 1 }, ext: { width: img.width, height: img.height } });
      fila += Math.ceil(img.height / 20) + 2;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `resumen_operativo_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

// Modal de "Configurar exportación" -- mismo patrón que el resto de la app.
// Rango de fechas sobre TODAS las novedades cargadas (no solo las 5
// "recientes" que se ven en la tabla de la pantalla), checklist de
// columnas, título/color de encabezado.
function DashboardExportModal({ novedades, kpis, barContainerRef, pieContainerRef, onClose }) {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState(() =>
    Object.fromEntries(COLUMNAS_DASHBOARD_EXPORT.map((c) => [c.key, true]))
  );
  const [incluirBarra, setIncluirBarra] = useState(true);
  const [incluirPie, setIncluirPie] = useState(true);
  const [titulo, setTitulo] = useState("Resumen operativo");
  const [colorHex, setColorHex] = useState("#4F8CFF");
  const [exportando, setExportando] = useState(false);

  const toggleColumna = (key) => setColumnasVisibles((prev) => ({ ...prev, [key]: !prev[key] }));
  const columnasElegidas = COLUMNAS_DASHBOARD_EXPORT.filter((c) => columnasVisibles[c.key]);

  const novedadesEnRango = useMemo(() => novedades.filter((n) => {
    if (!fechaDesde && !fechaHasta) return true;
    if (fechaDesde && (!n.fecha_novedad || n.fecha_novedad < fechaDesde)) return false;
    if (fechaHasta && (!n.fecha_novedad || n.fecha_novedad > fechaHasta)) return false;
    return true;
  }), [novedades, fechaDesde, fechaHasta]);

  const handleExportar = async () => {
    setExportando(true);
    try {
      const [barra, pie] = await Promise.all([
        incluirBarra ? capturarGraficoComoPng(barContainerRef.current) : Promise.resolve(null),
        incluirPie ? capturarGraficoComoPng(pieContainerRef.current) : Promise.resolve(null),
      ]);
      await exportarDashboardXLSX(
        novedadesEnRango, columnasElegidas, kpis, { barra, pie },
        { titulo: titulo.trim() || "Resumen operativo", colorHex }
      );
      onClose();
    } finally {
      setExportando(false);
    }
  };

  return (
    <DrawerPanel
      icon={<Download size={18} />}
      title="Configurar exportación"
      subtitle={`${novedadesEnRango.length} de ${novedades.length} novedades`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleExportar}
            disabled={exportando || columnasElegidas.length === 0 || novedadesEnRango.length === 0}
          >
            {exportando ? "Generando..." : `Exportar (${novedadesEnRango.length})`}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Rango de fechas (fecha de la novedad)</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input type="date" className="form-input" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          <input type="date" className="form-input" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
          {fechaDesde || fechaHasta
            ? `Del ${fechaDesde ? formatFechaCortaISO(fechaDesde) : "inicio"} al ${fechaHasta ? formatFechaCortaISO(fechaHasta) : "hoy"}.`
            : "Déjalo vacío para exportar todas las novedades cargadas, no solo las 5 recientes que se ven en pantalla."}
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Gráficos</label>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: -4, marginBottom: 8 }}>
          Se incrustan como imagen tal como se ven en pantalla, en una hoja aparte — ExcelJS no genera gráficos nativos editables de Excel.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={incluirBarra} onChange={(e) => setIncluirBarra(e.target.checked)}
              style={{ accentColor: "var(--accent-primary)", width: 14, height: 14 }} />
            <span style={{ fontSize: 13, color: "var(--text-primary)" }}>Novedades — últimos 7 días</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={incluirPie} onChange={(e) => setIncluirPie(e.target.checked)}
              style={{ accentColor: "var(--accent-primary)", width: 14, height: 14 }} />
            <span style={{ fontSize: 13, color: "var(--text-primary)" }}>Distribución por tipo de informe</span>
          </label>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Configuración del encabezado</label>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Título</span>
            <input type="text" className="form-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
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
      </div>

      <div className="form-group">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label className="form-label" style={{ marginBottom: 0 }}>
            Columnas a exportar ({columnasElegidas.length})
          </label>
          <button
            onClick={() => setColumnasVisibles(Object.fromEntries(COLUMNAS_DASHBOARD_EXPORT.map((c) => [c.key, true])))}
            style={{ fontSize: 12, color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Todas
          </button>
        </div>
        <div style={{
          maxHeight: 260, overflowY: "auto", marginTop: 8,
          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
        }}>
          {COLUMNAS_DASHBOARD_EXPORT.map((col) => (
            <label key={col.key} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 12px", cursor: "pointer",
              background: columnasVisibles[col.key] ? "var(--accent-glow)" : "transparent",
              borderBottom: "1px solid var(--border)",
            }}>
              <input
                type="checkbox"
                checked={!!columnasVisibles[col.key]}
                onChange={() => toggleColumna(col.key)}
                style={{ accentColor: "var(--accent-primary)", width: 14, height: 14 }}
              />
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{col.label}</span>
            </label>
          ))}
        </div>
      </div>
    </DrawerPanel>
  );
}

export default function DashboardPage({ onNavigate }) {
  const [novedades, setNovedades] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const barContainerRef = useRef(null);
  const pieContainerRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [resNovedades, resResumen] = await Promise.all([
          fetch(`${API_BASE}/api/novedades/`, { credentials: "include" }),
          fetch(`${API_BASE}/api/dashboard/resumen/`, { credentials: "include" }),
        ]);
        if (!resNovedades.ok) throw new Error(`El servidor respondió ${resNovedades.status}`);
        const dataNovedades = await resNovedades.json();
        const dataResumen = resResumen.ok ? await resResumen.json() : null;
        if (!cancelado) {
          setNovedades(dataNovedades);
          setResumen(dataResumen);
        }
      } catch (err) {
        if (!cancelado) setLoadError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  const stats = useMemo(() => {
    const hoyISO = new Date().toISOString().slice(0, 10);
    const inicioMes = hoyISO.slice(0, 7); // "YYYY-MM"

    const abiertas = novedades.filter((n) => n.estado_novedad !== "Completado");
    const alertasCriticas = novedades.filter(
      (n) => n.nivel_prioridad === "Prioridad_Alta" && n.estado_novedad !== "Completado"
    ).length;
    const novedadesHoy = novedades.filter((n) => n.fecha_novedad === hoyISO).length;
    const novedadesMes = novedades.filter((n) => (n.fecha_novedad || "").slice(0, 7) === inicioMes).length;
    const pendientes = novedades.filter((n) => n.estado_novedad === "Pendiente_por_responder").length;

    const recientes = [...abiertas]
      .sort((a, b) => new Date(b.fecha_novedad) - new Date(a.fecha_novedad))
      .slice(0, 5);

    // Últimos 7 días de calendario (incluye hoy), contando por fecha_novedad.
    const porDia = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      porDia.push({
        dia: DIAS_CORTOS[d.getDay()],
        novedades: novedades.filter((n) => n.fecha_novedad === iso).length,
      });
    }

    // Distribución por tipo de informe -- top 6, el resto agrupado en "Otros".
    const conteoPorTipo = new Map();
    for (const n of novedades) {
      const tipo = n.tipo_informe || "Sin tipo";
      conteoPorTipo.set(tipo, (conteoPorTipo.get(tipo) || 0) + 1);
    }
    const ordenado = [...conteoPorTipo.entries()].sort((a, b) => b[1] - a[1]);
    const top = ordenado.slice(0, 6).map(([tipo, cantidad]) => ({ tipo, cantidad }));
    const restoTotal = ordenado.slice(6).reduce((acc, [, cant]) => acc + cant, 0);
    if (restoTotal > 0) top.push({ tipo: "Otros", cantidad: restoTotal });

    return { alertasCriticas, novedadesHoy, novedadesMes, pendientes, abiertas, recientes, porDia, porTipo: top };
  }, [novedades]);

  return (
    <div className="page-shell">
      <div className="hero-panel">
        <div>
          <div className="hero-eyebrow">Centro de operaciones</div>
          <h2 className="hero-title">Monitorea, prioriza y resuelve novedades con mayor velocidad</h2>
          <p className="hero-text">El panel destaca los casos que requieren atención inmediata, la evidencia disponible y los informes pendientes para cerrar el ciclo operativo.</p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => onNavigate("novedades")}>Ver novedades</button>
          <button className="btn btn-secondary" onClick={() => onNavigate("informes")}>Ver informes</button>
          <button className="btn btn-secondary" onClick={() => setExportModalOpen(true)} disabled={loading || novedades.length === 0}>
            <Download size={14} /> Exportar Excel
          </button>
        </div>
      </div>

      {loadError && (
        <div className="card" style={{ color: "var(--accent-danger)" }}>No se pudieron cargar los datos del panel: {loadError}</div>
      )}

      <div className="hero-metrics">
        <div className="metric-pill"><strong>{loading ? "…" : stats.abiertas.length}</strong> casos activos</div>
        <div className="metric-pill"><strong>{loading ? "…" : stats.pendientes}</strong> informes pendientes</div>
        <div className="metric-pill"><strong>{loading ? "…" : stats.alertasCriticas}</strong> alertas críticas</div>
      </div>

      <CasosPrioritariosCard onNavigate={onNavigate} />

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card success" style={{ cursor: "pointer" }} onClick={() => onNavigate("monitoreo")}>
          <div className="kpi-label">Vehículos activos</div>
          <div className="kpi-value">{resumen ? resumen.vehiculos_activos : "…"}</div>
          <div className="kpi-sub">de {resumen ? resumen.vehiculos_total : "…"} registrados</div>
          <div className="kpi-icon"><Radio size={40} /></div>
        </div>
        <div className="kpi-card danger" style={{ cursor: "pointer" }} onClick={() => onNavigate("novedades")}>
          <div className="kpi-label">Alertas críticas</div>
          <div className="kpi-value">{loading ? "…" : stats.alertasCriticas}</div>
          <div className="kpi-sub">Requieren atención</div>
          <div className="kpi-icon"><ShieldAlert size={40} /></div>
        </div>
        <div className="kpi-card warn" style={{ cursor: "pointer" }} onClick={() => onNavigate("novedades")}>
          <div className="kpi-label">Novedades hoy</div>
          <div className="kpi-value">{loading ? "…" : stats.novedadesHoy}</div>
          <div className="kpi-sub">{loading ? "…" : stats.novedadesMes} en el mes</div>
          <div className="kpi-icon"><AlertTriangle size={40} /></div>
        </div>
        <div className="kpi-card" style={{ cursor: "pointer" }} onClick={() => onNavigate("informes")}>
          <div className="kpi-label">Informes pendientes</div>
          <div className="kpi-value">{loading ? "…" : stats.pendientes}</div>
          <div className="kpi-sub">Por generar</div>
          <div className="kpi-icon"><FileText size={40} /></div>
        </div>
        <div className="kpi-card" style={{ cursor: "pointer" }} onClick={() => onNavigate("clientes")}>
          <div className="kpi-label">Clientes activos</div>
          <div className="kpi-value">{resumen ? resumen.clientes_activos : "…"}</div>
          <div className="kpi-sub">de {resumen ? resumen.clientes_total : "…"} registrados</div>
          <div className="kpi-icon"><Users size={40} /></div>
        </div>
      </div>

      {/* Gráficas */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title"><TrendingUp size={16} /> Novedades — últimos 7 días</div>
          </div>
          <div ref={barContainerRef}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.porDia} barSize={22}>
                <XAxis dataKey="dia" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,198,255,0.05)" }} />
                <Bar dataKey="novedades" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title"><AlertTriangle size={16} /> Distribución por tipo de informe</div>
          </div>
          {stats.porTipo.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Sin novedades registradas todavía.</div>
          ) : (
            <div ref={pieContainerRef}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={stats.porTipo} dataKey="cantidad" nameKey="tipo"
                    cx="40%" cy="50%" outerRadius={70} innerRadius={40}
                  >
                    {stats.porTipo.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    layout="vertical" align="right" verticalAlign="middle"
                    formatter={(v) => <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{v}</span>}
                  />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Novedades abiertas */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><Clock size={16} /> Novedades abiertas</div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("novedades")}>Ver todas</button>
        </div>
        {loading ? (
          <div style={{ color: "var(--text-muted)", padding: 16 }}>Cargando…</div>
        ) : stats.recientes.length === 0 ? (
          <div style={{ color: "var(--text-muted)", padding: 16, textAlign: "center" }}>Sin novedades abiertas — todo al día.</div>
        ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Tipo</th>
              <th>Vehículo</th>
              <th>Cliente</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {stats.recientes.map(n => (
              <tr key={n.id}>
                <td><span className="mono text-accent">{n.codigo_novedad}</span></td>
                <td style={{ color: "var(--text-primary)" }}>{n.tipo_informe}</td>
                <td className="mono">{n.vehiculo || "—"}</td>
                <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.cliente}</td>
                <td>
                  <span className="badge" style={colorPorTexto(n.nivel_prioridad_display)}>{n.nivel_prioridad_display}</span>
                </td>
                <td>
                  <span className="badge" style={colorPorTexto(n.estado_novedad_display)}>{n.estado_novedad_display}</span>
                </td>
                <td style={{ fontSize: 12 }}>{formatFechaHora(n.fecha_novedad)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {exportModalOpen && (
        <DashboardExportModal
          novedades={novedades}
          kpis={{
            alertasCriticas: stats.alertasCriticas,
            novedadesHoy: stats.novedadesHoy,
            novedadesMes: stats.novedadesMes,
            pendientes: stats.pendientes,
          }}
          barContainerRef={barContainerRef}
          pieContainerRef={pieContainerRef}
          onClose={() => setExportModalOpen(false)}
        />
      )}
    </div>
  );
}
