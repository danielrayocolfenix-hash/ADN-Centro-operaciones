import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { API_BASE } from "../../config/api";
import { getCsrfToken } from "../../utils/csrf";
import { formatFechaRelativa } from "../../utils/helpers";

// Severidad -> color, mismo patrón que PrioridadBadge/EstadoPilaBadge en
// Administracion/ConfiguracionSLA.jsx: un objeto {bg, color} por valor.
const SEVERIDAD_ESTILO = {
  accion_requerida: { bg: "var(--accent-warn-soft)", color: "var(--accent-warn)" },
  informativo: { bg: "var(--accent-glow)", color: "var(--accent-primary)" },
};

const POLL_MS = 60000;

async function fetchNotificaciones() {
  const res = await fetch(`${API_BASE}/api/portal/notificaciones/`, { credentials: "include" });
  if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
  return res.json();
}

async function marcarLeidas(body) {
  await fetch(`${API_BASE}/api/portal/notificaciones/marcar-leidas/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
    credentials: "include",
    body: JSON.stringify(body),
  });
}

// Campana de notificaciones del portal de cliente -- polling simple cada
// POLL_MS, sin websockets: el volumen de eventos por cliente (cambios de
// etapa, informes) no justifica esa complejidad todavía. Mismo patrón de
// "cerrar al hacer clic afuera" que VehiculoLookup en
// Administracion/ConfiguracionSLA.jsx.
export default function NotificacionesBell() {
  const [resultados, setResultados] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const cargar = async () => {
    try {
      const data = await fetchNotificaciones();
      setResultados(data.resultados);
      setNoLeidas(data.no_leidas);
    } catch {
      // silencioso -- no vale la pena un toast por un fallo de polling
    }
  };

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const marcarTodasLeidas = async () => {
    setResultados((rs) => rs.map((r) => ({ ...r, leido: true })));
    setNoLeidas(0);
    await marcarLeidas({});
  };

  const abrirNotificacion = async (n) => {
    setOpen(false);
    if (!n.leido) {
      setResultados((rs) => rs.map((r) => (r.id === n.id ? { ...r, leido: true } : r)));
      setNoLeidas((c) => Math.max(0, c - 1));
      marcarLeidas({ id: n.id });
    }
    navigate(`/novedades/${n.novedad_id}`);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="btn-icon"
        onClick={() => setOpen((o) => !o)}
        aria-label="Ver notificaciones"
        aria-expanded={open}
        style={{ position: "relative" }}
      >
        <Bell size={16} />
        {noLeidas > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            background: "var(--accent-danger)", color: "white",
            fontSize: 9, fontWeight: 700, borderRadius: "50%",
            width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
            border: "1.5px solid var(--bg-base, var(--bg-card))",
          }}>
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 10px)", right: 0,
          width: 340, maxHeight: 380, overflowY: "auto",
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-md, 10px)",
          boxShadow: "0 12px 28px -8px rgba(0,0,0,0.35)",
          zIndex: 60,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", borderBottom: "1px solid var(--border)",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Notificaciones
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {noLeidas > 0 && (
                <button
                  onClick={marcarTodasLeidas}
                  style={{
                    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 11, color: "var(--accent-primary)", fontWeight: 600, padding: "2px 4px",
                  }}
                >
                  Marcar leídas
                </button>
              )}
              <button className="btn-icon" onClick={() => setOpen(false)} aria-label="Cerrar notificaciones">
                <X size={13} />
              </button>
            </div>
          </div>

          {resultados.length === 0 ? (
            <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
              Sin notificaciones todavía
            </div>
          ) : (
            <div>
              {resultados.map((n) => {
                const estilo = SEVERIDAD_ESTILO[n.severidad] || SEVERIDAD_ESTILO.informativo;
                return (
                  <button
                    key={n.id}
                    onClick={() => abrirNotificacion(n)}
                    style={{
                      display: "flex", gap: 10, width: "100%", textAlign: "left",
                      padding: "10px 14px", borderBottom: "1px solid var(--border)",
                      background: n.leido ? "none" : "var(--bg-hover, rgba(255,255,255,0.02))",
                      border: "none", borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "var(--border)",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                      background: n.leido ? "transparent" : estilo.color,
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 12.5, lineHeight: 1.4,
                        color: n.leido ? "var(--text-muted)" : "var(--text-primary)",
                        fontWeight: n.leido ? 400 : 600,
                      }}>
                        {n.mensaje}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <span className="badge" style={{ background: estilo.bg, color: estilo.color, fontSize: 10 }}>
                          {n.codigo_novedad}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatFechaRelativa(n.creado)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
