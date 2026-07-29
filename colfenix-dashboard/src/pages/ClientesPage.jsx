import React, { useState } from "react";
import { Users, Plus, Search, Edit2, Trash2, Eye, Zap, Building2, Phone, Mail, MapPin, Truck } from "lucide-react";
import { clientes as initialClientes } from "../data/mockData";
import { generarCodigoCliente, formatFecha } from "../utils/helpers";
import Toast from "../components/ui/Toast";
import DrawerPanel from "../components/ui/DrawerPanel";
import { useAuth } from "../context/AuthContext";
import { tienePermiso } from "../utils/permisos";

function ModalCliente({ cliente, onClose, onSave }) {
  const isEdit = !!cliente?.id;
  const [form, setForm] = useState(
    cliente || { razonSocial: "", nit: "", contacto: "", telefono: "", email: "", ciudad: "", estado: "Activo" }
  );
  const [toast, setToast] = useState(null);

  const codigoPreview = generarCodigoCliente(form.razonSocial);

  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.razonSocial || !form.nit || !form.contacto) {
      setToast({ msg: "Completa los campos obligatorios", type: "error" });
      return;
    }
    const nuevo = {
      ...form,
      id: isEdit ? form.id : `CLI-${String(Math.floor(Math.random() * 900) + 100)}`,
      codigo: codigoPreview,
      vehiculos: form.vehiculos || 0,
      fechaIngreso: form.fechaIngreso || new Date().toISOString().split("T")[0],
    };
    onSave(nuevo);
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
          <button className="btn btn-primary" onClick={handleSubmit}>
            {isEdit ? "Guardar cambios" : "Crear cliente"}
          </button>
        </>
      }
    >
          {/* Código preview */}
          {form.razonSocial && (
            <div style={{ marginBottom: 20, padding: "12px 16px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-accent)", display: "flex", alignItems: "center", gap: 14 }}>
              <Zap size={16} color="var(--accent-primary)" />
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Código generado automáticamente</div>
                <span className="codigo-preview">{codigoPreview}</span>
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label className="form-label">Razón social <span className="req">*</span></label>
              <input className="form-input" value={form.razonSocial} onChange={e => handleChange("razonSocial", e.target.value)} placeholder="Ej: Expreso Brasilia S.A." />
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
                <option>Activo</option>
                <option>Inactivo</option>
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
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{cliente.razonSocial}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>NIT: {cliente.nit}</div>
              <div style={{ marginTop: 6 }}>
                <span className={`badge`} style={{
                  background: cliente.estado === "Activo" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                  color: cliente.estado === "Activo" ? "var(--accent-success)" : "var(--accent-danger)",
                  border: `1px solid ${cliente.estado === "Activo" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`
                }}>{cliente.estado}</span>
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
              { icon: Truck, label: "Vehículos", value: `${cliente.vehiculos} unidades` },
              { icon: Building2, label: "Fecha de ingreso", value: formatFecha(cliente.fechaIngreso) },
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

export default function ClientesPage() {
  const { user } = useAuth();
  const puedeCrear = tienePermiso(user, "clientes.crear");
  const puedeEditar = tienePermiso(user, "clientes.editar");
  const puedeEliminar = tienePermiso(user, "clientes.eliminar");
  const [clientes, setClientes] = useState(initialClientes);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | "nuevo" | "editar" | "detalle"
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("Todos");

  const filtered = clientes.filter(c => {
    const matchSearch = c.razonSocial.toLowerCase().includes(search.toLowerCase()) ||
      c.codigo.toLowerCase().includes(search.toLowerCase()) ||
      c.ciudad.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filtroEstado === "Todos" || c.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  const handleSave = (nuevo) => {
    if (modal === "editar") {
      setClientes(cs => cs.map(c => c.id === nuevo.id ? nuevo : c));
      setToast({ msg: "Cliente actualizado exitosamente", type: "success" });
    } else {
      setClientes(cs => [...cs, nuevo]);
      setToast({ msg: "Cliente registrado exitosamente", type: "success" });
    }
    setModal(null);
    setSelected(null);
  };

  const handleDelete = (id) => {
    if (window.confirm("¿Eliminar este cliente?")) {
      setClientes(cs => cs.filter(c => c.id !== id));
      setToast({ msg: "Cliente eliminado", type: "success" });
    }
  };

  return (
    <div className="page-wrapper">
      <div className="section-header">
        <div>
          <div className="section-title">Clientes</div>
          <div className="section-sub">{clientes.length} empresas registradas · {clientes.filter(c => c.estado === "Activo").length} activas</div>
        </div>
        {puedeCrear && (
          <button className="btn btn-primary" onClick={() => { setSelected(null); setModal("nuevo"); }}>
            <Plus size={15} /> Nuevo cliente
          </button>
        )}
      </div>

      <div className="card">
        <div className="filters-bar">
          <div className="search-bar">
            <Search size={14} />
            <input placeholder="Buscar por nombre, código o ciudad..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {["Todos", "Activo", "Inactivo"].map(e => (
            <button key={e} className={`btn btn-sm ${filtroEstado === e ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFiltroEstado(e)}>{e}</button>
          ))}
        </div>

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
                  <span className="codigo-preview" style={{ fontSize: 12, padding: "3px 8px" }}>{c.codigo}</span>
                </td>
                <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{c.razonSocial}</td>
                <td className="mono" style={{ fontSize: 12 }}>{c.nit}</td>
                <td>{c.ciudad}</td>
                <td>{c.contacto}</td>
                <td>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Truck size={12} color="var(--text-muted)" /> {c.vehiculos}
                  </span>
                </td>
                <td>
                  <span className="badge" style={{
                    background: c.estado === "Activo" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                    color: c.estado === "Activo" ? "var(--accent-success)" : "var(--accent-danger)",
                    border: `1px solid ${c.estado === "Activo" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`
                  }}>{c.estado}</span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn-icon" title="Ver detalle" onClick={() => { setSelected(c); setModal("detalle"); }}><Eye size={14} /></button>
                    {puedeEditar && (
                      <button className="btn-icon" title="Editar" onClick={() => { setSelected(c); setModal("editar"); }}><Edit2 size={14} /></button>
                    )}
                    {puedeEliminar && (
                      <button className="btn-icon" title="Eliminar" style={{ color: "var(--accent-danger)" }} onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(modal === "nuevo" || modal === "editar") && (
        <ModalCliente cliente={modal === "editar" ? selected : null} onClose={() => setModal(null)} onSave={handleSave} />
      )}
      {modal === "detalle" && selected && (
        <ModalDetalle cliente={selected} onClose={() => setModal(null)} />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
