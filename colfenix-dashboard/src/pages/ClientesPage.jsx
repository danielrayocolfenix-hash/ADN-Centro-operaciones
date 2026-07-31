import React, { useEffect, useMemo, useState } from "react";
import { Users, Plus, Search, Edit2, Trash2, Eye, Zap, Building2, Phone, Mail, MapPin, Truck, Download } from "lucide-react";
import ExcelJS from "exceljs";
import { API_BASE } from "../config/api";
import { getCsrfToken } from "../utils/csrf";
import { generarCodigoCliente, formatFecha, hexToArgb, formatFechaCortaISO } from "../utils/helpers";
import Toast from "../components/ui/Toast";
import DrawerPanel from "../components/ui/DrawerPanel";
import { useAuth } from "../context/AuthContext";
import { tienePermiso } from "../utils/permisos";

const ESTADO_BADGE = (estado) => ({
  background: estado === "ACTIVO" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
  color: estado === "ACTIVO" ? "var(--accent-success)" : "var(--accent-danger)",
  border: `1px solid ${estado === "ACTIVO" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
});

function ModalCliente({ cliente, onClose, onSaved }) {
  const isEdit = !!cliente?.id;
  const [form, setForm] = useState(
    cliente || { nombre: "", nit: "", contacto: "", telefono: "", email: "", ciudad: "", estado: "ACTIVO" }
  );
  const [toast, setToast] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const codigoPreview = isEdit ? cliente.codigo : generarCodigoCliente(form.nombre);

  const handleChange = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nombre || !form.nit || !form.contacto) {
      setToast({ msg: "Completa los campos obligatorios", type: "error" });
      return;
    }
    setGuardando(true);
    try {
      const url = isEdit ? `${API_BASE}/api/admin/clientes/${cliente.id}/` : `${API_BASE}/api/admin/clientes/`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ ...form, codigo: isEdit ? cliente.codigo : codigoPreview }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo guardar el cliente");
      onSaved(resultado.cliente, isEdit);
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
    <DrawerPanel
      icon={<Building2 size={18} />}
      title={isEdit ? "Editar cliente" : "Nuevo cliente"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={guardando}>
            {guardando ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear cliente"}
          </button>
        </>
      }
    >
          {/* Código preview */}
          {form.nombre && (
            <div style={{ marginBottom: 20, padding: "12px 16px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-accent)", display: "flex", alignItems: "center", gap: 14 }}>
              <Zap size={16} color="var(--accent-primary)" />
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>
                  {isEdit ? "Código del cliente" : "Código generado automáticamente"}
                </div>
                <span className="codigo-preview">{codigoPreview}</span>
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label className="form-label">Razón social <span className="req">*</span></label>
              <input className="form-input" value={form.nombre} onChange={e => handleChange("nombre", e.target.value)} placeholder="Ej: Expreso Brasilia S.A." />
            </div>
            <div className="form-group">
              <label className="form-label">NIT <span className="req">*</span></label>
              <input className="form-input" value={form.nit} onChange={e => handleChange("nit", e.target.value)} placeholder="800.123.456-7" />
            </div>
            <div className="form-group">
              <label className="form-label">Ciudad</label>
              <input className="form-input" value={form.ciudad} onChange={e => handleChange("ciudad", e.target.value)} placeholder="Bogotá" />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre de contacto <span className="req">*</span></label>
              <input className="form-input" value={form.contacto} onChange={e => handleChange("contacto", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input className="form-input" value={form.telefono} onChange={e => handleChange("telefono", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input className="form-input" type="email" value={form.email} onChange={e => handleChange("email", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-select" value={form.estado} onChange={e => handleChange("estado", e.target.value)}>
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
            </div>
          </div>
    </DrawerPanel>
    {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

function ModalDetalle({ cliente, onClose }) {
  return (
    <DrawerPanel
      icon={<Eye size={18} />}
      title="Detalle de cliente"
      onClose={onClose}
      footer={<button className="btn btn-secondary" onClick={onClose}>Cerrar</button>}
    >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 14, color: "white" }}>{cliente.codigo}</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{cliente.nombre}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>NIT: {cliente.nit}</div>
              <div style={{ marginTop: 6 }}>
                <span className="badge" style={ESTADO_BADGE(cliente.estado)}>{cliente.estado_display}</span>
              </div>
            </div>
          </div>
          <div className="divider" />
          <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
            {[
              { icon: Users, label: "Contacto", value: cliente.contacto },
              { icon: Phone, label: "Teléfono", value: cliente.telefono },
              { icon: Mail, label: "Correo", value: cliente.email },
              { icon: MapPin, label: "Ciudad", value: cliente.ciudad },
              { icon: Truck, label: "Vehículos", value: `${cliente.vehiculos_count} unidades` },
              { icon: Building2, label: "Fecha de ingreso", value: formatFecha(cliente.fecha_creacion) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={14} color="var(--accent-primary)" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{value || "—"}</div>
                </div>
              </div>
            ))}
          </div>
    </DrawerPanel>
  );
}

const COLUMNAS_CLIENTES_EXPORT = [
  { key: "codigo", label: "Código", width: 14 },
  { key: "nombre", label: "Razón social", width: 32 },
  { key: "nit", label: "NIT", width: 18 },
  { key: "contacto", label: "Contacto", width: 22 },
  { key: "telefono", label: "Teléfono", width: 16 },
  { key: "email", label: "Correo", width: 26 },
  { key: "ciudad", label: "Ciudad", width: 16 },
  { key: "vehiculos_count", label: "Vehículos", width: 12 },
  { key: "estado_display", label: "Estado", width: 12 },
  { key: "fecha_creacion", label: "Fecha de ingreso", width: 16 },
];

function valorPlanoCliente(cliente, key) {
  const valor = cliente[key];
  if (valor === null || valor === undefined || valor === "") return "";
  if (key === "fecha_creacion") return formatFecha(valor);
  return valor;
}

// Mismo patrón de exportación (ExcelJS, encabezado de color, fila de
// metadata, autofiltro, cabecera congelada, título/color configurables) que
// ya usan Novedades, Trazabilidad y Métricas de analistas.
async function exportarClientesXLSX(clientes, columnas, { titulo = "Clientes", colorHex = "#4F8CFF" } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Colfenix GPS";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet("Clientes", { views: [{ state: "frozen", ySplit: 5 }] });
  hoja.columns = columnas.map((c) => ({ key: c.key, width: c.width }));

  hoja.mergeCells(1, 1, 1, columnas.length);
  const celdaTitulo = hoja.getCell(1, 1);
  celdaTitulo.value = titulo || "Clientes";
  celdaTitulo.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };

  hoja.mergeCells(2, 1, 2, columnas.length);
  const celdaMeta = hoja.getCell(2, 1);
  celdaMeta.value = `Registros exportados: ${clientes.length}`;
  celdaMeta.font = { size: 10.5, color: { argb: "FF475569" } };

  hoja.mergeCells(3, 1, 3, columnas.length);
  const celdaExportado = hoja.getCell(3, 1);
  celdaExportado.value = `Exportado: ${new Date().toLocaleString("es-CO")}`;
  celdaExportado.font = { size: 9.5, italic: true, color: { argb: "FF94A3B8" } };

  const colorArgb = hexToArgb(colorHex);
  const filaEncabezado = hoja.getRow(5);
  columnas.forEach((c, i) => {
    const celda = filaEncabezado.getCell(i + 1);
    celda.value = c.label;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colorArgb } };
    celda.alignment = { vertical: "middle", horizontal: "left" };
    celda.border = { bottom: { style: "thin", color: { argb: "FF2563EB" } } };
  });
  filaEncabezado.height = 20;
  hoja.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: columnas.length } };

  clientes.forEach((cliente) => {
    const fila = hoja.addRow(
      Object.fromEntries(columnas.map((c) => [c.key, valorPlanoCliente(cliente, c.key)]))
    );
    fila.eachCell((celda) => {
      celda.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `clientes_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

// Modal de "Configurar exportación" -- mismo patrón que Novedades
// (components/DynamicTable/DynamicTable.jsx): rango de fechas (sobre
// fecha_creacion = fecha de ingreso), checklist de columnas, título/color
// de encabezado. Exporta sobre `clientesFiltrados` -- lo que ya está
// filtrado en la pantalla (búsqueda + Activo/Inactivo), no la lista cruda.
function ClientesExportModal({ clientesFiltrados, onClose }) {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState(() =>
    Object.fromEntries(COLUMNAS_CLIENTES_EXPORT.map((c) => [c.key, true]))
  );
  const [titulo, setTitulo] = useState("Clientes");
  const [colorHex, setColorHex] = useState("#4F8CFF");
  const [exportando, setExportando] = useState(false);

  const toggleColumna = (key) => setColumnasVisibles((prev) => ({ ...prev, [key]: !prev[key] }));
  const columnasElegidas = COLUMNAS_CLIENTES_EXPORT.filter((c) => columnasVisibles[c.key]);

  const clientesEnRango = useMemo(() => clientesFiltrados.filter((c) => {
    if (!fechaDesde && !fechaHasta) return true;
    const fecha = (c.fecha_creacion || "").slice(0, 10);
    if (fechaDesde && fecha < fechaDesde) return false;
    if (fechaHasta && fecha > fechaHasta) return false;
    return true;
  }), [clientesFiltrados, fechaDesde, fechaHasta]);

  const handleExportar = async () => {
    setExportando(true);
    try {
      await exportarClientesXLSX(clientesEnRango, columnasElegidas, { titulo: titulo.trim() || "Clientes", colorHex });
      onClose();
    } finally {
      setExportando(false);
    }
  };

  return (
    <DrawerPanel
      icon={<Download size={18} />}
      title="Configurar exportación"
      subtitle={`${clientesEnRango.length} de ${clientesFiltrados.length} clientes`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleExportar}
            disabled={exportando || columnasElegidas.length === 0 || clientesEnRango.length === 0}
          >
            {exportando ? "Generando..." : `Exportar (${clientesEnRango.length})`}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Rango de fechas (fecha de ingreso)</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input type="date" className="form-input" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          <input type="date" className="form-input" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
          {fechaDesde || fechaHasta
            ? `Del ${fechaDesde ? formatFechaCortaISO(fechaDesde) : "inicio"} al ${fechaHasta ? formatFechaCortaISO(fechaHasta) : "hoy"}.`
            : "Déjalo vacío para exportar todos los que ya ves filtrados abajo."}
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Configuración del encabezado</label>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Título</span>
            <input type="text" className="form-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Color</span>
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              style={{
                display: "block", width: 44, height: 34, padding: 2,
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                background: "var(--bg-surface)", cursor: "pointer",
              }}
            />
          </div>
        </div>
      </div>

      <div className="form-group">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label className="form-label" style={{ marginBottom: 0 }}>
            Columnas a exportar ({columnasElegidas.length})
          </label>
          <button
            onClick={() => setColumnasVisibles(Object.fromEntries(COLUMNAS_CLIENTES_EXPORT.map((c) => [c.key, true])))}
            style={{ fontSize: 12, color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Todas
          </button>
        </div>
        <div style={{
          maxHeight: 260, overflowY: "auto", marginTop: 8,
          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
        }}>
          {COLUMNAS_CLIENTES_EXPORT.map((col) => (
            <label key={col.key} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 12px", cursor: "pointer",
              background: columnasVisibles[col.key] ? "var(--accent-glow)" : "transparent",
              borderBottom: "1px solid var(--border)",
            }}>
              <input
                type="checkbox"
                checked={!!columnasVisibles[col.key]}
                onChange={() => toggleColumna(col.key)}
                style={{ accentColor: "var(--accent-primary)", width: 14, height: 14 }}
              />
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{col.label}</span>
            </label>
          ))}
        </div>
      </div>
    </DrawerPanel>
  );
}

export default function ClientesPage() {
  const { user } = useAuth();
  const puedeCrear = tienePermiso(user, "clientes.crear");
  const puedeEditar = tienePermiso(user, "clientes.editar");
  const puedeEliminar = tienePermiso(user, "clientes.eliminar");
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | "nuevo" | "editar" | "detalle"
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [exportModalOpen, setExportModalOpen] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/clientes/`, { credentials: "include" });
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        const data = await res.json();
        if (!cancelado) setClientes(data);
      } catch (err) {
        if (!cancelado) setLoadError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  const filtered = clientes.filter(c => {
    const matchSearch = c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (c.codigo || "").toLowerCase().includes(search.toLowerCase()) ||
      c.ciudad.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filtroEstado === "Todos" || c.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  const handleSaved = (clienteGuardado, wasEdit) => {
    setClientes((cs) => (
      wasEdit ? cs.map((c) => (c.id === clienteGuardado.id ? clienteGuardado : c)) : [...cs, clienteGuardado]
    ));
    setToast({ msg: wasEdit ? "Cliente actualizado exitosamente" : "Cliente registrado exitosamente", type: "success" });
    setModal(null);
    setSelected(null);
  };

  const handleDelete = async (cliente) => {
    if (!window.confirm(`¿Desactivar a ${cliente.nombre}? No podrá recibir nuevas novedades hasta reactivarlo.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/clientes/${cliente.id}/`, {
        method: "DELETE",
        headers: { "X-CSRFToken": getCsrfToken() },
        credentials: "include",
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo desactivar el cliente");
      setClientes((cs) => cs.map((c) => (c.id === cliente.id ? { ...c, estado: "INACTIVO", estado_display: "Inactivo" } : c)));
      setToast({ msg: "Cliente desactivado", type: "success" });
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
    }
  };

  return (
    <div className="page-wrapper">
      <div className="section-header">
        <div>
          <div className="section-title">Clientes</div>
          <div className="section-sub">{clientes.length} empresas registradas · {clientes.filter(c => c.estado === "ACTIVO").length} activas</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setExportModalOpen(true)} disabled={loading || filtered.length === 0}>
            <Download size={14} /> Exportar Excel
          </button>
          {puedeCrear && (
            <button className="btn btn-primary" onClick={() => { setSelected(null); setModal("nuevo"); }}>
              <Plus size={15} /> Nuevo cliente
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="filters-bar">
          <div className="search-bar">
            <Search size={14} />
            <input placeholder="Buscar por nombre, código o ciudad..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {[["Todos", "Todos"], ["Activo", "ACTIVO"], ["Inactivo", "INACTIVO"]].map(([label, valor]) => (
            <button key={valor} className={`btn btn-sm ${filtroEstado === valor ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFiltroEstado(valor)}>{label}</button>
          ))}
        </div>

        {loading && <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Cargando clientes…</div>}
        {loadError && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--accent-danger)" }}>
            No se pudieron cargar los clientes: {loadError}
          </div>
        )}

        {!loading && !loadError && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Razón social</th>
              <th>NIT</th>
              <th>Ciudad</th>
              <th>Contacto</th>
              <th>Vehículos</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8}>
                <div className="empty-state"><Users size={32} /><p>No se encontraron clientes</p></div>
              </td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id}>
                <td>
                  <span className="codigo-preview" style={{ fontSize: 12, padding: "3px 8px" }}>{c.codigo || "—"}</span>
                </td>
                <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{c.nombre}</td>
                <td className="mono" style={{ fontSize: 12 }}>{c.nit}</td>
                <td>{c.ciudad || "—"}</td>
                <td>{c.contacto || "—"}</td>
                <td>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Truck size={12} color="var(--text-muted)" /> {c.vehiculos_count}
                  </span>
                </td>
                <td>
                  <span className="badge" style={ESTADO_BADGE(c.estado)}>{c.estado_display}</span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn-icon" title="Ver detalle" onClick={() => { setSelected(c); setModal("detalle"); }}><Eye size={14} /></button>
                    {puedeEditar && (
                      <button className="btn-icon" title="Editar" onClick={() => { setSelected(c); setModal("editar"); }}><Edit2 size={14} /></button>
                    )}
                    {puedeEliminar && c.estado === "ACTIVO" && (
                      <button className="btn-icon" title="Desactivar" style={{ color: "var(--accent-danger)" }} onClick={() => handleDelete(c)}><Trash2 size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {(modal === "nuevo" || modal === "editar") && (
        <ModalCliente cliente={modal === "editar" ? selected : null} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {modal === "detalle" && selected && (
        <ModalDetalle cliente={selected} onClose={() => setModal(null)} />
      )}
      {exportModalOpen && (
        <ClientesExportModal clientesFiltrados={filtered} onClose={() => setExportModalOpen(false)} />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
