import React, { useEffect, useState } from "react";
import { Users, CheckCircle2, Clock, FileText, Timer, ExternalLink, Trophy } from "lucide-react";
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

function AnalistaCard({ analista, top }) {
  const [verTodos, setVerTodos] = useState(false);
  const [informeAbierto, setInformeAbierto] = useState(null);
  const informesVisibles = verTodos ? analista.informes : analista.informes.slice(0, 4);

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

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <StatChip label="Asignadas" value={analista.total} bg="var(--bg-surface)" color="var(--text-primary)" />
        <StatChip label="Respondidas" value={analista.respondidas} bg="var(--accent-success-soft)" color="var(--accent-success)" />
        <StatChip label="Pendientes" value={analista.pendientes} bg="var(--accent-warn-soft)" color="var(--accent-warn)" />
        <StatChip label="Positivas" value={analista.positivas} bg="var(--accent-glow)" color="var(--accent-primary)" />
        <StatChip label="Negativas" value={analista.negativas} bg="var(--accent-danger-soft)" color="var(--accent-danger)" />
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
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            {formatDuracionHoras(analista.tiempo_respuesta_promedio_horas)}
            {analista.tiempo_respuesta_promedio_horas != null && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400, marginLeft: 8 }}>
                (mín. {formatDuracionHoras(analista.tiempo_respuesta_minimo_horas)} · máx. {formatDuracionHoras(analista.tiempo_respuesta_maximo_horas)})
              </span>
            )}
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <FileText size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
            Informes generados ({analista.informes_generados})
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

export default function MetricasAnalistasPage() {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

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
      </div>

      {loading && <div className="card" style={{ color: "var(--text-muted)" }}>Cargando métricas…</div>}
      {loadError && (
        <div className="card" style={{ color: "var(--accent-danger)" }}>
          No se pudieron cargar las métricas: {loadError}
        </div>
      )}

      {!loading && !loadError && datos && (
        <>
          <div className="hero-metrics">
            <div className="metric-pill"><strong>{datos.total_general}</strong> novedades generadas</div>
            <div className="metric-pill"><strong>{datos.total_asignadas}</strong> asignadas a analistas</div>
            <div className="metric-pill"><strong>{totalRespondidas}</strong> respondidas</div>
            <div className="metric-pill"><strong>{totalPendientes}</strong> pendientes</div>
            <div className="metric-pill"><strong>{datos.total_informes}</strong> informes generados</div>
            <div className="metric-pill">
              <strong>{formatDuracionHoras(datos.tiempo_respuesta_equipo_horas)}</strong> tiempo de respuesta del equipo
            </div>
          </div>

          {analistas.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>
              No hay usuarios con rol de analista registrados todavía.
            </div>
          ) : (
            <div className="grid-2" style={{ alignItems: "start" }}>
              {analistas.map((a, i) => (
                <AnalistaCard key={a.analista_id} analista={a} top={i === 0 && a.informes_generados > 0} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
