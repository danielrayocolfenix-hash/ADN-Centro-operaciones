import React, { useEffect, useState } from "react";
import { Users, CheckCircle2, Clock } from "lucide-react";
import { API_BASE } from "../../config/api";

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
            Cuántas novedades tiene asignadas hoy cada analista y cuántas ya respondió, para repartir la carga de
            revisión de DVR entre el equipo.
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
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title"><Users size={15} /> Por analista</span></div>
            {analistas.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                No hay usuarios con rol de analista registrados todavía.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Analista</th>
                    <th>Asignadas</th>
                    <th>Respondidas</th>
                    <th>Pendientes</th>
                    <th>Positivas</th>
                    <th>Negativas</th>
                    <th>% respondido</th>
                  </tr>
                </thead>
                <tbody>
                  {analistas.map((a) => {
                    const pct = a.total ? Math.round((a.respondidas / a.total) * 100) : 0;
                    return (
                      <tr key={a.analista_id}>
                        <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{a.analista}</td>
                        <td>{a.total}</td>
                        <td>
                          <span className="badge" style={{ background: "var(--accent-success-soft)", color: "var(--accent-success)" }}>
                            <CheckCircle2 size={11} /> {a.respondidas}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={{ background: "var(--accent-warn-soft)", color: "var(--accent-warn)" }}>
                            <Clock size={11} /> {a.pendientes}
                          </span>
                        </td>
                        <td>{a.positivas}</td>
                        <td>{a.negativas}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
                            <div style={{ flex: 1, height: 7, borderRadius: 99, background: "var(--bg-surface)", overflow: "hidden" }}>
                              <div style={{
                                height: "100%", width: `${pct}%`, borderRadius: 99,
                                background: pct >= 80 ? "var(--accent-success)" : pct >= 40 ? "var(--accent-warn)" : "var(--accent-danger)",
                              }} />
                            </div>
                            <span style={{ fontSize: 12, color: "var(--text-muted)", width: 34, textAlign: "right" }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
