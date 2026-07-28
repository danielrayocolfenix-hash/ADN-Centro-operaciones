import React, { useState, useEffect } from "react";
import { Radio, MapPin, Gauge, User, Navigation, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { vehiculos as initialVehiculos, clientes } from "../data/mockData";
import { getVehiculoEstadoColor } from "../utils/helpers";

export default function MonitoreoPage({ onNovedad }) {
  const [vehiculos, setVehiculos] = useState(initialVehiculos);
  const [selected, setSelected] = useState(null);
  const [tick, setTick] = useState(0);

  // Simular actualizaciones de velocidad
  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1);
      setVehiculos(vs => vs.map(v => {
        if (v.estado !== "En ruta") return v;
        const delta = Math.floor(Math.random() * 11) - 5;
        return { ...v, velocidad: Math.max(60, Math.min(110, v.velocidad + delta)) };
      }));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const activos = vehiculos.filter(v => v.estado === "En ruta").length;
  const sinSenal = vehiculos.filter(v => v.estado === "Sin señal").length;
  const detenidos = vehiculos.filter(v => v.estado === "Detenido").length;

  return (
    <div className="page-wrapper">
      {/* KPIs */}
      <div style={{ display: "flex", gap: 14 }}>
        {[
          { label: "En ruta", value: activos, color: "var(--accent-success)", icon: Navigation },
          { label: "Detenidos", value: detenidos, color: "var(--accent-warn)", icon: AlertCircle },
          { label: "Sin señal", value: sinSenal, color: "var(--accent-danger)", icon: WifiOff },
          { label: "Total flota", value: vehiculos.length, color: "var(--accent-primary)", icon: Radio },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="kpi-card" style={{ flex: 1 }}>
            <div className="kpi-label">{label}</div>
            <div className="kpi-value" style={{ color }}>{value}</div>
            <div className="kpi-icon"><Icon size={36} /></div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        {/* Tarjetas de vehículos */}
        <div>
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="pulse-dot" />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Actualizando en tiempo real · datos cada 3 seg</span>
          </div>
          <div className="monitoreo-grid">
            {vehiculos.map(v => {
              const cli = clientes.find(c => c.id === v.cliente);
              const color = getVehiculoEstadoColor(v.estado);
              const isActive = v.estado === "En ruta";
              const isAlert = v.estado === "Sin señal";
              return (
                <div
                  key={v.id}
                  className={`vehiculo-card ${isActive ? "activo" : isAlert ? "alerta" : ""}`}
                  style={{ cursor: "pointer", borderColor: selected?.id === v.id ? "var(--accent-primary)" : undefined }}
                  onClick={() => setSelected(v === selected ? null : v)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <span className="placa">{v.placa}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color }}>
                      {isActive ? <Wifi size={12} /> : isAlert ? <WifiOff size={12} /> : <AlertCircle size={12} />}
                      {v.estado}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-secondary)" }}>
                      <User size={12} color="var(--text-muted)" /> {v.conductor}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-secondary)" }}>
                      <Navigation size={12} color="var(--text-muted)" /> {v.ruta}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-secondary)" }}>
                      <MapPin size={12} color="var(--text-muted)" />
                      <span style={{ fontSize: 10, fontFamily: "monospace" }}>
                        {v.lat.toFixed(4)}, {v.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  {/* Velocímetro visual */}
                  {v.estado === "En ruta" && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Gauge size={11} /> Velocidad</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, color: v.velocidad > 100 ? "var(--accent-danger)" : "var(--accent-primary)" }}>
                          {v.velocidad} km/h
                        </span>
                      </div>
                      <div style={{ height: 4, background: "var(--bg-surface)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 2,
                          width: `${Math.min(100, (v.velocidad / 120) * 100)}%`,
                          background: v.velocidad > 100 ? "var(--accent-danger)" : v.velocidad > 90 ? "var(--accent-warn)" : "var(--accent-primary)",
                          transition: "width 0.8s ease"
                        }} />
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)" }}>
                    {cli?.codigo} · {cli?.razonSocial}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel lateral */}
        <div>
          {selected ? (
            <div className="card" style={{ position: "sticky", top: 0 }}>
              <div className="card-header">
                <div className="card-title"><Radio size={16} /> Detalle unidad</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div className="placa" style={{ fontSize: 22, letterSpacing: "0.15em" }}>{selected.placa}</div>
                  <div style={{ fontSize: 12, color: getVehiculoEstadoColor(selected.estado), fontWeight: 600, marginTop: 4 }}>
                    {selected.estado}
                  </div>
                </div>
                <div className="divider" />
                {[
                  { label: "Conductor", value: selected.conductor },
                  { label: "Ruta", value: selected.ruta },
                  { label: "Cliente", value: clientes.find(c => c.id === selected.cliente)?.razonSocial },
                  { label: "Velocidad actual", value: selected.velocidad > 0 ? `${selected.velocidad} km/h` : "Detenido" },
                  { label: "Coordenadas", value: `${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                    <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
                <div className="divider" />
                <button className="btn btn-danger" style={{ width: "100%" }} onClick={() => onNovedad(selected)}>
                  <AlertCircle size={14} /> Registrar novedad
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)" }}>
                <Radio size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p style={{ fontSize: 13 }}>Selecciona una unidad para ver sus detalles y registrar novedades</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
