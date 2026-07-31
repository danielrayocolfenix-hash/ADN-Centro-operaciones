import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileWarning } from "lucide-react";
import { API_BASE } from "../../config/api";
import { formatFecha } from "../../utils/helpers";

const ESTADO_BADGE = {
  Positiva: { color: "var(--accent-success)", bg: "var(--accent-success-soft)" },
  Negativa: { color: "var(--accent-danger)", bg: "var(--accent-danger-soft)" },
};

function ResultadoBadge({ respuesta }) {
  if (!respuesta) {
    return (
      <span className="badge" style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>
        En proceso
      </span>
    );
  }
  const info = ESTADO_BADGE[respuesta] || { color: "var(--text-muted)", bg: "var(--bg-surface)" };
  return (
    <span className="badge" style={{ background: info.bg, color: info.color }}>
      {respuesta}
    </span>
  );
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

export default function PortalNovedadesPage() {
  const navigate = useNavigate();
  const [novedades, setNovedades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`${API_BASE}/api/portal/novedades/`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        return res.json();
      })
      .then((data) => { if (!cancelado) setNovedades(data); })
      .catch((err) => { if (!cancelado) setError(err.message); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, []);

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <div className="hero-eyebrow">Portal de cliente</div>
          <h2 className="hero-title">Mis novedades</h2>
          <p className="hero-text">
            Casos de revisión DVR de tus vehículos. Cuando el informe ya esté generado podrás responder si estás
            conforme o tienes objeciones.
          </p>
        </div>
      </div>

      <div className="card">
        {loading && <div style={{ color: "var(--text-muted)" }}>Cargando…</div>}
        {error && <div style={{ color: "var(--accent-danger)" }}>Error: {error}</div>}
        {!loading && !error && novedades.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <FileWarning size={24} />
            No tienes novedades registradas todavía.
          </div>
        )}
        {!loading && !error && novedades.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Vehículo</th>
                <th>Tipo de informe</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Resultado</th>
                <th>Tu respuesta</th>
              </tr>
            </thead>
            <tbody>
              {novedades.map((n) => (
                <tr
                  key={n.id}
                  onClick={() => navigate(`/novedades/${n.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td style={{ fontWeight: 600 }}>{n.codigo_novedad}</td>
                  <td>{n.vehiculo} · {n.numero_interno} · {n.grupo_flota}</td>
                  <td>{n.categoria_informe} · {n.tipo_informe}</td>
                  <td>{formatFecha(n.fecha_novedad)}</td>
                  <td>{n.estado_dd_display}</td>
                  <td><ResultadoBadge respuesta={n.respuesta_novedad} /></td>
                  <td><RespuestaBadge novedad={n} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
