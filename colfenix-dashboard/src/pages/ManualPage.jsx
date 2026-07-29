import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, PlayCircle, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { API_BASE } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { tienePermiso } from "../utils/permisos";

// Catálogo de manuales -- cada uno describe una funcionalidad y, al abrirse
// "en vivo", navega a una pantalla real con `state: { iniciarTour, volverA }`
// para que esa pantalla dispare su propio recorrido de Driver.js (ver
// iniciarTourRevisionDVR en NovedadDetallePage.jsx e
// iniciarTourConfiguracionNovedades en ConfiguracionSLA.jsx) y, al terminar,
// vuelva acá -- así se agregan más manuales en el futuro sin tocar esta
// pantalla. `necesitaEjemplo: true` es para manuales sobre un registro
// puntual (una novedad real); `false` es para pantallas fijas (ej.
// Administración), que no dependen de que exista ningún dato todavía.
const MANUALES = [
  {
    id: "revision-dvr",
    icon: AlertTriangle,
    titulo: "Revisión de novedad DVR",
    descripcion: "Los 6 pasos para procesar una novedad: desde que ingresa la DVR a Colfenix hasta que se genera el informe y la DVR vuelve al vehículo.",
    permiso: "vista.novedades",
    necesitaEjemplo: true,
    obtenerRuta: (novedadEjemplo) => `/novedades/${novedadEjemplo.id}`,
  },
  {
    id: "configuracion-novedades",
    icon: Clock,
    titulo: "Configuración de novedades",
    descripcion: "Horario laboral, categorías y tipos de informe, dispositivos DVR, caducidad de pila, y los catálogos de motivos de positiva/negativa.",
    permiso: "vista.administracion_novedades",
    necesitaEjemplo: false,
    obtenerRuta: () => "/administracion/sla",
  },
];

const FAQS = [
  {
    pregunta: "¿Qué hago si la pila de la DVR que llegó está vencida?",
    respuesta: "El proceso sigue igual — la pila vencida solo es un aviso, no bloquea nada. Desde ese mismo aviso hay un ícono de reloj para registrar el cambio de pila ahí mismo, o puedes hacerlo desde Administración → Configuración de novedades → Dispositivos DVR.",
  },
  {
    pregunta: "¿Por qué no puedo marcar \"En revisión\" o \"Terminado\" en una novedad?",
    respuesta: "Los pasos del flujo son secuenciales: primero indica qué máquina DVR llegó (paso 2), luego marca en revisión (paso 3), y recién ahí puedes tomar la decisión Positiva/Negativa (paso 4), que marca Terminado automáticamente.",
  },
  {
    pregunta: "¿Cómo genero el informe de una novedad?",
    respuesta: "Una vez tomada la decisión (paso 4), en el paso 5 (\"Informe generado\") aparece el botón \"Generar informe\".",
  },
  {
    pregunta: "¿Dónde registro que la DVR salió de Colfenix?",
    respuesta: "En el paso 6, una vez el informe ya fue generado — antes de eso el paso aparece bloqueado.",
  },
  {
    pregunta: "¿Cómo agrego un dispositivo DVR nuevo o cambio cada cuántos meses se debe cambiar la pila?",
    respuesta: "Desde Administración → Configuración de novedades, en las tarjetas \"Dispositivos DVR\" y \"Caducidad de pila de la DVR\".",
  },
  {
    pregunta: "¿Puedo volver a ver un recorrido guiado después de la primera vez?",
    respuesta: "Sí, cuando quieras, desde esta misma pantalla de Manual de uso.",
  },
];

function FaqItem({ pregunta, respuesta }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%",
          background: "none", border: "none", cursor: "pointer", padding: "14px 0", textAlign: "left",
          fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)",
        }}
      >
        {pregunta}
        {open ? <ChevronUp size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : <ChevronDown size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
      </button>
      {open && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 14px" }}>{respuesta}</p>
      )}
    </div>
  );
}

export default function ManualPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // undefined = cargando, null = no hay ninguna novedad disponible para el recorrido.
  const [novedadEjemplo, setNovedadEjemplo] = useState(undefined);

  useEffect(() => {
    if (!tienePermiso(user, "vista.novedades")) {
      setNovedadEjemplo(null);
      return;
    }
    let cancelado = false;
    fetch(`${API_BASE}/api/novedades/`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelado) setNovedadEjemplo(data[0] || null); })
      .catch(() => { if (!cancelado) setNovedadEjemplo(null); });
    return () => { cancelado = true; };
  }, [user]);

  const disponible = (m) => (m.necesitaEjemplo ? !!novedadEjemplo : true);

  const verEnVivo = (manual) => {
    if (!disponible(manual)) return;
    navigate(manual.obtenerRuta(novedadEjemplo), { state: { iniciarTour: true, volverA: "/manual" } });
  };

  const manualesVisibles = MANUALES.filter((m) => !m.permiso || tienePermiso(user, m.permiso));

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <div className="hero-eyebrow">Ayuda</div>
          <h2 className="hero-title">Manual de uso</h2>
          <p className="hero-text">
            Recorridos guiados sobre pantallas reales de la aplicación — elige un tema y velo explicado paso a paso,
            en vivo, sobre datos reales. Al terminar el recorrido vuelves acá.
          </p>
        </div>
      </div>

      {manualesVisibles.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>
          No hay manuales disponibles para tu usuario todavía.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {manualesVisibles.map((m) => (
            <div key={m.id} className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: "var(--radius-sm)",
                  background: "var(--accent-glow)", color: "var(--accent-primary)", flexShrink: 0,
                }}>
                  <m.icon size={17} />
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{m.titulo}</span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>{m.descripcion}</p>
              <button className="btn btn-primary" onClick={() => verEnVivo(m)} disabled={!disponible(m)}>
                <PlayCircle size={14} />
                {m.necesitaEjemplo && novedadEjemplo === undefined
                  ? "Cargando..."
                  : disponible(m)
                    ? "Ver en vivo"
                    : "Sin novedades para mostrar el recorrido"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title"><HelpCircle size={15} /> Preguntas frecuentes</span>
        </div>
        <div>
          {FAQS.map((f) => <FaqItem key={f.pregunta} {...f} />)}
        </div>
      </div>
    </div>
  );
}
