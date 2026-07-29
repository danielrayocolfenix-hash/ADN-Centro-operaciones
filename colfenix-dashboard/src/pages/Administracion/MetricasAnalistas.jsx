import React, { useEffect, useState } from "react";
import ExcelJS from "exceljs";
import {
  Users, CheckCircle2, Clock, FileText, Timer, ExternalLink, Trophy,
  Scale, TrendingUp, TrendingDown, Download,
} from "lucide-react";
import { API_BASE } from "../../config/api";
import { formatDuracionHoras, formatFechaHora } from "../../utils/helpers";
import DrawerPanel from "../../components/ui/DrawerPanel";

function inicialesDe(nombre) {
  if (!nombre) return "??";
  const partes = nombre.trim().split(/\s+/);
  return partes.slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "??";
}

function StatChip({ label, value, bg, color }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      padding: "6px 10px", borderRadius: "var(--radius-sm)", background: bg, minWidth: 56,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 9.5, color, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
    </div>
  );
}

// Tarjeta de KPI de equipo (icono + número grande + sub-dato) -- reemplaza
// la fila plana de "metric-pill" de antes para que los indicadores del
// equipo se lean agrupados y con su propio contexto, no solo un número suelto.
function KpiCard({ icon, label, value, sublabel, bg, color }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "var(--radius-sm)", display: "flex",
          alignItems: "center", justifyContent: "center", background: bg, color, flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
      {sublabel && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{sublabel}</div>}
    </div>
  );
}

// Barra de progreso simple (respondidas / total asignadas) por analista.
function BarraProgreso({ hechas, total, color }) {
  const pct = total ? Math.round((hechas / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Progreso
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "var(--bg-surface)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

// Barra de dos segmentos (ej. Positivas vs Negativas) con su % al lado.
function BarraProporcion({ a, b, colorA, colorB, labelA, labelB }) {
  const total = a + b;
  const pctA = total ? Math.round((a / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: "var(--bg-surface)", marginBottom: 6 }}>
        {total > 0 && (
          <>
            <div style={{ width: `${pctA}%`, background: colorA }} />
            <div style={{ width: `${100 - pctA}%`, background: colorB }} />
          </>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
        <span><strong style={{ color: colorA }}>{a}</strong> {labelA} ({pctA}%)</span>
        <span><strong style={{ color: colorB }}>{b}</strong> {labelB}</span>
      </div>
    </div>
  );
}

// Detalle de un informe puntual, abierto desde su "enlace" en la tarjeta del
// analista — no navega a otra pantalla (InformesPage sigue con datos de
// prueba), solo trae lo persistido realmente en el backend.
function InformeDetalleDrawer({ informeId, onClose }) {
  const [informe, setInforme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setLoadError(null);
    fetch(`${API_BASE}/api/admin/informes/${informeId}/`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
        return r.json();
      })
      .then((data) => { if (!cancelado) setInforme(data); })
      .catch((err) => { if (!cancelado) setLoadError(err.message); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [informeId]);

  return (
    <DrawerPanel
      icon={<FileText size={18} />}
      title={informe?.codigo || "Informe"}
      subtitle={informe ? `${informe.novedad.codigo_novedad} · ${informe.novedad.cliente}` : undefined}
      onClose={onClose}
      footer={<button className="btn btn-secondary" onClick={onClose}>Cerrar</button>}
    >
      {loading && <div style={{ color: "var(--text-muted)" }}>Cargando…</div>}
      {loadError && <div style={{ color: "var(--accent-danger)" }}>No se pudo cargar: {loadError}</div>}
      {informe && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge" style={{
              background: informe.resultado === "Positiva" ? "var(--accent-success-soft)" : "var(--accent-danger-soft)",
              color: informe.resultado === "Positiva" ? "var(--accent-success)" : "var(--accent-danger)",
            }}>
              {informe.resultado}
            </span>
            <span className="badge" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>{informe.estado}</span>
            <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}>{informe.version}</span>
          </div>
          {[
            { label: "Tipo de informe", value: informe.tipo_informe },
            { label: "Título", value: informe.titulo },
            { label: "Vehículo", value: informe.novedad.vehiculo },
            { label: "Analista", value: informe.novedad.analista },
            { label: "Generado", value: formatFechaHora(informe.fecha_creacion) },
          ].map((f) => (
            <div key={f.label} style={{ padding: "10px 12px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{f.value || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </DrawerPanel>
  );
}

function AnalistaCard({ analista, top, tiempoEquipo }) {
  const [verTodos, setVerTodos] = useState(false);
  const [informeAbierto, setInformeAbierto] = useState(null);
  const informesVisibles = verTodos ? analista.informes : analista.informes.slice(0, 4);

  // Positivo = más rápido que el promedio del equipo (menos horas).
  const diffTiempoPct = (analista.tiempo_respuesta_promedio_horas != null && tiempoEquipo)
    ? Math.round(((tiempoEquipo - analista.tiempo_respuesta_promedio_horas) / tiempoEquipo) * 100)
    : null;

  const pctInformes = analista.respondidas
    ? Math.round((analista.informes_generados / analista.respondidas) * 100)
    : 0;

  return (
    <div className="card" style={top ? { border: "1px solid var(--border-accent)" } : undefined}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--accent-glow)", color: "var(--accent-primary)", fontWeight: 700, fontSize: 13, flexShrink: 0,
        }}>
          {inicialesDe(analista.analista)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-primary)" }}>{analista.analista}</span>
            {top && <Trophy size={14} color="var(--accent-warn)" />}
          </div>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{analista.rol || "Sin rol"}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        <BarraProgreso hechas={analista.respondidas} total={analista.total} color="var(--accent-success)" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatChip label="Asignadas" value={analista.total} bg="var(--bg-surface)" color="var(--text-primary)" />
          <StatChip label="Respondidas" value={analista.respondidas} bg="var(--accent-success-soft)" color="var(--accent-success)" />
          <StatChip label="Pendientes" value={analista.pendientes} bg="var(--accent-warn-soft)" color="var(--accent-warn)" />
        </div>
        {(analista.positivas + analista.negativas) > 0 && (
          <BarraProporcion
            a={analista.positivas} b={analista.negativas}
            colorA="var(--accent-success)" colorB="var(--accent-danger)"
            labelA="Positivas" labelB="Negativas"
          />
        )}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 14,
        background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
      }}>
        <Timer size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Tiempo de respuesta promedio (horas hábiles)
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            {formatDuracionHoras(analista.tiempo_respuesta_promedio_horas)}
            {analista.tiempo_respuesta_promedio_horas != null && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
                (mín. {formatDuracionHoras(analista.tiempo_respuesta_minimo_horas)} · máx. {formatDuracionHoras(analista.tiempo_respuesta_maximo_horas)})
              </span>
            )}
            {diffTiempoPct != null && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700,
                padding: "1px 7px", borderRadius: 99,
                background: diffTiempoPct >= 0 ? "var(--accent-success-soft)" : "var(--accent-danger-soft)",
                color: diffTiempoPct >= 0 ? "var(--accent-success)" : "var(--accent-danger)",
              }}>
                {diffTiempoPct >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(diffTiempoPct)}% {diffTiempoPct >= 0 ? "más rápido" : "más lento"} que el equipo
              </span>
            )}
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <FileText size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
            Informes generados ({analista.informes_generados}
            {analista.respondidas > 0 ? ` · ${pctInformes}% de las respondidas` : ""})
          </span>
        </div>
        {analista.informes.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Todavía no ha generado informes.</div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {informesVisibles.map((inf) => (
                <button
                  key={inf.id}
                  onClick={() => setInformeAbierto(inf.id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    padding: "7px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
                    background: "var(--bg-surface)", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    width: "100%",
                  }}
                >
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inf.codigo}
                    </span>
                    <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{formatFechaHora(inf.fecha_creacion)}</span>
                  </span>
                  <ExternalLink size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
            {analista.informes.length > 4 && (
              <button
                onClick={() => setVerTodos((v) => !v)}
                style={{ marginTop: 8, fontSize: 11.5, color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {verTodos ? "Ver menos" : `Ver los ${analista.informes.length} informes`}
              </button>
            )}
          </>
        )}
      </div>

      {informeAbierto && (
        <InformeDetalleDrawer informeId={informeAbierto} onClose={() => setInformeAbierto(null)} />
      )}
    </div>
  );
}

// Excel de respaldo/reporte de estas mismas métricas -- mismo estilo de
// exportación (ExcelJS, encabezado azul, fila de metadata) que ya usa
// Trazabilidad en NovedadDetallePage.jsx.
async function exportarMetricasXLSX(analistas, datos) {
  const columnas = [
    { key: "analista", label: "Analista", width: 26 },
    { key: "rol", label: "Rol", width: 16 },
    { key: "total", label: "Asignadas", width: 12 },
    { key: "respondidas", label: "Respondidas", width: 13 },
    { key: "pendientes", label: "Pendientes", width: 12 },
    { key: "pct_respondidas", label: "% Respondidas", width: 14 },
    { key: "positivas", label: "Positivas", width: 11 },
    { key: "negativas", label: "Negativas", width: 11 },
    { key: "pct_positivas", label: "% Positivas", width: 12 },
    { key: "tiempo_promedio", label: "Tiempo promedio (h hábiles)", width: 22 },
    { key: "tiempo_minimo", label: "Tiempo mínimo (h hábiles)", width: 20 },
    { key: "tiempo_maximo", label: "Tiempo máximo (h hábiles)", width: 20 },
    { key: "informes", label: "Informes generados", width: 16 },
    { key: "pct_informes", label: "% Informes/Respondidas", width: 18 },
  ];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Colfenix GPS";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Métricas analistas", { views: [{ state: "frozen", ySplit: 5 }] });
  hoja.columns = columnas.map((c) => ({ key: c.key, width: c.width }));

  hoja.mergeCells(1, 1, 1, columnas.length);
  const celdaTitulo = hoja.getCell(1, 1);
  celdaTitulo.value = "Métricas de analistas";
  celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };

  hoja.mergeCells(2, 1, 2, columnas.length);
  const celdaMeta = hoja.getCell(2, 1);
  celdaMeta.value =
    `Novedades: ${datos.total_general}   ·   Asignadas: ${datos.total_asignadas}   ·   Informes: ${datos.total_informes}   ·   Tiempo de equipo: ${formatDuracionHoras(datos.tiempo_respuesta_equipo_horas)}`;
  celdaMeta.font = { size: 10.5, color: { argb: "FF475569" } };

  hoja.mergeCells(3, 1, 3, columnas.length);
  const celdaExportado = hoja.getCell(3, 1);
  celdaExportado.value = `Exportado: ${new Date().toLocaleString("es-CO")}`;
  celdaExportado.font = { size: 9.5, italic: true, color: { argb: "FF94A3B8" } };

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

  analistas.forEach((a) => {
    const totalResp = a.positivas + a.negativas;
    const fila = hoja.addRow({
      analista: a.analista,
      rol: a.rol || "—",
      total: a.total,
      respondidas: a.respondidas,
      pendientes: a.pendientes,
      pct_respondidas: a.total ? Math.round((a.respondidas / a.total) * 100) : 0,
      positivas: a.positivas,
      negativas: a.negativas,
      pct_positivas: totalResp ? Math.round((a.positivas / totalResp) * 100) : "",
      tiempo_promedio: a.tiempo_respuesta_promedio_horas ?? "",
      tiempo_minimo: a.tiempo_respuesta_minimo_horas ?? "",
      tiempo_maximo: a.tiempo_respuesta_maximo_horas ?? "",
      informes: a.informes_generados,
      pct_informes: a.respondidas ? Math.round((a.informes_generados / a.respondidas) * 100) : 0,
    });
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
  enlace.download = `metricas_analistas_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

export default function MetricasAnalistasPage() {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/metricas-analistas/`, { credentials: "include" });
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        const data = await res.json();
        if (!cancelado) setDatos(data);
      } catch (err) {
        if (!cancelado) setLoadError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    }
    cargar();
    return () => { cancelado = true; };
  }, []);

  const analistas = datos?.analistas || [];
  const totalRespondidas = analistas.reduce((acc, a) => acc + a.respondidas, 0);
  const totalPendientes = analistas.reduce((acc, a) => acc + a.pendientes, 0);
  const totalPositivas = analistas.reduce((acc, a) => acc + a.positivas, 0);
  const totalNegativas = analistas.reduce((acc, a) => acc + a.negativas, 0);
  const pctRespondidas = datos?.total_asignadas ? Math.round((totalRespondidas / datos.total_asignadas) * 100) : 0;
  const pctPositivas = (totalPositivas + totalNegativas) ? Math.round((totalPositivas / (totalPositivas + totalNegativas)) * 100) : null;
  const pctInformes = totalRespondidas ? Math.round((datos?.total_informes / totalRespondidas) * 100) : 0;

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarMetricasXLSX(analistas, datos);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <div className="hero-eyebrow">Administración · Configuración de novedades</div>
          <h2 className="hero-title">Métricas de analistas</h2>
          <p className="hero-text">
            Cuántas novedades tiene asignadas cada analista, cuántas ya respondió, cuánto le toma en promedio
            responder y qué informes ha generado — para repartir la carga de revisión de DVR entre el equipo.
          </p>
        </div>
        {!loading && !loadError && datos && (
          <div className="hero-actions">
            <button className="btn btn-secondary" onClick={exportar} disabled={exportando}>
              <Download size={14} /> {exportando ? "Generando..." : "Exportar Excel"}
            </button>
          </div>
        )}
      </div>

      {loading && <div className="card" style={{ color: "var(--text-muted)" }}>Cargando métricas…</div>}
      {loadError && (
        <div className="card" style={{ color: "var(--accent-danger)" }}>
          No se pudieron cargar las métricas: {loadError}
        </div>
      )}

      {!loading && !loadError && datos && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <KpiCard
              icon={<Users size={15} />} label="Volumen" value={datos.total_asignadas}
              sublabel={`de ${datos.total_general} novedades totales`}
              bg="var(--bg-surface)" color="var(--text-primary)"
            />
            <KpiCard
              icon={<CheckCircle2 size={15} />} label="Progreso" value={`${pctRespondidas}%`}
              sublabel={`${totalRespondidas} respondidas · ${totalPendientes} pendientes`}
              bg="var(--accent-success-soft)" color="var(--accent-success)"
            />
            <KpiCard
              icon={<Scale size={15} />} label="Resultado" value={pctPositivas != null ? `${pctPositivas}% positivas` : "—"}
              sublabel={`${totalPositivas} positivas · ${totalNegativas} negativas`}
              bg="var(--accent-glow)" color="var(--accent-primary)"
            />
            <KpiCard
              icon={<FileText size={15} />} label="Informes" value={datos.total_informes}
              sublabel={`${pctInformes}% de las respondidas`}
              bg="var(--accent-warn-soft)" color="var(--accent-warn)"
            />
            <KpiCard
              icon={<Timer size={15} />} label="Tiempo de equipo" value={formatDuracionHoras(datos.tiempo_respuesta_equipo_horas)}
              sublabel="Promedio horas hábiles"
              bg="var(--accent-danger-soft)" color="var(--accent-danger)"
            />
          </div>

          {analistas.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>
              No hay usuarios con rol de analista registrados todavía.
            </div>
          ) : (
            <div className="grid-2" style={{ alignItems: "start" }}>
              {analistas.map((a, i) => (
                <AnalistaCard
                  key={a.analista_id}
                  analista={a}
                  top={i === 0 && a.informes_generados > 0}
                  tiempoEquipo={datos.tiempo_respuesta_equipo_horas}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
