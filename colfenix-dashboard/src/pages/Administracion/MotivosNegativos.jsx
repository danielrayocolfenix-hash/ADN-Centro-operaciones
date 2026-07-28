import React, { useEffect, useState } from "react";
import { ListChecks, Plus, Power } from "lucide-react";
import { API_BASE } from "../../config/api";
import { getCsrfToken } from "../../utils/csrf";
import Toast from "../../components/ui/Toast";

export default function MotivosNegativosPage() {
  const [motivos, setMotivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [creando, setCreando] = useState(false);
  const [toast, setToast] = useState(null);

  const cargarMotivos = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/motivos-negativa/`, { credentials: "include" });
      if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
      setMotivos(await res.json());
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarMotivos(); }, []);

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCreando(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/motivos-negativa/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim() }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo crear el motivo");
      setNombre("");
      setDescripcion("");
      setToast({ msg: "Motivo creado", type: "success" });
      await cargarMotivos();
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
    } finally {
      setCreando(false);
    }
  };

  const toggleActivo = async (motivo) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/motivos-negativa/${motivo.id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ activo: !motivo.activo }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo actualizar");
      setMotivos((ms) => ms.map((m) => (m.id === motivo.id ? { ...m, activo: !m.activo } : m)));
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
    }
  };

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <div className="hero-eyebrow">Administración</div>
          <h2 className="hero-title">Motivos de negativa</h2>
          <p className="hero-text">
            Catálogo de razones por las que una revisión de DVR resulta Negativa. Cualquier motivo nuevo que agregues
            aquí queda disponible de inmediato en la pantalla de revisión de novedades.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title"><Plus size={15} /> Nuevo motivo</span></div>
        <form onSubmit={handleCrear} className="form-grid">
          <div className="form-group">
            <label className="form-label">Nombre<span className="req"> *</span></label>
            <input className="form-input" value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Cámara desconectada" required />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input className="form-input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Contexto opcional para el analista" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="btn btn-primary" disabled={creando}>
              {creando ? "Creando..." : "Agregar motivo"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title"><ListChecks size={15} /> Catálogo actual</span></div>
        {loading && <div style={{ color: "var(--text-muted)" }}>Cargando…</div>}
        {loadError && <div style={{ color: "var(--accent-danger)" }}>No se pudo cargar: {loadError}</div>}
        {!loading && !loadError && (
          <table className="data-table">
            <thead>
              <tr><th>Nombre</th><th>Descripción</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {motivos.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{m.nombre}</td>
                  <td>{m.descripcion || "—"}</td>
                  <td>
                    <span className="badge" style={{
                      background: m.activo ? "var(--accent-success-soft)" : "var(--accent-danger-soft)",
                      color: m.activo ? "var(--accent-success)" : "var(--accent-danger)",
                    }}>
                      {m.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => toggleActivo(m)}>
                      <Power size={12} /> {m.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
              {motivos.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                  Sin motivos registrados todavía.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
