import React, { useState, useMemo } from "react";
import {
  FileText, Eye, Printer, CheckCircle2,
  Building2, Truck, MapPin, User, Clock, Scale,
  Search, SortAsc, RefreshCw, Paperclip
} from "lucide-react";
import { informes as initialInformes, novedades, clientes } from "../data/mockData";
import { formatFechaHora, generarIdInforme } from "../utils/helpers";
import Toast from "../components/ui/Toast";
import DrawerPanel from "../components/ui/DrawerPanel";
import InformeBuilder from "./InformeBuilder/InformeBuilderPage";

function DetailRow({ label, value }) {
  return (
    <div style={{ padding: "10px 12px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{value || "—"}</div>
    </div>
  );
}

function ModalGenerarInforme({ novedad, onClose, onCrear }) {
  const [tipo, setTipo] = useState("");
  const [elaboradoPor, setElaboradoPor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!tipo.trim()) return;
    setSubmitting(true);
    onCrear({
      tipo: tipo.trim(),
      elaboradoPor: elaboradoPor.trim(),
      codigo_novedad: novedad.codigo_novedad,
      placa: novedad.vehiculo,
      numero_interno: novedad.numero_interno,
    });
  };

  return (
    <DrawerPanel
      icon={<FileText size={18} />}
      title="Generar informe legal"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="form-generar-informe" className="btn btn-primary" disabled={submitting}>Generar informe</button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}>
          {novedad.codigo_novedad}
        </span>
        <span className="badge" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
          {novedad.cliente}
        </span>
      </div>
      <form id="form-generar-informe" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Tipo de informe<span className="req"> *</span></label>
          <input
            className="form-input"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            placeholder="Ej. Choque simple, PQR, seguimiento..."
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Elaborado por</label>
          <input
            className="form-input"
            value={elaboradoPor}
            onChange={(e) => setElaboradoPor(e.target.value)}
            placeholder="Nombre del analista"
          />
        </div>
      </form>
    </DrawerPanel>
  );
}

function InformePreview({ informe, onClose }) {
  return (
    <DrawerPanel
      icon={<Eye size={18} />}
      title={<>Informe <b>{informe.id}</b></>}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Imprimir</button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <span className="badge" style={{ background: "var(--accent-success-soft)", color: "var(--accent-success)" }}>
          {informe.estado}
        </span>
        <span className="badge" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
          {informe.tipo}
        </span>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <DetailRow label="Novedad" value={informe.codigo_novedad || informe.novedadId} />
        <DetailRow label="Elaborado por" value={informe.elaboradoPor} />
        <DetailRow label="Vehículo" value={`${informe.placa || "—"} · Int. ${informe.numero_interno || "—"}`} />
        <DetailRow label="Fecha" value={formatFechaHora(informe.fecha)} />
      </div>
    </DrawerPanel>
  );
}

export default function InformesPage({ novedadParaInforme, onClearNovedad, highlightId }) {
  const [informes, setInformes] = useState(initialInformes);
  const [modal, setModal] = useState(novedadParaInforme ? "generar" : null);
  const [selectedInforme, setSelectedInforme] = useState(null);
  const [novedadActiva, setNovedadActiva] = useState(novedadParaInforme);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroCliente, setFiltroCliente] = useState("Todos");
  const [ordenFecha, setOrdenFecha] = useState("desc");

  const novedadDemo = {
    codigo_novedad: "NAS-SC-1262",
    cliente: "Flota La Macarena",
    conductor: "Fabian Leonardo Rueda Acosta",
    numero_interno: "7389",
    vehiculo: "TSW878",
  };

  React.useEffect(() => {
    if (novedadParaInforme) {
      setNovedadActiva(novedadParaInforme);
      setModal("generar");
    }
  }, [novedadParaInforme]);

  const handleCrear = (form) => {
    const nuevo = {
      ...form,
      id: generarIdInforme(informes),
      novedadId: novedadActiva.id,
      fecha: new Date().toISOString(),
      estado: "Finalizado",
      adjuntos: [],
    };
    setInformes(is => [nuevo, ...is]);
    setToast({ msg: `Informe ${nuevo.id} generado exitosamente`, type: "success" });
    setModal(null);
    setNovedadActiva(null);
    if (onClearNovedad) onClearNovedad();
    setTimeout(() => { setSelectedInforme(nuevo); setModal("ver"); }, 300);
  };

  const resetFilters = () => {
    setSearch("");
    setFiltroEstado("Todos");
    setFiltroCliente("Todos");
    setOrdenFecha("desc");
  };

  const estadosDisponibles = ["Todos", ...Array.from(new Set(informes.map(i => i.estado)))];
  const clientesDisponibles = ["Todos", ...Array.from(new Set(informes.map(i => clientes.find(c => c.id === (novedades.find(n => n.id === i.novedadId)?.cliente))?.razonSocial).filter(Boolean)))];

  const informesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...informes]
      .filter(inf => {
        const novedad = novedades.find(n => n.id === inf.novedadId);
        const cliente = clientes.find(c => c.id === novedad?.cliente);
        const texto = [inf.id, inf.tipo, inf.novedadId, inf.codigo_novedad, cliente?.razonSocial, inf.elaboradoPor, inf.placa, inf.numero_interno]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchSearch = q === "" || texto.includes(q);
        const matchEstado = filtroEstado === "Todos" || inf.estado === filtroEstado;
        const matchCliente = filtroCliente === "Todos" || cliente?.razonSocial === filtroCliente;
        return matchSearch && matchEstado && matchCliente;
      })
      .sort((a, b) => {
        if (ordenFecha === "asc") return new Date(a.fecha) - new Date(b.fecha);
        return new Date(b.fecha) - new Date(a.fecha);
      });
  }, [informes, search, filtroEstado, filtroCliente, ordenFecha]);

  const hayFiltrosActivos = search || filtroEstado !== "Todos" || filtroCliente !== "Todos";

  if (modal === "plantilla") {
    return (
      <InformeBuilder
        data={novedadDemo}
        onVolver={() => setModal(null)}
        onGuardar={(payload) => {
          console.log("Payload de prueba (provisional):", payload);
          setModal(null);
        }}
      />
    );
  }

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <div className="hero-eyebrow">Informes legales</div>
          <h2 className="hero-title">Convierte cada caso revisado en un informe claro y accionable</h2>
          <p className="hero-text">La vista organiza los informes por contexto, cliente y estado para mejorar la trazabilidad del proceso.</p>
        </div>
        <div className="hero-actions">
          <button
            className="btn btn-primary"
            onClick={() => setModal("plantilla")}
          >
            <FileText size={16} />
            Ver plantilla de prueba
          </button>
        </div>
      </div>

      <div className="hero-metrics">
        <div className="metric-pill"><strong>{informes.length}</strong> informes</div>
        <div className="metric-pill"><strong>{informes.filter((i) => i.estado === "Finalizado").length}</strong> finalizados</div>
        <div className="metric-pill"><strong>{informes.filter((i) => i.estado !== "Finalizado").length}</strong> en proceso</div>
      </div>

      {/* Barra de herramientas y filtros */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 search-bar" style={{ margin: 0 }}>
            <Search size={14} />
            <input
              type="search"
              style={{ width: "100%" }}
              placeholder="Buscar por ID, tipo, cliente, placa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Buscar informes"
            />
          </div>
          <div className="md:col-span-3">
            <select
              className="form-select"
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              aria-label="Filtrar por estado"
            >
              {estadosDisponibles.map(estado => <option key={estado} value={estado}>{estado === 'Todos' ? 'Todos los estados' : estado}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <select
              className="form-select"
              value={filtroCliente}
              onChange={e => setFiltroCliente(e.target.value)}
              aria-label="Filtrar por cliente"
            >
              {clientesDisponibles.map(cliente => <option key={cliente} value={cliente}>{cliente === 'Todos' ? 'Todos los clientes' : cliente}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="badge" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
              {informesFiltrados.length} resultados
            </span>
            {search && <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}>Buscando: "{search}"</span>}
            {filtroEstado !== "Todos" && <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}>Estado: {filtroEstado}</span>}
            {filtroCliente !== "Todos" && <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}>Cliente: {filtroCliente}</span>}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setOrdenFecha(prev => prev === "desc" ? "asc" : "desc")}
            >
              <SortAsc size={13} />
              Fecha {ordenFecha === "desc" ? "Recientes primero" : "Antiguos primero"}
            </button>
            {hayFiltrosActivos && (
              <button
                className="btn btn-sm btn-secondary"
                style={{ color: "var(--accent-danger)" }}
                onClick={resetFilters}
              >
                <RefreshCw size={13} />
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista / Grid de informes */}
      {informesFiltrados.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", maxWidth: 480, margin: "0 auto" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: "var(--bg-hover)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            border: "1px solid var(--border)",
          }}>
            <FileText size={28} color="var(--text-muted)" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>No se encontraron informes</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
            Prueba ajustando los filtros o buscando un término diferente. Los informes válidos se generan desde las novedades.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {informesFiltrados.map(inf => {
            const novedad = novedades.find(n => n.id === inf.novedadId);
            const cliente = clientes.find(c => c.id === novedad?.cliente);
            const isHighlight = inf.id === highlightId;

            return (
              <div
                key={inf.id}
                className="group flex flex-col justify-between overflow-hidden transition-all duration-200"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: isHighlight ? "0 0 0 2px var(--accent-primary), var(--shadow-card)" : "var(--shadow-card)",
                }}
              >
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: "var(--accent-glow)", border: "1px solid var(--border-accent)" }}
                      >
                        <Scale size={18} color="var(--accent-primary)" />
                      </div>
                      <div>
                        <span className="font-mono font-bold text-sm tracking-wider block" style={{ color: "var(--accent-primary)" }}>{inf.id}</span>
                        <span className="text-xs font-semibold block mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {novedad?.codigo_novedad || inf.codigo_novedad || inf.novedadId}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className="badge" style={{ background: "var(--accent-success-soft)", color: "var(--accent-success)" }}>
                        <CheckCircle2 size={12} />
                        {inf.estado}
                      </span>
                      {isHighlight && (
                        <span
                          className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide"
                          style={{ background: "var(--accent-primary)", color: "#fff" }}
                        >
                          Nuevo
                        </span>
                      )}
                    </div>
                  </div>

                  <h2
                    className="font-bold text-base leading-tight transition-colors"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {inf.tipo}
                  </h2>

                  <div className="space-y-2.5 text-xs pt-1" style={{ color: "var(--text-secondary)" }}>
                    <div className="flex items-center gap-2.5">
                      <Building2 size={14} color="var(--text-muted)" className="shrink-0" />
                      <span className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{cliente?.razonSocial || "Cliente no asignado"}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <User size={14} color="var(--text-muted)" className="shrink-0" />
                      <span className="truncate">{inf.elaboradoPor || novedad?.conductor || "Sin responsable asignado"}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Clock size={14} color="var(--text-muted)" className="shrink-0" />
                      <span>{formatFechaHora(inf.fecha)}</span>
                    </div>
                  </div>
                </div>

                <div
                  className="px-5 pb-5 pt-3 mt-auto space-y-3"
                  style={{ background: "var(--bg-hover)", borderTop: "1px solid var(--border)" }}
                >
                  <div className="flex flex-wrap gap-1.5">
                    <span className="badge" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      <Truck size={12} />
                      <span className="font-semibold">{inf.placa || novedad?.vehiculo || "—"}</span>
                    </span>
                    <span className="badge" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      <MapPin size={12} />
                      <span>Int. {inf.numero_interno || novedad?.numero_interno || "N/A"}</span>
                    </span>
                    <span className="badge" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", marginLeft: "auto" }}>
                      <Paperclip size={11} />
                      {inf.adjuntos?.length ?? 0}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      className="btn btn-sm btn-secondary"
                      style={{ justifyContent: "center" }}
                      onClick={() => { setSelectedInforme(inf); setModal("ver"); }}
                    >
                      <Eye size={14} />
                      Ver detalle
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ justifyContent: "center" }}
                      onClick={() => window.print()}
                    >
                      <Printer size={14} />
                      Imprimir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal === "generar" && novedadActiva && (
        <ModalGenerarInforme
          novedad={novedadActiva}
          onClose={() => { setModal(null); setNovedadActiva(null); if (onClearNovedad) onClearNovedad(); }}
          onCrear={handleCrear}
        />
      )}
      {modal === "ver" && selectedInforme && (
        <InformePreview informe={selectedInforme} onClose={() => setModal(null)} />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
