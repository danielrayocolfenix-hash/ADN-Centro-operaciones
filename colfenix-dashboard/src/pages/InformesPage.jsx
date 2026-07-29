import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Eye, Printer, Download, CheckCircle2, XCircle,
  Building2, Truck, User, Clock, Scale,
  Search, SortAsc, RefreshCw, Paperclip,
} from "lucide-react";
import { API_BASE } from "../config/api";
import { formatFechaHora } from "../utils/helpers";
import Toast from "../components/ui/Toast";
import DrawerPanel from "../components/ui/DrawerPanel";
import Modal from "../components/ui/Modal";
import InformePreview from "../components/plantillas/InformePreview";

// Compartido entre el drawer de detalle y el modal de vista previa: ambos
// necesitan el mismo documento completo (GET /api/informes/:id/), solo
// cambia cómo lo presentan.
function useInformeDetalle(informeId, toast) {
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!informeId) return undefined;
    let cancelado = false;
    setDetalle(null);
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/informes/${informeId}/`, { credentials: "include" });
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        const data = await res.json();
        if (!cancelado) setDetalle(data);
      } catch (err) {
        toast(`Error cargando el informe: ${err.message}`, "error");
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [informeId]); // eslint-disable-line

  return { detalle, loading };
}

function DetailRow({ label, value }) {
  return (
    <div style={{ padding: "10px 12px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{value || "—"}</div>
    </div>
  );
}

// Sección reutilizable para cada grupo de adjuntos del informe (Logiox,
// mapa del recorrido, capturas de la solicitud, evidencia de cada evento,
// imágenes de negativa) -- cada thumbnail abre el archivo real a tamaño
// completo en una pestaña nueva.
function GaleriaAdjuntos({ titulo, imagenes }) {
  if (!imagenes || imagenes.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 }}>
        {titulo}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
        {imagenes.map((img, i) => (
          <a
            key={img.id ?? i}
            href={`${API_BASE}${img.url}`}
            target="_blank"
            rel="noreferrer"
            title={img.etiqueta || "Ver imagen completa"}
            style={{
              display: "block", aspectRatio: "4 / 3", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)", overflow: "hidden", position: "relative", background: "var(--bg-surface)",
            }}
          >
            <img src={`${API_BASE}${img.url}`} alt={img.etiqueta || "Adjunto"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {img.etiqueta && (
              <span style={{
                position: "absolute", left: 0, right: 0, bottom: 0, padding: "3px 6px",
                background: "rgba(15,23,42,0.72)", color: "#fff", fontSize: 10, lineHeight: 1.3,
              }}>
                {img.etiqueta}
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

function InformeDetalleDrawer({ informeId, onClose, toast }) {
  const { detalle, loading } = useInformeDetalle(informeId, toast);

  const evidenciasEventos = useMemo(() => {
    if (!detalle) return [];
    return detalle.segmentos.flatMap((seg) =>
      seg.eventos.flatMap((ev) =>
        ev.evidencias.map((img) => ({ id: img.id, url: img.imagen, etiqueta: ev.tipo || ev.descripcion || "Evento" }))
      )
    );
  }, [detalle]);

  return (
    <DrawerPanel
      icon={<Eye size={18} />}
      title={detalle ? <>Informe <b>{detalle.codigo}</b></> : "Informe"}
      subtitle={detalle ? `${detalle.novedad.codigo_novedad} · ${detalle.novedad.cliente}` : null}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={() => window.print()} disabled={!detalle}><Printer size={14} /> Imprimir</button>
        </>
      }
    >
      {loading || !detalle ? (
        <div style={{ color: "var(--text-muted)" }}>Cargando…</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <span className="badge" style={{
              background: detalle.resultado === "Positiva" ? "var(--accent-success-soft)" : "var(--accent-danger-soft)",
              color: detalle.resultado === "Positiva" ? "var(--accent-success)" : "var(--accent-danger)",
            }}>
              {detalle.resultado === "Positiva" ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {detalle.resultado}
            </span>
            <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}>{detalle.estado}</span>
            {detalle.tipo_informe && (
              <span className="badge" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>{detalle.tipo_informe}</span>
            )}
            <span className="badge" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>{detalle.version}</span>
          </div>

          <div className="grid-2" style={{ gap: 10, marginBottom: 18 }}>
            <DetailRow label="Novedad" value={detalle.novedad.codigo_novedad} />
            <DetailRow label="Cliente" value={detalle.novedad.cliente} />
            <DetailRow label="Vehículo" value={`${detalle.novedad.vehiculo} · Int. ${detalle.novedad.numero_interno}`} />
            <DetailRow label="Conductor" value={detalle.novedad.conductor} />
            <DetailRow label="Analista" value={detalle.novedad.analista} />
            <DetailRow label="Fecha" value={formatFechaHora(detalle.fecha_creacion)} />
          </div>

          {detalle.titulo && (
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>{detalle.titulo}</div>
          )}

          {detalle.solicitud && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 6 }}>
                Solicitud
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{detalle.solicitud}</div>
            </div>
          )}
          <GaleriaAdjuntos
            titulo="Capturas de la solicitud"
            imagenes={detalle.solicitud_imagenes.map((si) => ({ id: si.id, url: si.imagen }))}
          />

          {detalle.logiox?.imagen && (
            <GaleriaAdjuntos titulo="Logiox (captura)" imagenes={[{ url: detalle.logiox.imagen }]} />
          )}
          {detalle.logiox?.modo === "tabla" && detalle.logiox.tabla?.filas?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 6 }}>
                Logiox (tabla) — {detalle.logiox.tabla.filas.length} {detalle.logiox.tabla.filas.length === 1 ? "fila" : "filas"}
              </div>
            </div>
          )}

          {(detalle.recorrido?.texto_confirmacion || detalle.recorrido?.imagen) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 6 }}>
                Recorrido
              </div>
              {detalle.recorrido.texto_confirmacion && (
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>{detalle.recorrido.texto_confirmacion}</div>
              )}
            </div>
          )}
          <GaleriaAdjuntos titulo="Mapa del recorrido" imagenes={detalle.recorrido?.imagen ? [{ url: detalle.recorrido.imagen }] : []} />

          {detalle.segmentos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 6 }}>
                Segmentos analizados ({detalle.segmentos.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {detalle.segmentos.map((seg) => (
                  <div key={seg.id} style={{ fontSize: 12.5, color: "var(--text-secondary)", padding: "6px 10px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                    <b style={{ color: "var(--text-primary)" }}>Parte {seg.orden}</b>
                    {seg.hora_inicio && seg.hora_fin && <> · {seg.hora_inicio}–{seg.hora_fin}</>}
                    {seg.observacion && <> · {seg.observacion}</>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <GaleriaAdjuntos titulo="Evidencia de eventos" imagenes={evidenciasEventos} />

          {detalle.detalles.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 6 }}>
                Detalle (negativa)
              </div>
              {detalle.detalles.map((d) => (
                <div key={d.id} style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                  <b style={{ color: "var(--text-primary)" }}>{d.titulo}:</b> {d.observacion || "—"}
                </div>
              ))}
            </div>
          )}
          <GaleriaAdjuntos
            titulo="Imágenes de negativa"
            imagenes={detalle.detalles.filter((d) => d.imagen).map((d) => ({ id: d.id, url: d.imagen, etiqueta: d.titulo }))}
          />

          {detalle.mantenimientos_tabla?.filas?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 6 }}>
                Mantenimientos anteriores ({detalle.mantenimientos_tabla.filas.length})
              </div>
            </div>
          )}

          {detalle.anexos && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 6 }}>
                Anexos
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{detalle.anexos}</div>
            </div>
          )}
        </>
      )}
    </DrawerPanel>
  );
}

function InformePreviewModal({ informeId, onClose, toast }) {
  const { detalle, loading } = useInformeDetalle(informeId, toast);
  const paperRef = useRef(null);
  const [descargando, setDescargando] = useState(false);

  const descargarPdf = async () => {
    if (!paperRef.current || !detalle) return;
    setDescargando(true);
    try {
      const { default: html2pdf } = await import("html2pdf.js");
      await html2pdf()
        .set({
          margin: 10,
          filename: `${detalle.codigo}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "letter", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(paperRef.current)
        .save();
    } catch (err) {
      toast(`No se pudo generar el PDF: ${err.message}`, "error");
    } finally {
      setDescargando(false);
    }
  };

  return (
    <Modal
      icon={<FileText size={16} />}
      title={detalle ? <>Vista previa — <b>{detalle.codigo}</b></> : "Vista previa"}
      subtitle={detalle ? `${detalle.novedad.codigo_novedad} · ${detalle.novedad.cliente}` : null}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={descargarPdf} disabled={!detalle || descargando}>
            <Download size={14} /> {descargando ? "Generando PDF…" : "Descargar PDF"}
          </button>
        </>
      }
    >
      {loading || !detalle ? (
        <div style={{ color: "var(--text-muted)", padding: "32px 0", textAlign: "center" }}>Cargando…</div>
      ) : (
        <InformePreview ref={paperRef} detalle={detalle} />
      )}
    </Modal>
  );
}

export default function InformesPage() {
  const [informes, setInformes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [informeAbiertoId, setInformeAbiertoId] = useState(null);
  const [informePreviewId, setInformePreviewId] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [filtroResultado, setFiltroResultado] = useState("Todos");
  const [filtroCliente, setFiltroCliente] = useState("Todos");
  const [ordenFecha, setOrdenFecha] = useState("desc");

  const mostrarToast = (msg, type) => setToast({ msg, type });

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`${API_BASE}/api/informes/`, { credentials: "include" });
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        const data = await res.json();
        if (!cancelado) setInformes(data);
      } catch (err) {
        if (!cancelado) setLoadError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  const resetFilters = () => {
    setSearch("");
    setFiltroResultado("Todos");
    setFiltroCliente("Todos");
    setOrdenFecha("desc");
  };

  const clientesDisponibles = ["Todos", ...Array.from(new Set(informes.map((i) => i.cliente).filter(Boolean)))];

  const informesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...informes]
      .filter((inf) => {
        const texto = [inf.codigo, inf.titulo, inf.tipo_informe, inf.novedad_codigo, inf.cliente, inf.analista, inf.vehiculo, inf.numero_interno]
          .filter(Boolean).join(" ").toLowerCase();
        const matchSearch = q === "" || texto.includes(q);
        const matchResultado = filtroResultado === "Todos" || inf.resultado === filtroResultado;
        const matchCliente = filtroCliente === "Todos" || inf.cliente === filtroCliente;
        return matchSearch && matchResultado && matchCliente;
      })
      .sort((a, b) => {
        if (ordenFecha === "asc") return new Date(a.fecha_creacion) - new Date(b.fecha_creacion);
        return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
      });
  }, [informes, search, filtroResultado, filtroCliente, ordenFecha]);

  const hayFiltrosActivos = search || filtroResultado !== "Todos" || filtroCliente !== "Todos";

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <div className="hero-eyebrow">Informes legales</div>
          <h2 className="hero-title">Convierte cada caso revisado en un informe claro y accionable</h2>
          <p className="hero-text">
            Informes ya generados desde el flujo de revisión de DVR de cada novedad. Para crear uno nuevo, ábrelo desde
            la novedad correspondiente en Novedades.
          </p>
        </div>
      </div>

      <div className="hero-metrics">
        <div className="metric-pill"><strong>{informes.length}</strong> informes</div>
        <div className="metric-pill"><strong>{informes.filter((i) => i.resultado === "Positiva").length}</strong> positivos</div>
        <div className="metric-pill"><strong>{informes.filter((i) => i.resultado === "Negativa").length}</strong> negativos</div>
        <div className="metric-pill"><strong>{informes.reduce((acc, i) => acc + (i.cantidad_adjuntos || 0), 0)}</strong> archivos adjuntos</div>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 search-bar" style={{ margin: 0 }}>
            <Search size={14} />
            <input
              type="search"
              style={{ width: "100%" }}
              placeholder="Buscar por código, tipo, cliente, vehículo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar informes"
            />
          </div>
          <div className="md:col-span-3">
            <select className="form-select" value={filtroResultado} onChange={(e) => setFiltroResultado(e.target.value)} aria-label="Filtrar por resultado">
              {["Todos", "Positiva", "Negativa"].map((r) => <option key={r} value={r}>{r === "Todos" ? "Todos los resultados" : r}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <select className="form-select" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} aria-label="Filtrar por cliente">
              {clientesDisponibles.map((c) => <option key={c} value={c}>{c === "Todos" ? "Todos los clientes" : c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="badge" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>{informesFiltrados.length} resultados</span>
            {search && <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}>Buscando: "{search}"</span>}
            {filtroResultado !== "Todos" && <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}>Resultado: {filtroResultado}</span>}
            {filtroCliente !== "Todos" && <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}>Cliente: {filtroCliente}</span>}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button className="btn btn-sm btn-secondary" onClick={() => setOrdenFecha((p) => (p === "desc" ? "asc" : "desc"))}>
              <SortAsc size={13} /> Fecha {ordenFecha === "desc" ? "Recientes primero" : "Antiguos primero"}
            </button>
            {hayFiltrosActivos && (
              <button className="btn btn-sm btn-secondary" style={{ color: "var(--accent-danger)" }} onClick={resetFilters}>
                <RefreshCw size={13} /> Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && <div className="card" style={{ color: "var(--text-muted)" }}>Cargando informes…</div>}
      {loadError && (
        <div className="card" style={{ color: "var(--accent-danger)" }}>No se pudieron cargar los informes: {loadError}</div>
      )}

      {!loading && !loadError && informesFiltrados.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", maxWidth: 480, margin: "0 auto" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: "var(--bg-hover)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "1px solid var(--border)",
          }}>
            <FileText size={28} color="var(--text-muted)" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            {informes.length === 0 ? "Todavía no hay informes generados" : "No se encontraron informes"}
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
            {informes.length === 0
              ? "Los informes se generan desde el flujo de revisión de una novedad, una vez tiene un resultado (Positiva/Negativa)."
              : "Prueba ajustando los filtros o buscando un término diferente."}
          </p>
        </div>
      )}

      {!loading && !loadError && informesFiltrados.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {informesFiltrados.map((inf) => (
            <div
              key={inf.id}
              className="group flex flex-col justify-between overflow-hidden transition-all duration-200"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)" }}
            >
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--accent-glow)", border: "1px solid var(--border-accent)" }}>
                      <Scale size={18} color="var(--accent-primary)" />
                    </div>
                    <div>
                      <span className="font-mono font-bold text-sm tracking-wider block" style={{ color: "var(--accent-primary)" }}>{inf.codigo}</span>
                      <span className="text-xs font-semibold block mt-0.5" style={{ color: "var(--text-muted)" }}>{inf.novedad_codigo}</span>
                    </div>
                  </div>
                  <span className="badge" style={{
                    background: inf.resultado === "Positiva" ? "var(--accent-success-soft)" : "var(--accent-danger-soft)",
                    color: inf.resultado === "Positiva" ? "var(--accent-success)" : "var(--accent-danger)",
                  }}>
                    {inf.resultado === "Positiva" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {inf.resultado}
                  </span>
                </div>

                <h2 className="font-bold text-base leading-tight" style={{ color: "var(--text-primary)" }}>{inf.tipo_informe || "—"}</h2>

                <div className="space-y-2.5 text-xs pt-1" style={{ color: "var(--text-secondary)" }}>
                  <div className="flex items-center gap-2.5">
                    <Building2 size={14} color="var(--text-muted)" className="shrink-0" />
                    <span className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{inf.cliente}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <User size={14} color="var(--text-muted)" className="shrink-0" />
                    <span className="truncate">{inf.analista}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Clock size={14} color="var(--text-muted)" className="shrink-0" />
                    <span>{formatFechaHora(inf.fecha_creacion)}</span>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 pt-3 mt-auto space-y-3" style={{ background: "var(--bg-hover)", borderTop: "1px solid var(--border)" }}>
                <div className="flex flex-wrap gap-1.5">
                  <span className="badge" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    <Truck size={12} /><span className="font-semibold">{inf.vehiculo}</span>
                  </span>
                  <span className="badge" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    Int. {inf.numero_interno}
                  </span>
                  <span className="badge" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", marginLeft: "auto" }}>
                    <Paperclip size={11} /> {inf.cantidad_adjuntos}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => setInformePreviewId(inf.id)}
                  >
                    <FileText size={14} /> Vista previa
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    title="Ver detalle y adjuntos"
                    aria-label="Ver detalle y adjuntos"
                    onClick={() => setInformeAbiertoId(inf.id)}
                  >
                    <Eye size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {informeAbiertoId && (
        <InformeDetalleDrawer informeId={informeAbiertoId} onClose={() => setInformeAbiertoId(null)} toast={mostrarToast} />
      )}
      {informePreviewId && (
        <InformePreviewModal informeId={informePreviewId} onClose={() => setInformePreviewId(null)} toast={mostrarToast} />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
