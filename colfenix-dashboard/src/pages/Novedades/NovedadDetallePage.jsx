import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ExcelJS from "exceljs";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
  ArrowLeft, Truck, User, MapPin, Hash, Paperclip, Upload,
  CheckCircle2, XCircle, Clock, Save, HardDrive, LogOut, FileCheck, Lock,
  Download, FileDown, SlidersHorizontal, AlertTriangle, Plus, X,
} from "lucide-react";
import { API_BASE } from "../../config/api";
import { getCsrfToken } from "../../utils/csrf";
import { formatFecha, formatFechaHora } from "../../utils/helpers";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { tienePermiso } from "../../utils/permisos";

// Recorrido guiado (Driver.js) del flujo de revisión DVR -- se dispara "en
// vivo" desde una tarjeta de /manual (ManualPage.jsx), que navega acá con
// location.state = { iniciarTour: true, volverA: "/manual" }. Los `element`
// apuntan a ids puestos a propósito en Ficha, FlujoWizard, cada PasoSeccion y
// Trazabilidad; el texto reutiliza las mismas descripciones que ya explican
// cada paso en pantalla, para no mantener el mismo contenido en dos lugares
// con redacciones distintas. `onFinish` se llama al cerrar el recorrido
// (Listo, X o Escape) -- así quien lo abrió desde el manual vuelve ahí, en
// vez de quedar varado en una novedad real cualquiera.
function iniciarTourRevisionDVR(onFinish) {
  const recorrido = driver({
    showProgress: true,
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Listo",
    onDestroyed: onFinish,
    steps: [
      {
        element: "#tour-ficha",
        popover: { title: "Ficha del caso", description: "Resumen rápido: cliente, vehículo, dispositivo DVR y las fechas clave de la novedad." },
      },
      {
        element: "#tour-flujo-wizard",
        popover: { title: "Flujo del caso", description: "Los 6 pasos de la revisión de un vistazo -- en verde los que ya completaste, resaltado el paso actual." },
      },
      {
        element: "#tour-paso-1",
        popover: { title: "1. Novedad registrada", description: "Se creó el caso en el sistema y quedó a la espera de que la DVR física llegue a Colfenix." },
      },
      {
        element: "#tour-paso-2",
        popover: { title: "2. DVR ingresó", description: "El vehículo tiene 2 DVR físicas -- indica cuál de las 2 (Máquina 1 o 2) llegó a Colfenix para revisión. Si la pila de esa máquina está vencida, acá mismo se avisa y se puede registrar el cambio." },
      },
      {
        element: "#tour-paso-3",
        popover: { title: "3. En revisión", description: "Confirma que ya empezaste a revisar físicamente la grabación de la DVR. Acá también se adjunta la evidencia del caso." },
      },
      {
        element: "#tour-paso-4",
        popover: { title: "4. Decisión tomada", description: "Registra si la revisión fue Positiva (sí hay grabación) o Negativa (no hay), con el motivo correspondiente." },
      },
      {
        element: "#tour-paso-5",
        popover: { title: "5. Informe generado", description: "Con la decisión ya tomada, genera el informe formal que se entrega al cliente con los hallazgos de la revisión." },
      },
      {
        element: "#tour-paso-6",
        popover: { title: "6. DVR salió de Colfenix", description: "Ya con el informe generado, registra la fecha en que la DVR física salió de Colfenix de vuelta al vehículo." },
      },
      {
        element: "#tour-trazabilidad",
        popover: { title: "Trazabilidad", description: "Historial completo de cada cambio (quién, cuándo, qué), exportable a Excel." },
      },
    ],
  });
  recorrido.drive();
}

const ORDEN_ESTADO_DD = ["PENDIENTE_DD", "ENCOLADO", "EN_REVISION", "TERMINADO"];

function Ficha({ novedad }) {
  const campos = [
    { icon: Hash, label: "Código", value: novedad.codigo_novedad },
    { icon: User, label: "Cliente", value: novedad.cliente },
    { icon: Paperclip, label: "Tipo informe", value: novedad.categoria_informe ? `${novedad.categoria_informe} · ${novedad.tipo_informe}` : novedad.tipo_informe },
    { icon: Truck, label: "Vehículo", value: `${novedad.vehiculo} · ${novedad.numero_interno}` },
    { icon: HardDrive, label: "Dispositivo DVR", value: novedad.dispositivo_dvr },
    { icon: HardDrive, label: "Ingreso DVR", value: novedad.fecha_ingreso_dvr ? formatFechaHora(novedad.fecha_ingreso_dvr) : null },
    { icon: LogOut, label: "Salida DVR", value: novedad.fecha_salida_dvr },
    { icon: User, label: "Conductor", value: novedad.conductor },
    { icon: MapPin, label: "Ruta", value: novedad.ruta },
  ];
  return (
    <div id="tour-ficha" className="card">
      <div className="grid-3" style={{ gap: 12 }}>
        {campos.map((c) => (
          <div key={c.label} style={{
            display: "flex", gap: 10, padding: "10px 12px",
            background: "var(--bg-surface)", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}>
            <c.icon size={14} color="var(--accent-primary)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }} title={c.value}>
                {c.value || "—"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Resumen macro del caso completo -- de solo lectura, calculado a partir de
// datos que ya vienen en `novedad` (sin estado propio en backend). El
// control real de cada paso vive en las PasoSeccion de abajo (IngresoDVR,
// EnRevision, DecisionRevision, InformeCard, SalidaDVR); esto es solo el "mapa".
function calcularPasosFlujo(novedad) {
  return [
    { key: "registrada", label: "Registrada", icon: Hash, done: true },
    { key: "dvr_ingreso", label: "DVR ingresó", icon: HardDrive, done: !!novedad.dispositivo_dvr_id },
    { key: "revision", label: "En revisión", icon: Clock, done: ["EN_REVISION", "TERMINADO"].includes(novedad.estado_dd) },
    { key: "decision", label: "Decisión tomada", icon: CheckCircle2, done: !!novedad.respuesta_novedad },
    { key: "informe", label: "Informe generado", icon: FileCheck, done: !!novedad.tiene_informe },
    { key: "salida_dvr", label: "DVR salió", icon: LogOut, done: !!novedad.fecha_salida_dvr },
  ];
}

function FlujoWizard({ pasos }) {
  const primerPendiente = pasos.findIndex((p) => !p.done);
  const current = primerPendiente === -1 ? pasos.length - 1 : primerPendiente;

  return (
    <div id="tour-flujo-wizard" className="card">
      <div className="card-header"><span className="card-title">Flujo del caso</span></div>
      <div style={{ display: "flex" }}>
        {pasos.map((paso, i) => {
          const isCurrent = i === current && !paso.done;
          return (
            <div key={paso.key} style={{ flex: 1, position: "relative", padding: "0 4px", textAlign: "center" }}>
              {i > 0 && (
                <span style={{
                  position: "absolute", top: 15, left: "-50%", right: "50%", height: 2,
                  background: pasos[i - 1].done ? "var(--accent-success)" : "var(--border)",
                }} />
              )}
              <div style={{
                width: 30, height: 30, borderRadius: "50%", margin: "0 auto 6px", position: "relative", zIndex: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: paso.done ? "var(--accent-success)" : isCurrent ? "var(--accent-primary)" : "var(--bg-surface)",
                border: `2px solid ${paso.done ? "var(--accent-success)" : isCurrent ? "var(--accent-primary)" : "var(--border)"}`,
                boxShadow: isCurrent ? "0 0 0 4px var(--accent-glow)" : "none",
              }}>
                <paso.icon size={14} color={paso.done || isCurrent ? "#fff" : "var(--text-muted)"} />
              </div>
              <div style={{
                fontSize: 11, fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? "var(--accent-primary)" : paso.done ? "var(--text-primary)" : "var(--text-muted)",
              }}>
                {paso.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Contenedor numerado que usan todos los pasos del flujo (2 a 6) para verse
// como una secuencia real: "hecho" (verde), "actual" (el único accionable,
// azul) o "bloqueado" (atenuado, sin controles, solo el candado) -- así toda
// la pantalla queda ordenada de arriba a abajo, no solo la barra de arriba.
function PasoSeccion({ numero, titulo, descripcion, estado, children }) {
  const bloqueado = estado === "bloqueado";
  return (
    <div id={`tour-paso-${numero}`} className="card" style={{ opacity: bloqueado ? 0.6 : 1 }}>
      <div className="card-header" style={{ alignItems: "flex-start" }}>
        <span style={{ display: "flex", gap: 10, minWidth: 0 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: "50%", fontSize: 11, fontWeight: 700, flexShrink: 0,
            background: estado === "hecho" ? "var(--accent-success)" : estado === "actual" ? "var(--accent-primary)" : "var(--bg-surface)",
            color: bloqueado ? "var(--text-muted)" : "#fff",
            border: bloqueado ? "2px solid var(--border)" : "none",
            marginTop: 1,
          }}>
            {estado === "hecho" ? <CheckCircle2 size={13} /> : numero}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span className="card-title" style={{ marginBottom: 0 }}>{titulo}</span>
            {descripcion && (
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 400 }}>{descripcion}</span>
            )}
          </span>
        </span>
        {estado === "actual" && (
          <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)", flexShrink: 0 }}>
            Paso actual
          </span>
        )}
      </div>
      {bloqueado ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
          <Lock size={13} /> Completa el paso anterior para continuar.
        </div>
      ) : children}
    </div>
  );
}

// Estado de la pila de cada dispositivo -- lo calcula el backend
// (apps.Vehiculo.pila.calcular_estado_pila) contra la caducidad configurada
// en Administración › Configuración SLA › Caducidad de pila de la DVR.
const PILA_ESTADO_INFO = {
  vencida: { label: "Pila vencida -- cambio urgente", sufijo: "⚠ pila vencida", color: "var(--accent-danger)", bg: "var(--accent-danger-soft)" },
  por_vencer: { label: "Pila por vencer", sufijo: "⚠ pila por vencer", color: "var(--accent-warn)", bg: "var(--accent-warn-soft)" },
  vigente: { label: "Pila vigente", sufijo: null, color: "var(--accent-success)", bg: "var(--accent-success-soft)" },
  sin_registro: { label: "Sin registro de cambio de pila", sufijo: null, color: "var(--text-muted)", bg: "var(--bg-surface)" },
};

// Ícono de reloj que abre el selector de fecha nativo y, al elegir una
// fecha, registra el cambio de pila de una sola vez -- acceso rápido para
// cuando la pila aparece vencida, sin salir del flujo hacia Administración.
function BotonCambioPila({ dispositivoId, onRegistrar }) {
  const inputRef = useRef(null);
  const [guardando, setGuardando] = useState(false);

  const abrirSelector = () => {
    if (guardando) return;
    if (inputRef.current?.showPicker) inputRef.current.showPicker();
    else inputRef.current?.click();
  };

  const onChange = async (e) => {
    const fecha = e.target.value;
    if (!fecha) return;
    setGuardando(true);
    try {
      await onRegistrar(dispositivoId, fecha);
    } finally {
      setGuardando(false);
      e.target.value = "";
    }
  };

  return (
    <span style={{ position: "relative", display: "inline-flex", marginLeft: 6 }}>
      <button
        type="button"
        onClick={abrirSelector}
        disabled={guardando}
        title="Registrar cambio de pila"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 18, height: 18, borderRadius: "50%", border: "none",
          cursor: guardando ? "default" : "pointer", background: "rgba(255,255,255,0.35)", color: "inherit",
          flexShrink: 0, padding: 0,
        }}
      >
        <Clock size={11} />
      </button>
      <input
        ref={inputRef}
        type="date"
        onChange={onChange}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
      />
    </span>
  );
}

// Contenido del paso "DVR ingresó" -- sin card propia, vive dentro de
// PasoSeccion. Elegir una máquina marca ENCOLADO solo (ver
// handleDispositivoDvr en el componente principal).
function IngresoDVR({ dispositivoDvrId, dispositivosDisponibles, onDispositivoDvr, fechaIngreso, onRegistrarCambioPila, disabled }) {
  const seleccionado = dispositivosDisponibles.find((d) => d.id === dispositivoDvrId);
  const estadoPila = seleccionado && PILA_ESTADO_INFO[seleccionado.estado];

  return (
    <>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">¿Qué máquina llegó a revisión?</label>
        {dispositivosDisponibles.length > 0 ? (
          <select
            className="form-input"
            value={dispositivoDvrId ?? ""}
            onChange={(e) => onDispositivoDvr(e.target.value ? Number(e.target.value) : null)}
            disabled={disabled}
          >
            <option value="">Sin especificar</option>
            {dispositivosDisponibles.map((d) => {
              const info = PILA_ESTADO_INFO[d.estado];
              return (
                <option key={d.id} value={d.id}>
                  {d.label}{info?.sufijo ? ` -- ${info.sufijo}` : ""}
                </option>
              );
            })}
          </select>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            No hay dispositivos DVR registrados para este vehículo.
          </div>
        )}
      </div>
      {estadoPila && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 10,
            padding: "6px 10px",
            borderRadius: "var(--radius-sm)",
            background: estadoPila.bg,
            color: estadoPila.color,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {(seleccionado.estado === "vencida" ||
            seleccionado.estado === "por_vencer") && (
            <AlertTriangle size={13} />
          )}

          {seleccionado.estado === "vencida" && (
            <span>
              {estadoPila.label}: se venció el <strong>{formatFecha(seleccionado.proxima_fecha)}</strong>
              {" "}(hace <strong>{seleccionado.dias_vencida} días</strong>).
              <BotonCambioPila dispositivoId={seleccionado.id} onRegistrar={onRegistrarCambioPila} />
            </span>
          )}

          {seleccionado.estado === "por_vencer" && (
            <span>
              {estadoPila.label}: vence el <strong>{formatFecha(seleccionado.proxima_fecha)}</strong>
              {" "}(en <strong>{seleccionado.dias_restantes} días</strong>). Último cambio de pila:{" "}
              {formatFecha(seleccionado.fecha_ultimo_cambio_pila)}.
            </span>
          )}

          {seleccionado.estado === "vigente" && (
            <span>
              {estadoPila.label} hasta el <strong>{formatFecha(seleccionado.proxima_fecha)}</strong>
              {" "}(<strong>{seleccionado.dias_restantes} días</strong>).
            </span>
          )}

          {seleccionado.estado === "sin_registro" && (
            <span>{estadoPila.label}.</span>
          )}
        </div>
      )}
      {fechaIngreso && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
          Ingresó a Colfenix: {formatFechaHora(fechaIngreso)} -- quedó marcado ENCOLADO automáticamente.
        </div>
      )}
    </>
  );
}

// Contenido del paso "En revisión" -- una sola acción: el analista confirma
// que empezó a revisar la DVR físicamente. TERMINADO ya no se marca acá, se
// deriva solo al tomar la decisión (ver handleRespuesta).
function EnRevision({ estadoDD, fechaInicioRevision, onMarcarEnRevision, disabled }) {
  const yaEnRevision = estadoDD === "EN_REVISION" || estadoDD === "TERMINADO";
  return yaEnRevision ? (
    <div style={{ fontSize: 13, color: "var(--accent-success)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
      <CheckCircle2 size={15} /> En revisión{fechaInicioRevision ? ` desde ${formatFechaHora(fechaInicioRevision)}` : ""}
    </div>
  ) : (
    <button className="btn btn-primary btn-sm" onClick={onMarcarEnRevision} disabled={disabled}>
      <Clock size={13} /> Marcar en revisión
    </button>
  );
}

// Select de motivo (Positiva/Negativa) que además permite agregar una
// opción nueva ahí mismo si el catálogo no cubre el caso -- abierto a
// cualquier usuario que pueda editar la revisión, sin necesitar ningún
// permiso de administración (el backend lo respalda: crear un motivo nuevo
// desde acá no requiere administracion.gestionar_novedades).
function MotivoCombobox({ value, options, onSeleccionar, onCrearNuevo, placeholder, emptyLabel, disabled }) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [creando, setCreando] = useState(false);
  const ref = useRef(null);

  const seleccionado = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) setTexto(seleccionado ? seleccionado.label : "");
  }, [value, options]); // eslint-disable-line

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const textoNorm = texto.trim().toLowerCase();
  const filtradas = textoNorm ? options.filter((o) => o.label.toLowerCase().includes(textoNorm)) : options;
  const coincideExacto = options.some((o) => o.label.toLowerCase() === textoNorm);
  const puedeCrear = !!textoNorm && !coincideExacto;

  const elegir = (id, label) => {
    onSeleccionar(id);
    setTexto(label);
    setOpen(false);
  };

  const crear = async () => {
    const nombre = texto.trim();
    if (!nombre || creando) return;
    setCreando(true);
    try {
      const nuevo = await onCrearNuevo(nombre);
      if (nuevo) elegir(nuevo.value, nuevo.label);
    } finally {
      setCreando(false);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        className="form-input"
        placeholder={placeholder}
        value={texto}
        disabled={disabled}
        onChange={(e) => { setTexto(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); setTexto(seleccionado ? seleccionado.label : ""); }}
        autoComplete="off"
      />
      {open && !disabled && (emptyLabel || filtradas.length > 0 || puedeCrear) && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-md, 10px)", padding: "6px 0", maxHeight: 220, overflowY: "auto",
          boxShadow: "0 12px 28px -8px rgba(0,0,0,0.35)",
        }}>
          {emptyLabel && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(null, "")} style={{
              display: "block", width: "100%", textAlign: "left", padding: "7px 12px",
              background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: 13, color: "var(--text-muted)", fontStyle: "italic",
            }}>
              {emptyLabel}
            </button>
          )}
          {filtradas.map((o) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(o.value, o.label)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "7px 12px",
                background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, color: "var(--text-primary)",
              }}
            >
              {o.label}
            </button>
          ))}
          {puedeCrear && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={crear}
              disabled={creando}
              style={{
                display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left",
                padding: "7px 12px", background: "none", border: "none", cursor: creando ? "default" : "pointer",
                fontFamily: "inherit", fontSize: 12.5, color: "var(--accent-primary)", fontWeight: 600,
                borderTop: (filtradas.length > 0 || emptyLabel) ? "1px solid var(--border)" : "none",
              }}
            >
              <Plus size={12} /> {creando ? "Agregando..." : `Agregar "${texto.trim()}" como motivo nuevo`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DecisionRevision({
  respuesta, motivoId, detalle, motivos, onRespuesta, onMotivo, onDetalle,
  motivosPositivos, motivoPositivoId, detallePositivo, onMotivoPositivo, onDetallePositivo,
  onCrearMotivo, onCrearMotivoPositivo,
  disabled,
}) {
  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: respuesta ? 16 : 0 }}>
        <button
          className={`btn ${respuesta === "Positiva" ? "btn-success" : "btn-secondary"}`}
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => onRespuesta("Positiva")}
          disabled={disabled}
        >
          <CheckCircle2 size={15} /> Positiva
        </button>
        <button
          className={`btn ${respuesta === "Negativa" ? "btn-danger" : "btn-secondary"}`}
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => onRespuesta("Negativa")}
          disabled={disabled}
        >
          <XCircle size={15} /> Negativa
        </button>
      </div>

      {respuesta === "Positiva" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Motivo</label>
            <MotivoCombobox
              value={motivoPositivoId}
              options={motivosPositivos}
              onSeleccionar={onMotivoPositivo}
              onCrearNuevo={onCrearMotivoPositivo}
              placeholder="Se encuentran registros de grabación (caso estándar)"
              emptyLabel="Se encuentran registros de grabación (caso estándar)"
              disabled={disabled}
            />
          </div>
          {!!motivoPositivoId && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Detalle del caso</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Ej. La regrabación inició a las 14:32, se alcanzó a extraer el clip de las 13:00 a 13:15 antes de que se sobrescribiera..."
                value={detallePositivo}
                onChange={(e) => onDetallePositivo(e.target.value)}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}

      {respuesta === "Negativa" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Motivo</label>
            <MotivoCombobox
              value={motivoId}
              options={motivos}
              onSeleccionar={onMotivo}
              onCrearNuevo={onCrearMotivo}
              placeholder="Seleccione o escriba un motivo..."
              disabled={disabled}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Detalle del caso</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Ej. Se intentó encender con batería externa sin éxito..."
              value={detalle}
              onChange={(e) => onDetalle(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </>
  );
}

const TRAZA_LABELS = {
  estado_dd: "Estado DD",
  respuesta_novedad: "Respuesta",
  dispositivo_dvr: "Dispositivo DVR",
  fecha_salida_dvr: "Salida de la DVR",
  creacion: "Creación",
};

const COLUMNAS_EXPORT = [
  { key: "fecha", label: "Fecha" },
  { key: "hora", label: "Hora" },
  { key: "campo", label: "Campo" },
  { key: "valor_anterior", label: "Valor anterior" },
  { key: "valor_nuevo", label: "Valor nuevo" },
  { key: "usuario", label: "Usuario" },
  { key: "duracion", label: "Tiempo desde el evento anterior" },
];

// Duración legible (ej. "2h 15m", "1d 4h") a partir de una diferencia en ms.
function formatDuracion(ms) {
  const totalMin = Math.round(ms / 60000);
  const dias = Math.floor(totalMin / 1440);
  const horas = Math.floor((totalMin % 1440) / 60);
  const minutos = totalMin % 60;
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${minutos}m`;
  return `${Math.max(1, minutos)}m`;
}

// Umbral genérico de "esto se está demorando" para el ritmo entre eventos
// consecutivos de la bitácora — no es el SLA formal por tipo de informe
// (ese vive en PanelSLA), es solo una señal visual rápida dentro del propio
// historial para detectar pasos que tardaron más de lo normal.
function nivelDemora(deltaMs) {
  const horas = deltaMs / 3_600_000;
  if (horas > 24) return "alerta";
  if (horas > 8) return "atencion";
  return "normal";
}

// Umbral propio (en días, no horas) para el primer tramo del historial —
// creación de la novedad hasta el primer cambio real (normalmente ENCOLADO)
// — porque esa espera depende de cuándo llega la DVR física, no del ritmo
// de trabajo del analista, y "unos días" ahí es normal, no una alerta.
function nivelEsperaDD(deltaMs) {
  const dias = deltaMs / (3_600_000 * 24);
  if (dias > 7) return "alerta";
  if (dias > 3) return "atencion";
  return "normal";
}

// Ancho de columna / tipo de dato por clave -- ExcelJS necesita esto
// aparte, ya que COLUMNAS_EXPORT solo define la etiqueta visible en el
// selector de columnas (compartido con la vista en pantalla).
const COLUMNA_XLSX = {
  fecha: { width: 13, tipo: "fecha" },
  hora: { width: 11, tipo: "texto" },
  campo: { width: 16, tipo: "texto" },
  valor_anterior: { width: 24, tipo: "texto" },
  valor_nuevo: { width: 24, tipo: "texto" },
  usuario: { width: 22, tipo: "texto" },
  duracion: { width: 32, tipo: "texto" },
};

const NIVEL_FILL_XLSX = {
  alerta: "FFFEE2E2",
  atencion: "FFFEF3C7",
};
const NIVEL_FONT_XLSX = {
  alerta: "FF991B1B",
  atencion: "FF92400E",
};

async function exportarTrazabilidadXLSX(eventosConDelta, columnasVisibles, novedad) {
  const columnas = COLUMNAS_EXPORT.filter((c) => columnasVisibles[c.key]);
  const codigoNovedad = novedad.codigo_novedad || "novedad";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Colfenix GPS";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Trazabilidad", {
    views: [{ state: "frozen", ySplit: 5 }],
  });
  hoja.columns = columnas.map((c) => ({ key: c.key, width: COLUMNA_XLSX[c.key]?.width || 18 }));

  // --- Bloque de encabezado (título + metadata de la novedad) ---
  hoja.mergeCells(1, 1, 1, columnas.length);
  const celdaTitulo = hoja.getCell(1, 1);
  celdaTitulo.value = `Trazabilidad — ${codigoNovedad}`;
  celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };

  hoja.mergeCells(2, 1, 2, columnas.length);
  const celdaMeta = hoja.getCell(2, 1);
  celdaMeta.value = `Cliente: ${novedad.cliente || "—"}   ·   Vehículo: ${novedad.vehiculo || "—"}   ·   Analista: ${novedad.analista || "—"}`;
  celdaMeta.font = { size: 10.5, color: { argb: "FF475569" } };

  hoja.mergeCells(3, 1, 3, columnas.length);
  const celdaExportado = hoja.getCell(3, 1);
  celdaExportado.value = `Exportado: ${new Date().toLocaleString("es-CO")}`;
  celdaExportado.font = { size: 9.5, italic: true, color: { argb: "FF94A3B8" } };

  // --- Encabezado de la tabla ---
  const filaEncabezado = hoja.getRow(5);
  columnas.forEach((c, i) => {
    const celda = filaEncabezado.getCell(i + 1);
    celda.value = c.label;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F8CFF" } };
    celda.alignment = { vertical: "middle", horizontal: "left" };
    celda.border = { bottom: { style: "thin", color: { argb: "FF2563EB" } } };
  });
  filaEncabezado.height = 20;
  hoja.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: columnas.length } };

  // --- Filas de datos ---
  eventosConDelta.forEach((ev) => {
    const fechaObj = new Date(ev.creado);
    const duracionTexto = ev.deltaMs != null
      ? `${ev.esEsperaDD ? "Espera DVR: " : "+"}${formatDuracion(ev.deltaMs)}`
      : "—";
    const valores = {
      fecha: fechaObj,
      hora: fechaObj.toLocaleTimeString("es-CO", { hour12: false }),
      campo: TRAZA_LABELS[ev.campo] || ev.campo,
      valor_anterior: ev.valor_anterior || "—",
      valor_nuevo: ev.valor_nuevo || "—",
      usuario: ev.usuario || "Sistema",
      duracion: duracionTexto,
    };

    const fila = hoja.addRow(columnas.map((c) => valores[c.key]));
    fila.eachCell((celda, colNumero) => {
      const clave = columnas[colNumero - 1].key;
      celda.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
      if (clave === "fecha") celda.numFmt = "dd/mm/yyyy";
      // Resalta la fila igual que el punto de color en la línea de tiempo en
      // pantalla: alerta (rojo) / atención (ámbar) cuando un tramo tardó más
      // de lo normal, para que salte a la vista también en Excel.
      if (ev.nivel && NIVEL_FILL_XLSX[ev.nivel]) {
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NIVEL_FILL_XLSX[ev.nivel] } };
        celda.font = { ...(celda.font || {}), color: { argb: NIVEL_FONT_XLSX[ev.nivel] } };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `trazabilidad_${codigoNovedad}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

function SelectorColumnasExport({ visibles, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn btn-sm btn-secondary" onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal size={12} /> Columnas
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)", padding: "8px 0", minWidth: 230,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {COLUMNAS_EXPORT.map((col) => (
            <label key={col.key} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "6px 14px", cursor: "pointer",
              background: visibles[col.key] ? "var(--accent-glow)" : "transparent",
            }}>
              <input
                type="checkbox"
                checked={!!visibles[col.key]}
                onChange={() => onToggle(col.key)}
                style={{ accentColor: "var(--accent-primary)", width: 14, height: 14 }}
              />
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const NIVEL_COLOR = {
  alerta: "var(--accent-danger)",
  atencion: "var(--accent-warn)",
  normal: "var(--text-muted)",
};
const NIVEL_BG = {
  alerta: "var(--accent-danger-soft)",
  atencion: "var(--accent-warn-soft)",
  normal: "var(--bg-surface)",
};

function Trazabilidad({ novedad, eventos, puedeExportar }) {
  const [columnasVisibles, setColumnasVisibles] = useState(() =>
    Object.fromEntries(COLUMNAS_EXPORT.map((c) => [c.key, true]))
  );
  const [exportando, setExportando] = useState(false);

  const toggleColumna = (key) => setColumnasVisibles((prev) => ({ ...prev, [key]: !prev[key] }));

  // El historial arranca desde que se creó la novedad (no desde el primer
  // cambio de estado_dd): las novedades llegan por correo y se registran de
  // inmediato, pero la DVR física puede tardar días en llegar — ese primer
  // tramo (creación -> primer cambio real) es justo lo que se quiere ver
  // reflejado en la trazabilidad, no solo el SLA formal de revisión.
  const eventoCreacion = {
    id: "creacion",
    campo: "creacion",
    valor_anterior: null,
    valor_nuevo: "Registrada",
    usuario: novedad.analista,
    creado: novedad.fecha_creacion,
    esCreacion: true,
  };
  const linea = [eventoCreacion, ...eventos];

  // Cada evento con el tiempo transcurrido desde el anterior: el primer
  // tramo (espera de la DVR) usa umbrales en días; el resto (ritmo de
  // revisión entre analistas) usa los umbrales en horas de siempre.
  const eventosConDelta = linea.map((ev, i) => {
    if (i === 0) return { ...ev, deltaMs: null, nivel: null };
    const anterior = linea[i - 1];
    const deltaMs = new Date(ev.creado) - new Date(anterior.creado);
    const esEsperaDD = !!anterior.esCreacion;
    return { ...ev, deltaMs, esEsperaDD, nivel: esEsperaDD ? nivelEsperaDD(deltaMs) : nivelDemora(deltaMs) };
  });

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarTrazabilidadXLSX(eventosConDelta, columnasVisibles, novedad);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div id="tour-trazabilidad" className="card">
      <div className="card-header">
        <span className="card-title"><Clock size={15} /> Trazabilidad</span>
        <div style={{ display: "flex", gap: 6 }}>
          {puedeExportar && (
            <>
              <SelectorColumnasExport visibles={columnasVisibles} onToggle={toggleColumna} />
              <button
                className="btn btn-sm btn-secondary"
                onClick={exportar}
                disabled={exportando}
              >
                <Download size={12} /> {exportando ? "Generando..." : "Exportar Excel"}
              </button>
              <button className="btn btn-sm btn-secondary" title="Próximamente">
                <FileDown size={12} /> Exportar PDF
              </button>
            </>
          )}
        </div>
      </div>
      <div style={{ position: "relative", paddingLeft: 22 }}>
        <span style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: 2, background: "var(--border)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {eventosConDelta.map((ev) => (
            <div key={ev.id} style={{ position: "relative", fontSize: 12.5 }}>
              <span style={{
                position: "absolute", left: -22, top: 3, width: 10, height: 10, borderRadius: "50%",
                background: ev.nivel ? NIVEL_COLOR[ev.nivel] : "var(--accent-primary)",
                border: "2px solid var(--bg-card)",
              }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                <span style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                  {formatFechaHora(ev.creado)}
                </span>
                {ev.deltaMs != null && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700,
                    padding: "1px 7px", borderRadius: 99,
                    background: NIVEL_BG[ev.nivel], color: NIVEL_COLOR[ev.nivel],
                  }}>
                    {ev.nivel === "alerta" && <AlertTriangle size={10} />}
                    {ev.esEsperaDD ? "Espera DVR: " : "+"}{formatDuracion(ev.deltaMs)}
                  </span>
                )}
              </div>
              {ev.esCreacion ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  {ev.usuario || "Sistema"} registró la novedad <b style={{ color: "var(--text-primary)" }}>{novedad.codigo_novedad}</b>
                </div>
              ) : (
                <div style={{ color: "var(--text-secondary)" }}>
                  {ev.usuario || "Sistema"} cambió <b style={{ color: "var(--text-primary)" }}>{TRAZA_LABELS[ev.campo] || ev.campo}</b> de "{ev.valor_anterior || "—"}" a "{ev.valor_nuevo || "—"}"
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SLA_COLOR = {
  A_TIEMPO: "var(--accent-success)",
  FINALIZADO_A_TIEMPO: "var(--accent-success)",
  EN_RIESGO: "var(--accent-warn)",
  VENCIDO: "var(--accent-danger)",
  FINALIZADO_FUERA_DE_TIEMPO: "var(--accent-danger)",
};

const SLA_BG = {
  A_TIEMPO: "var(--accent-success-soft)",
  FINALIZADO_A_TIEMPO: "var(--accent-success-soft)",
  EN_RIESGO: "var(--accent-warn-soft)",
  VENCIDO: "var(--accent-danger-soft)",
  FINALIZADO_FUERA_DE_TIEMPO: "var(--accent-danger-soft)",
};

const ESPERA_COLOR = { alerta: "var(--accent-danger)", atencion: "var(--accent-warn)", normal: "var(--accent-success)" };
const ESPERA_BG = { alerta: "var(--accent-danger-soft)", atencion: "var(--accent-warn-soft)", normal: "var(--accent-success-soft)" };
const ESPERA_LABEL = { alerta: "Demora prolongada", atencion: "Demorando", normal: "En tiempo normal" };

// Distinto del SLA de revisión (PanelSLA, que solo corre ENCOLADO -> TERMINADO):
// las novedades llegan por correo y se registran de inmediato, pero la DVR
// física puede tardar varios días en llegar. Este panel mide justamente esa
// espera — desde que se creó la novedad hasta que quedó ENCOLADA.
function PanelEsperaDD({ novedad }) {
  const nivel = novedad.nivel_espera_dd;
  const color = ESPERA_COLOR[nivel] || "var(--text-muted)";
  const bg = ESPERA_BG[nivel] || "var(--accent-glow)";
  const horas = novedad.horas_espera_dd ?? 0;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><Truck size={15} /> Espera de la DVR</span>
        <span className="badge" style={{ background: bg, color }}>
          {novedad.en_espera_dd ? ESPERA_LABEL[nivel] : "Ya llegó"}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>
        {novedad.en_espera_dd
          ? "Tiempo transcurrido desde que se registró la novedad, mientras se espera que la DVR llegue y quede ENCOLADA."
          : "Tiempo que tardó la DVR en llegar: desde que se registró la novedad hasta que quedó ENCOLADA."}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: novedad.en_espera_dd ? color : "var(--text-primary)" }}>
        {formatDuracion(horas * 3_600_000)}
      </div>
    </div>
  );
}

function PanelSLA({ novedad }) {
  const estado = novedad.sla_estado;

  if (estado === "SIN_SLA" || estado === "SIN_INICIAR") {
    return (
      <div className="card">
        <div className="card-header"><span className="card-title"><Clock size={15} /> Tiempo de revisión (SLA)</span></div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {estado === "SIN_SLA"
            ? "Este tipo de informe no tiene un tiempo máximo configurado."
            : "El conteo iniciará cuando el estado pase a ENCOLADO."}
        </div>
      </div>
    );
  }

  const color = SLA_COLOR[estado] || "var(--accent-primary)";
  const bg = SLA_BG[estado] || "var(--accent-glow)";
  const transcurridas = novedad.sla_horas_transcurridas ?? 0;
  const limite = novedad.sla_horas;
  const pct = limite ? Math.min(100, (transcurridas / limite) * 100) : 0;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><Clock size={15} /> Tiempo de revisión (SLA)</span>
        <span className="badge" style={{ background: bg, color }}>
          {novedad.sla_estado_display}
        </span>
      </div>
      <div className="grid-3" style={{ gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
            Transcurridas
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{transcurridas}h</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
            Límite
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{limite}h</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
            {novedad.sla_horas_restantes != null && novedad.sla_horas_restantes < 0 ? "Vencida por" : "Restantes"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color }}>
            {novedad.sla_horas_restantes != null ? `${Math.abs(novedad.sla_horas_restantes)}h` : "—"}
          </div>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "var(--bg-surface)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

// Acceso directo al flujo de generación de informe (hoy solo existía desde
// el listado de Novedades) -- misma condición que ya usa NovedadesPage/
// ModalNovedad para habilitar el botón (estado_novedad ya no es
// "Pendiente_por_responder", es decir, ya hay una decisión Positiva/Negativa
// guardada) más el permiso correspondiente.
// Tarjeta de acceso directo al PDF del informe -- el PDF en sí no se guarda
// en el servidor (se genera al vuelo en el navegador desde InformesPage con
// html2pdf), así que esto no es una miniatura real del documento, es un
// atajo: código + resultado + fecha, que al hacer clic abre ese informe
// puntual en Informes (donde ya existe el botón "Descargar PDF").
function InformePoster({ informe, onAbrir }) {
  if (!informe) {
    return (
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.6 }}>
        <FileCheck size={20} color="var(--text-muted)" />
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Aún no hay informe generado.</span>
      </div>
    );
  }
  const positivo = informe.resultado === "Positiva";
  return (
    <button
      onClick={onAbrir}
      className="card"
      style={{
        display: "flex", alignItems: "center", gap: 12, textAlign: "left",
        width: "100%", cursor: "pointer", fontFamily: "inherit",
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: "var(--radius-sm)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: positivo ? "var(--accent-success-soft)" : "var(--accent-danger-soft)",
        color: positivo ? "var(--accent-success)" : "var(--accent-danger)",
      }}>
        <FileCheck size={20} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{informe.codigo}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          {informe.resultado} · {formatFechaHora(informe.fecha_creacion)}
        </div>
      </div>
    </button>
  );
}

// Contenido del paso "Informe generado" -- PasoSeccion ya se encarga de no
// mostrar esto hasta que la decisión (paso anterior) esté tomada, así que
// acá solo falta distinguir generado / falta permiso / listo para generar.
function InformeCard({ novedad, puedeGenerar, onGenerarInforme }) {
  if (novedad.tiene_informe) {
    return (
      <div style={{ fontSize: 13, color: "var(--accent-success)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <CheckCircle2 size={15} /> Informe generado
      </div>
    );
  }
  return puedeGenerar ? (
    <button className="btn btn-primary btn-sm" onClick={onGenerarInforme}>
      <FileCheck size={13} /> Generar informe
    </button>
  ) : (
    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Informe pendiente de generar.</div>
  );
}

// Fecha manual de salida de la DVR de Colfenix -- PasoSeccion ya no la
// muestra hasta que exista un informe generado (el backend también lo
// valida en NovedadDetalleView.post()).
function SalidaDVR({ fechaSalidaDvr, onFechaSalidaDvr, disabled }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">Fecha en que la DVR salió de Colfenix</label>
      <input
        type="date"
        className="form-input"
        value={fechaSalidaDvr || ""}
        onChange={(e) => onFechaSalidaDvr(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function Evidencia({ evidencias, onUpload, subiendo, puedeSubir, onEliminar }) {
  const [eliminandoId, setEliminandoId] = useState(null);

  const eliminar = async (ev) => {
    if (!window.confirm("¿Quitar esta imagen de evidencia?")) return;
    setEliminandoId(ev.id);
    try {
      await onEliminar(ev.id);
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "16px 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
        <Paperclip size={12} /> Evidencia adjunta
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
        {evidencias.map((ev) => (
          <div
            key={ev.id}
            style={{
              aspectRatio: "4 / 3", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)", overflow: "hidden", position: "relative",
              background: "var(--bg-surface)",
            }}
          >
            <a href={`${API_BASE}${ev.archivo}`} target="_blank" rel="noreferrer" style={{ display: "block", width: "100%", height: "100%" }}>
              <img src={`${API_BASE}${ev.archivo}`} alt={ev.descripcion || "Evidencia"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </a>
            {puedeSubir && (
              <button
                type="button"
                title="Quitar imagen"
                onClick={() => eliminar(ev)}
                disabled={eliminandoId === ev.id}
                style={{
                  position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(15, 23, 42, 0.72)", color: "#fff", border: "none",
                  cursor: eliminandoId === ev.id ? "default" : "pointer",
                  opacity: eliminandoId === ev.id ? 0.6 : 1,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {puedeSubir && (
          <label style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
            aspectRatio: "4 / 3", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border)",
            color: "var(--text-muted)", fontSize: 11, cursor: subiendo ? "default" : "pointer",
          }}>
            <Upload size={16} />
            {subiendo ? "Subiendo..." : "Agregar"}
            <input type="file" accept="image/*" style={{ display: "none" }} disabled={subiendo}
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
        )}
      </div>
    </div>
  );
}

export default function NovedadDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const puedeEditar = tienePermiso(user, "novedades.editar");
  const puedeSubirEvidencia = tienePermiso(user, "novedades.subir_evidencia");
  const puedeExportar = tienePermiso(user, "novedades.exportar");
  const puedeGenerarInforme = tienePermiso(user, "novedades.generar_informe");

  const [novedad, setNovedad] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [motivosPositivos, setMotivosPositivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [subiendoEvidencia, setSubiendoEvidencia] = useState(false);
  const [toast, setToast] = useState(null);

  const [estadoDD, setEstadoDD] = useState("PENDIENTE_DD");
  const [respuesta, setRespuesta] = useState(null);
  const [motivoId, setMotivoId] = useState(null);
  const [detalle, setDetalle] = useState("");
  const [motivoPositivoId, setMotivoPositivoId] = useState(null);
  const [detallePositivo, setDetallePositivo] = useState("");
  const [dispositivoDvrId, setDispositivoDvrId] = useState(null);
  const [fechaSalidaDvr, setFechaSalidaDvr] = useState("");

  // Llega desde una tarjeta "Ver en vivo" de /manual (ver ManualPage.jsx):
  // navigate(`/novedades/${id}`, { state: { iniciarTour: true, volverA: "/manual" } }).
  // El `tourIniciadoRef` evita relanzarlo si el componente vuelve a renderizar
  // mientras el usuario ya está viendo el recorrido.
  const tourIniciadoRef = useRef(false);
  useEffect(() => {
    if (!location.state?.iniciarTour || tourIniciadoRef.current || loading || !novedad) return;
    tourIniciadoRef.current = true;
    const volverA = location.state.volverA || "/manual";
    iniciarTourRevisionDVR(() => navigate(volverA));
  }, [location.state, loading, novedad, navigate]);

  const cargarNovedad = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/novedades/${id}/`, { credentials: "include" });
    if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
    const data = await res.json();
    setNovedad(data);
    setEstadoDD(data.estado_dd);
    setRespuesta(data.respuesta_novedad);
    setMotivoId(data.motivo_negativo_id);
    setDetalle(data.detalle_motivo_negativo || "");
    setMotivoPositivoId(data.motivo_positivo_id);
    setDetallePositivo(data.detalle_motivo_positivo || "");
    setDispositivoDvrId(data.dispositivo_dvr_id);
    setFechaSalidaDvr(data.fecha_salida_dvr || "");
  }, [id]);

  const cargarEventos = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/novedades/${id}/eventos/`, { credentials: "include" });
    if (res.ok) setEventos(await res.json());
  }, [id]);

  // Actualiza solo los campos de SLA/estado_dd en vivo, sin tocar el estado
  // editable local (estadoDD, respuesta, motivoId, detalle) — un refresco
  // completo vía cargarNovedad() revertiría cualquier cambio sin guardar del
  // analista en el flujo de pasos (estado DD, decisión, etc.).
  const actualizarSLA = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/novedades/${id}/`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setNovedad((prev) => prev && ({
      ...prev,
      sla_horas: data.sla_horas,
      sla_horas_transcurridas: data.sla_horas_transcurridas,
      sla_horas_restantes: data.sla_horas_restantes,
      sla_estado: data.sla_estado,
      sla_estado_display: data.sla_estado_display,
      horas_espera_dd: data.horas_espera_dd,
      en_espera_dd: data.en_espera_dd,
      nivel_espera_dd: data.nivel_espera_dd,
      estado_dd: data.estado_dd,
    }));
  }, [id]);

  useEffect(() => {
    if (!novedad || novedad.estado_dd === "TERMINADO") return;
    const intervalo = setInterval(() => { actualizarSLA(); cargarEventos(); }, 60000);
    return () => clearInterval(intervalo);
  }, [novedad?.estado_dd, actualizarSLA, cargarEventos]);

  useEffect(() => {
    let cancelado = false;
    async function cargarTodo() {
      setLoading(true);
      setLoadError(null);
      try {
        await Promise.all([
          cargarNovedad(),
          cargarEventos(),
          fetch(`${API_BASE}/api/motivos-negativa/`, { credentials: "include" })
            .then((r) => r.json()).then((data) => { if (!cancelado) setMotivos(data); }),
          fetch(`${API_BASE}/api/motivos-positiva/`, { credentials: "include" })
            .then((r) => r.json()).then((data) => { if (!cancelado) setMotivosPositivos(data); }),
        ]);
      } catch (err) {
        if (!cancelado) setLoadError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    }
    cargarTodo();
    return () => { cancelado = true; };
  }, [cargarNovedad, cargarEventos]);

  // El flujo avanza solo a partir de las decisiones reales del analista, sin
  // pasos manuales redundantes: elegir la máquina que llegó ya implica que
  // la DVR está ENCOLADA, y tomar la decisión (Positiva/Negativa) ya implica
  // que la revisión TERMINÓ. "En revisión" queda como el único paso manual
  // real (botón en EnRevision), porque no hay ningún otro dato que lo derive.
  const avanzarEstadoDD = (minimo) => {
    setEstadoDD((actual) => (
      ORDEN_ESTADO_DD.indexOf(actual) < ORDEN_ESTADO_DD.indexOf(minimo) ? minimo : actual
    ));
  };

  const handleDispositivoDvr = (valor) => {
    setDispositivoDvrId(valor);
    if (valor) avanzarEstadoDD("ENCOLADO");
  };

  const handleRespuesta = (valor) => {
    setRespuesta(valor);
    avanzarEstadoDD("TERMINADO");
  };

  const marcarEnRevision = () => avanzarEstadoDD("EN_REVISION");

  // Acceso rápido desde el botón de reloj en IngresoDVR -- no pasa por
  // handleGuardar, se guarda de inmediato contra el dispositivo puntual y
  // se refresca la novedad para traer el estado de pila ya actualizado.
  const handleRegistrarCambioPila = async (dispositivoId, fecha) => {
    try {
      const res = await fetch(`${API_BASE}/api/dispositivos-dvr/${dispositivoId}/registrar-cambio-pila/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ fecha }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo registrar el cambio de pila");
      await cargarNovedad();
      setToast({ msg: "Cambio de pila registrado", type: "success" });
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
    }
  };

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/novedades/${id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({
          estado_dd: estadoDD,
          respuesta_novedad: respuesta,
          dispositivo_dvr_id: dispositivoDvrId || null,
          fecha_salida_dvr: fechaSalidaDvr || null,
          motivo_negativo_id: respuesta === "Negativa" ? motivoId : null,
          detalle_motivo_negativo: respuesta === "Negativa" ? detalle : "",
          motivo_positivo_id: respuesta === "Positiva" ? motivoPositivoId : null,
          detalle_motivo_positivo: respuesta === "Positiva" ? detallePositivo : "",
        }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo guardar");
      await Promise.all([cargarNovedad(), cargarEventos()]);
      setToast({ msg: "Revisión actualizada", type: "success" });
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (archivo) => {
    setSubiendoEvidencia(true);
    try {
      const form = new FormData();
      form.append("archivo", archivo);
      const res = await fetch(`${API_BASE}/api/novedades/${id}/evidencia/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: form,
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo subir la evidencia");
      await cargarNovedad();
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
    } finally {
      setSubiendoEvidencia(false);
    }
  };

  const handleEliminarEvidencia = async (evidenciaId) => {
    try {
      const res = await fetch(`${API_BASE}/api/novedades/evidencia/${evidenciaId}/eliminar/`, {
        method: "DELETE",
        headers: { "X-CSRFToken": getCsrfToken() },
        credentials: "include",
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo quitar la evidencia");
      setNovedad((prev) => prev && ({ ...prev, evidencias: prev.evidencias.filter((e) => e.id !== evidenciaId) }));
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
    }
  };

  // Agregar un motivo nuevo desde el propio combobox de "Resultado de la
  // revisión" -- abierto a cualquier usuario que pueda editar la revisión,
  // sin permiso de administración (el backend ya no exige
  // administracion.gestionar_novedades para este endpoint puntual).
  const crearMotivo = async (nombre) => {
    try {
      const res = await fetch(`${API_BASE}/api/motivos-negativa/crear/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ nombre }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo agregar el motivo");
      setMotivos((ms) => (ms.some((m) => m.value === resultado.motivo.value) ? ms : [...ms, resultado.motivo]));
      return resultado.motivo;
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
      return null;
    }
  };

  const crearMotivoPositivo = async (nombre) => {
    try {
      const res = await fetch(`${API_BASE}/api/motivos-positiva/crear/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ nombre }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo agregar el motivo");
      setMotivosPositivos((ms) => (ms.some((m) => m.value === resultado.motivo.value) ? ms : [...ms, resultado.motivo]));
      return resultado.motivo;
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
      return null;
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: "var(--text-muted)" }}>Cargando novedad…</div>;
  }

  if (loadError || !novedad) {
    return (
      <div className="card" style={{ color: "var(--accent-danger)" }}>
        No se pudo cargar la novedad: {loadError || "no encontrada"}
      </div>
    );
  }

  // El asistente debe reflejar lo que el usuario ya eligió en pantalla, no
  // solo lo último que se guardó -- si no, el paso siguiente se ve
  // "bloqueado" hasta apretar Guardar cambios, aunque ya se eligió la
  // máquina / se marcó en revisión / se tomó la decisión.
  const novedadEnProgreso = {
    ...novedad,
    dispositivo_dvr_id: dispositivoDvrId,
    estado_dd: estadoDD,
    respuesta_novedad: respuesta,
    fecha_salida_dvr: fechaSalidaDvr,
  };
  const pasosFlujo = calcularPasosFlujo(novedadEnProgreso);
  const estadoPaso = (i) => (
    pasosFlujo[i].done ? "hecho" : pasosFlujo.slice(0, i).every((p) => p.done) ? "actual" : "bloqueado"
  );

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/novedades")} style={{ marginBottom: 10 }}>
            <ArrowLeft size={14} /> Volver a novedades
          </button>
          <div className="hero-eyebrow">Revisión de DVR</div>
          <h2 className="hero-title">{novedad.codigo_novedad}</h2>
        </div>
        {puedeEditar && (
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
              <Save size={15} /> {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}
      </div>

      <Ficha novedad={novedad} />
      <FlujoWizard pasos={pasosFlujo} />

      <div className="grid-2" style={{ alignItems: "start" }}>
        <PasoSeccion
          numero={1}
          titulo="Novedad registrada"
          descripcion="Se creó el caso en el sistema y quedó a la espera de que la DVR física llegue a Colfenix."
          estado="hecho"
        >
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Registrada el {formatFechaHora(novedad.fecha_creacion)} por {novedad.analista}.
          </div>
        </PasoSeccion>

        <PasoSeccion
          numero={2}
          titulo="DVR ingresó"
          descripcion="El vehículo tiene 2 DVR físicas -- indica cuál de las 2 (Máquina 1 o 2) llegó a Colfenix para revisión."
          estado={estadoPaso(1)}
        >
          <IngresoDVR
            dispositivoDvrId={dispositivoDvrId}
            dispositivosDisponibles={novedad.dispositivos_dvr_disponibles || []}
            onDispositivoDvr={handleDispositivoDvr}
            fechaIngreso={novedad.fecha_ingreso_dvr}
            onRegistrarCambioPila={handleRegistrarCambioPila}
            disabled={!puedeEditar}
          />
        </PasoSeccion>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <PanelEsperaDD novedad={novedad} />
        <PanelSLA novedad={novedad} />
      </div>

      <PasoSeccion
        numero={3}
        titulo="En revisión"
        descripcion="Confirma que ya empezaste a revisar físicamente la grabación de la DVR. Acá también se adjunta la evidencia del caso."
        estado={estadoPaso(2)}
      >
        <EnRevision
          estadoDD={estadoDD}
          fechaInicioRevision={novedad.fecha_inicio_revision}
          onMarcarEnRevision={marcarEnRevision}
          disabled={!puedeEditar}
        />
        <Evidencia
          evidencias={novedad.evidencias || []}
          onUpload={handleUpload}
          subiendo={subiendoEvidencia}
          puedeSubir={puedeSubirEvidencia}
          onEliminar={handleEliminarEvidencia}
        />
      </PasoSeccion>

      <PasoSeccion
        numero={4}
        titulo="Decisión tomada"
        descripcion="Registra si la revisión fue Positiva (sí hay grabación) o Negativa (no hay), con el motivo correspondiente."
        estado={estadoPaso(3)}
      >
        <DecisionRevision
          respuesta={respuesta}
          motivoId={motivoId}
          detalle={detalle}
          motivos={motivos}
          onRespuesta={handleRespuesta}
          onMotivo={setMotivoId}
          onDetalle={setDetalle}
          motivosPositivos={motivosPositivos}
          motivoPositivoId={motivoPositivoId}
          detallePositivo={detallePositivo}
          onMotivoPositivo={setMotivoPositivoId}
          onDetallePositivo={setDetallePositivo}
          onCrearMotivo={crearMotivo}
          onCrearMotivoPositivo={crearMotivoPositivo}
          disabled={!puedeEditar}
        />
      </PasoSeccion>

      <PasoSeccion
        numero={5}
        titulo="Informe generado"
        descripcion="Con la decisión ya tomada, genera el informe formal que se entrega al cliente con los hallazgos de la revisión."
        estado={estadoPaso(4)}
      >
        <InformeCard
          novedad={novedad}
          puedeGenerar={puedeGenerarInforme}
          onGenerarInforme={() => navigate("/informes/generar", { state: { novedad } })}
        />
      </PasoSeccion>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <InformePoster
          informe={novedad.informe}
          onAbrir={() => navigate("/informes", { state: { abrirInformeId: novedad.informe?.id } })}
        />
        <PasoSeccion
          numero={6}
          titulo="DVR salió de Colfenix"
          descripcion="Ya con el informe generado, registra la fecha en que la DVR física salió de Colfenix de vuelta al vehículo."
          estado={estadoPaso(5)}
        >
          <SalidaDVR
            fechaSalidaDvr={fechaSalidaDvr}
            onFechaSalidaDvr={setFechaSalidaDvr}
            disabled={!puedeEditar}
          />
        </PasoSeccion>
      </div>

      <Trazabilidad novedad={novedad} eventos={eventos} puedeExportar={puedeExportar} />

      <Evidencia
        evidencias={novedad.evidencias || []}
        onUpload={handleUpload}
        subiendo={subiendoEvidencia}
        puedeSubir={puedeSubirEvidencia}
        onEliminar={handleEliminarEvidencia}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
