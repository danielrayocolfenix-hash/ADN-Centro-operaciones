import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, FileWarning } from "lucide-react";
import { API_BASE } from "../../config/api";
import { formatFecha } from "../../utils/helpers";

const ESTADO_BADGE = {
  Positiva: { color: "var(--accent-success)", bg: "var(--accent-success-soft)" },
  Negativa: { color: "var(--accent-danger)", bg: "var(--accent-danger-soft)" },
};

function ResultadoBadge({ respuesta }) {
  if (!respuesta) {
    return <span className="badge" style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>En proceso</span>;
  }
  const info = ESTADO_BADGE[respuesta] || { color: "var(--text-muted)", bg: "var(--bg-surface)" };
  return <span className="badge" style={{ background: info.bg, color: info.color }}>{respuesta}</span>;
}

function RespuestaBadge({ novedad }) {
  if (novedad.respuesta_cliente === "Conforme") {
    return <span className="badge" style={{ background: "var(--accent-success-soft)", color: "var(--accent-success)" }}>Conforme</span>;
  }
  if (novedad.respuesta_cliente === "No_conforme") {
    return <span className="badge" style={{ background: "var(--accent-danger-soft)", color: "var(--accent-danger)" }}>No conforme</span>;
  }
  if (novedad.puede_responder) {
    return <span className="badge" style={{ background: "var(--accent-warn-soft)", color: "var(--accent-warn)" }}>Pendiente de responder</span>;
  }
  return <span className="badge" style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>—</span>;
}

// Pantalla de soporte/demo para el staff: muestra exactamente lo mismo que
// vería un cliente en su portal (mismo endpoint recortado, ver
// apps.novedades.views.staff_vista_cliente_listar_novedades), con un
// selector de Cliente -- "Todos los clientes" (por defecto, para que un
// superadmin tenga visión completa) o uno puntual para revisar/hacer soporte
// sobre ese cliente en concreto. Es de solo lectura: la respuesta la
// registra el cliente desde su propio portal, no el staff desde acá.
export default function VistaClientePage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [novedades, setNovedades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/clientes/`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    const query = clienteId ? `?cliente_id=${clienteId}` : "";
    fetch(`${API_BASE}/api/admin/vista-cliente/novedades/${query}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        return res.json();
      })
      .then((data) => { if (!cancelado) setNovedades(data); })
      .catch((err) => { if (!cancelado) setError(err.message); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [clienteId]);

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <div className="hero-eyebrow">Administración</div>
          <h2 className="hero-title">Vista de cliente</h2>
          <p className="hero-text">
            Lo mismo que vería un cliente en su portal -- sin editar nada, solo para soporte o demostraciones. Por
            defecto muestra todos los clientes; elige uno para revisar solo el suyo.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="form-group" style={{ marginBottom: 0, maxWidth: 320 }}>
          <label className="form-label">Cliente</label>
          <select className="form-select" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Todos los clientes</option>
            {clientes.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {loading && <div style={{ color: "var(--text-muted)" }}>Cargando…</div>}
        {error && <div style={{ color: "var(--accent-danger)" }}>Error: {error}</div>}
        {!loading && !error && novedades.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <FileWarning size={24} />
            No hay novedades para mostrar.
          </div>
        )}
        {!loading && !error && novedades.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Código</th>
                <th>Vehículo</th>
                <th>Tipo de informe</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Resultado</th>
                <th>Respuesta cliente</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {novedades.map((n) => (
                <tr key={n.id} onClick={() => navigate(`/administracion/vista-cliente/${n.id}`)} style={{ cursor: "pointer" }}>
                  <td>{n.cliente}</td>
                  <td style={{ fontWeight: 600 }}>{n.codigo_novedad}</td>
                  <td>{n.vehiculo} · {n.numero_interno}</td>
                  <td>{n.categoria_informe} · {n.tipo_informe}</td>
                  <td>{formatFecha(n.fecha_novedad)}</td>
                  <td>{n.estado_dd_display}</td>
                  <td><ResultadoBadge respuesta={n.respuesta_novedad} /></td>
                  <td><RespuestaBadge novedad={n} /></td>
                  <td><Eye size={14} color="var(--text-muted)" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
