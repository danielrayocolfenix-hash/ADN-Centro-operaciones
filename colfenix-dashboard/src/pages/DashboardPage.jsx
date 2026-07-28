import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Radio, AlertTriangle, Users, FileText,
  TrendingUp, Clock, CheckCircle2, ShieldAlert
} from "lucide-react";
import { novedadesPorDia, novedadesPorTipo, kpis, novedades, vehiculos, clientes } from "../data/mockData";
import { formatFechaHora, getEstadoColor, getPrioridadColor } from "../utils/helpers";

const COLORS = ["#00C6FF", "#0057FF", "#F59E0B", "#EF4444", "#22C55E", "#8B5CF6"];

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

const countNovedadesHoy = () => {
  const url = fetch("/api/novedades/count/");
  return url.then(response => response.json())
    .then(data => data.novedades_hoy)
    .catch(error => {
      console.error("Error al obtener el conteo de novedades hoy:", error);
      return 0;
    });
}

export default function DashboardPage({ onNavigate }) {
  const novedadesAbiertas = novedades.filter(n => n.estado === "Abierta" || n.estado === "En proceso");
  const novedadesRecientes = [...novedades].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);

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
        </div>
      </div>

      <div className="hero-metrics">
        <div className="metric-pill"><strong>{novedadesAbiertas.length}</strong> casos activos</div>
        <div className="metric-pill"><strong>{kpis.informesPendientes}</strong> informes pendientes</div>
        <div className="metric-pill"><strong>{kpis.alertasCriticas}</strong> alertas críticas</div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card success" style={{ cursor: "pointer" }} onClick={() => onNavigate("monitoreo")}>
          <div className="kpi-label">Vehículos en ruta</div>
          <div className="kpi-value">{kpis.vehiculosActivos}</div>
          <div className="kpi-sub">de {kpis.vehiculosTotal} registrados</div>
          <div className="kpi-icon"><Radio size={40} /></div>
        </div>
        <div className="kpi-card danger" style={{ cursor: "pointer" }} onClick={() => onNavigate("novedades")}>
          <div className="kpi-label">Alertas críticas</div>
          <div className="kpi-value">{kpis.alertasCriticas}</div>
          <div className="kpi-sub">Requieren atención</div>
          <div className="kpi-icon"><ShieldAlert size={40} /></div>
        </div>
        <div className="kpi-card warn" style={{ cursor: "pointer" }} onClick={() => onNavigate("novedades")}>
          <div className="kpi-label">Novedades hoy</div>
          <div className="kpi-value">{kpis.novedadesHoy}</div>
          <div className="kpi-sub">{kpis.novedadesMes} en el mes</div>
          <div className="kpi-icon"><AlertTriangle size={40} /></div>
        </div>
        <div className="kpi-card" style={{ cursor: "pointer" }} onClick={() => onNavigate("informes")}>
          <div className="kpi-label">Informes pendientes</div>
          <div className="kpi-value">{kpis.informesPendientes}</div>
          <div className="kpi-sub">Por generar</div>
          <div className="kpi-icon"><FileText size={40} /></div>
        </div>
        <div className="kpi-card" style={{ cursor: "pointer" }} onClick={() => onNavigate("clientes")}>
          <div className="kpi-label">Clientes activos</div>
          <div className="kpi-value">{clientes.filter(c => c.estado === "Activo").length}</div>
          <div className="kpi-sub">de {clientes.length} registrados</div>
          <div className="kpi-icon"><Users size={40} /></div>
        </div>
      </div>

      {/* Gráficas */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title"><TrendingUp size={16} /> Novedades esta semana</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={novedadesPorDia} barSize={22}>
              <XAxis dataKey="dia" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={20} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,198,255,0.05)" }} />
              <Bar dataKey="novedades" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title"><AlertTriangle size={16} /> Distribución por tipo</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={novedadesPorTipo} dataKey="cantidad" nameKey="tipo"
                cx="40%" cy="50%" outerRadius={70} innerRadius={40}
              >
                {novedadesPorTipo.map((_, i) => (
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
      </div>

      {/* Novedades abiertas */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><Clock size={16} /> Novedades abiertas</div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("novedades")}>Ver todas</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Vehículo</th>
              <th>Ubicación</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Hora</th>
            </tr>
          </thead>
          <tbody>
            {novedadesRecientes.map(n => {
              const estadoStyle = getEstadoColor(n.estado);
              return (
                <tr key={n.id}>
                  <td><span className="mono text-accent">{n.id}</span></td>
                  <td style={{ color: "var(--text-primary)" }}>{n.tipo}</td>
                  <td className="mono">{vehiculos.find(v => v.id === n.vehiculo)?.placa || "—"}</td>
                  <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.ubicacion}</td>
                  <td>
                    <span className="badge" style={{ background: `${getPrioridadColor(n.prioridad)}20`, color: getPrioridadColor(n.prioridad), border: `1px solid ${getPrioridadColor(n.prioridad)}40` }}>
                      {n.prioridad}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{ background: estadoStyle.bg, color: estadoStyle.text }}>
                      {n.estado}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{formatFechaHora(n.fecha)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Estado vehículos */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><Radio size={16} /> Estado de flota en tiempo real</div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("monitoreo")}>Ver monitoreo</button>
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {vehiculos.map(v => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <span className={`status-dot ${v.estado === "En ruta" ? "active" : v.estado === "Sin señal" ? "danger" : "warn"}`} />
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-primary)" }}>{v.placa}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.estado}</span>
              {v.velocidad > 0 && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{v.velocidad} km/h</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
