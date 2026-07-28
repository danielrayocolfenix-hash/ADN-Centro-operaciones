import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogIn, MapPin } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      const destino = location.state?.from?.pathname || "/";
      navigate(destino, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-base)",
    }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 360 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div className="logo-icon"><img src=""></img></div>
          <div>
            <strong style={{ display: "block", fontSize: 13, color: "var(--text-primary)" }}>COLFENIX GPS</strong>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Centro de Monitoreo</span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Usuario</label>
          <input
            className="form-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Contraseña</label>
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div style={{ fontSize: 12.5, color: "var(--accent-danger)", marginBottom: 12 }}>{error}</div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
          disabled={submitting}
        >
          <LogIn size={15} /> {submitting ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
