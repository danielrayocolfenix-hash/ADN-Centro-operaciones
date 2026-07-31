import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Hash, Truck, User, FileCheck } from "lucide-react";
import { API_BASE } from "../../config/api";
import { getCsrfToken } from "../../utils/csrf";
import { formatFecha, formatFechaHora } from "../../utils/helpers";
import Toast from "../../components/ui/Toast";
import { InformePoster } from "../Novedades/NovedadDetallePage";

function Ficha({ novedad }) {
  const campos = [
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

function RespuestaForm({ novedadId, onRespondido, toast }) {
  const [respuesta, setRespuesta] = useState(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!respuesta) return;
    setEnviando(true);
    try {
      const res = await fetch(`${API_BASE}/api/portal/novedades/${novedadId}/responder/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ respuesta_cliente: respuesta, comentario_cliente: comentario }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo enviar la respuesta");
      toast("Respuesta enviada correctamente", "success");
      onRespondido();
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Responder</span>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
        Revisa el resultado del informe y registra si estás conforme o tienes objeciones. Esta respuesta no se puede
        editar después de enviarla.
      </p>
      <div style={{ display: "flex", gap: 10, marginBottom: respuesta ? 16 : 0 }}>
        <button
          className={`btn ${respuesta === "Conforme" ? "btn-success" : "btn-secondary"}`}
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => setRespuesta("Conforme")}
        >
          <CheckCircle2 size={15} /> Conforme
        </button>
        <button
          className={`btn ${respuesta === "No_conforme" ? "btn-danger" : "btn-secondary"}`}
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => setRespuesta("No_conforme")}
        >
          <XCircle size={15} /> No conforme
        </button>
      </div>
      {respuesta && (
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Comentario (opcional)</label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Cuéntanos más sobre tu respuesta..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />
        </div>
      )}
      {respuesta && (
        <button className="btn btn-primary" onClick={enviar} disabled={enviando}>
          {enviando ? "Enviando..." : "Enviar respuesta"}
        </button>
      )}
    </div>
  );
}

function RespuestaRegistrada({ novedad }) {
  const positivo = novedad.respuesta_cliente === "Conforme";
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Tu respuesta</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          className="badge"
          style={{
            background: positivo ? "var(--accent-success-soft)" : "var(--accent-danger-soft)",
            color: positivo ? "var(--accent-success)" : "var(--accent-danger)",
          }}
        >
          {positivo ? "Conforme" : "No conforme"}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          {formatFechaHora(novedad.fecha_respuesta_cliente)}
        </span>
      </div>
      {novedad.comentario_cliente && (
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{novedad.comentario_cliente}</p>
      )}
    </div>
  );
}

export default function PortalNovedadDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [novedad, setNovedad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const mostrarToast = (msg, type) => setToast({ msg, type });

  const cargar = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/portal/novedades/${id}/`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        return res.json();
      })
      .then(setNovedad)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, [id]); // eslint-disable-line

  if (loading) return <div className="page-shell" style={{ color: "var(--text-muted)" }}>Cargando…</div>;
  if (error) return <div className="page-shell" style={{ color: "var(--accent-danger)" }}>Error: {error}</div>;
  if (!novedad) return null;

  return (
    <div className="page-shell">
      <button
        className="btn btn-secondary"
        style={{ alignSelf: "flex-start" }}
        onClick={() => navigate("/")}
      >
        <ArrowLeft size={14} /> Volver a mis novedades
      </button>

      <Ficha novedad={novedad} />

      <InformePoster informe={novedad.informe} />

      {novedad.respuesta_cliente ? (
        <RespuestaRegistrada novedad={novedad} />
      ) : novedad.puede_responder ? (
        <RespuestaForm novedadId={novedad.id} onRespondido={cargar} toast={mostrarToast} />
      ) : (
        <div className="card" style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
          Todavía no hay un informe generado para responder.
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
