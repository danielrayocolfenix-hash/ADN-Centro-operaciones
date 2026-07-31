import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Hash, Truck, User, FileCheck, Building2 } from "lucide-react";
import { API_BASE } from "../../config/api";
import { formatFechaHora } from "../../utils/helpers";
import { InformePoster } from "../Novedades/NovedadDetallePage";

function Ficha({ novedad }) {
  const campos = [
    { icon: Building2, label: "Cliente", value: novedad.cliente },
    { icon: Hash, label: "Código", value: novedad.codigo_novedad },
    { icon: Truck, label: "Vehículo", value: `${novedad.vehiculo} · ${novedad.numero_interno}` },
    { icon: User, label: "Conductor", value: novedad.conductor },
    { icon: FileCheck, label: "Tipo de informe", value: `${novedad.categoria_informe} · ${novedad.tipo_informe}` },
  ];
  return (
    <div className="card">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {campos.map((c) => (
          <div key={c.label} style={{ display: "flex", gap: 10 }}>
            <c.icon size={15} color="var(--text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.label}</div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{c.value || "—"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RespuestaCliente({ novedad }) {
  if (!novedad.respuesta_cliente) {
    return (
      <div className="card" style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
        {novedad.puede_responder ? "El cliente aún no ha respondido." : "Todavía no hay un informe generado para que el cliente responda."}
      </div>
    );
  }
  const positivo = novedad.respuesta_cliente === "Conforme";
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Respuesta del cliente</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: novedad.comentario_cliente ? 8 : 0 }}>
        <span className="badge" style={{
          background: positivo ? "var(--accent-success-soft)" : "var(--accent-danger-soft)",
          color: positivo ? "var(--accent-success)" : "var(--accent-danger)",
        }}>
          {positivo ? "Conforme" : "No conforme"}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{formatFechaHora(novedad.fecha_respuesta_cliente)}</span>
      </div>
      {novedad.comentario_cliente && (
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{novedad.comentario_cliente}</p>
      )}
    </div>
  );
}

// Espejo de solo lectura de PortalNovedadDetallePage -- mismo endpoint
// recortado (staff_vista_cliente_listar_novedades), sin el formulario de
// respuesta: esa acción es del cliente, no del staff.
export default function VistaClienteDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [novedad, setNovedad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`${API_BASE}/api/admin/vista-cliente/novedades/${id}/`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        return res.json();
      })
      .then((data) => { if (!cancelado) setNovedad(data); })
      .catch((err) => { if (!cancelado) setError(err.message); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [id]);

  if (loading) return <div className="page-shell" style={{ color: "var(--text-muted)" }}>Cargando…</div>;
  if (error || !novedad) return <div className="page-shell" style={{ color: "var(--accent-danger)" }}>Error: {error || "no encontrada"}</div>;

  return (
    <div className="page-shell">
      <button className="btn btn-secondary" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/administracion/vista-cliente")}>
        <ArrowLeft size={14} /> Volver a vista de cliente
      </button>

      <Ficha novedad={novedad} />
      <InformePoster informe={novedad.informe} />
      <RespuestaCliente novedad={novedad} />
    </div>
  );
}
