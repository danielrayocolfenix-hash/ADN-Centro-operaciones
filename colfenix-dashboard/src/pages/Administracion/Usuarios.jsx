import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldCheck, ShieldAlert, Save, Search, Crown, CheckSquare, Square,
  UserPlus, Edit2, Power, Lock, Info, Plus,
} from "lucide-react";
import { API_BASE } from "../../config/api";
import { getCsrfToken } from "../../utils/csrf";
import { useAuth } from "../../context/AuthContext";
import { tienePermiso } from "../../utils/permisos";
import DrawerPanel from "../../components/ui/DrawerPanel";
import Toast from "../../components/ui/Toast";

// Campo híbrido de rol: un input de texto libre (siempre se puede escribir
// cualquier cosa) con sugerencias del catálogo ya usado -- clic en una
// sugerencia la usa tal cual, seguir escribiendo algo que no está en la
// lista simplemente define un rol nuevo (el backend lo agrega solo al
// catálogo al guardar, ver _registrar_rol_si_es_nuevo en el backend).
function RolCombobox({ value, onChange, opciones, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const texto = value.trim().toLowerCase();
  const filtradas = texto ? opciones.filter((o) => o.toLowerCase().includes(texto)) : opciones;
  const esNuevo = !!texto && !opciones.some((o) => o.toLowerCase() === texto);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        className="form-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && (filtradas.length > 0 || esNuevo) && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-md, 10px)", padding: "6px 0", maxHeight: 220, overflowY: "auto",
          boxShadow: "0 12px 28px -8px rgba(0,0,0,0.35)",
        }}>
          {filtradas.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "7px 12px",
                background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, color: "var(--text-primary)",
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {o}
            </button>
          ))}
          {esNuevo && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
              fontSize: 12, color: "var(--accent-primary)",
              borderTop: filtradas.length > 0 ? "1px solid var(--border)" : "none", marginTop: filtradas.length > 0 ? 4 : 0,
            }}>
              <Plus size={12} /> Se usará como rol nuevo: "{value.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function inicialesDe(nombre) {
  if (!nombre) return "??";
  const partes = nombre.trim().split(/\s+/);
  return partes.slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "??";
}

// Agrupa el catálogo (ya viene ordenado por orden/categoria desde el
// backend) en { categoria: [permiso, ...] } preservando ese orden.
function agruparPorCategoria(catalogo) {
  const grupos = {};
  for (const p of catalogo) {
    if (!grupos[p.categoria]) grupos[p.categoria] = [];
    grupos[p.categoria].push(p);
  }
  return grupos;
}

function PermisosDrawer({ usuario, catalogo, onClose, toast, onGuardado }) {
  const [claves, setClaves] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/usuarios/${usuario.id}/permisos/`, { credentials: "include" });
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        const data = await res.json();
        if (!cancelado) setClaves(new Set(data.claves));
      } catch (err) {
        toast(`Error cargando permisos: ${err.message}`, "error");
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [usuario.id]); // eslint-disable-line

  const grupos = useMemo(() => agruparPorCategoria(catalogo), [catalogo]);

  const toggle = (clave) => {
    setClaves((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave); else next.add(clave);
      return next;
    });
  };

  const toggleCategoria = (nombreCategoria, marcar) => {
    setClaves((prev) => {
      const next = new Set(prev);
      for (const p of grupos[nombreCategoria]) {
        if (marcar) next.add(p.clave); else next.delete(p.clave);
      }
      return next;
    });
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/usuarios/${usuario.id}/permisos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ claves: [...claves] }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo guardar");
      toast(`Permisos de ${usuario.nombre} actualizados`, "success");
      onGuardado(usuario.id, claves.size);
      onClose();
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <DrawerPanel
      icon={<ShieldCheck size={18} />}
      title={usuario.nombre}
      subtitle={usuario.rol || usuario.username}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando || loading}>
            <Save size={14} /> {guardando ? "Guardando..." : "Guardar permisos"}
          </button>
        </>
      }
    >
      {usuario.is_staff && (
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-start", padding: 12, marginBottom: 16,
          borderRadius: "var(--radius-sm)", background: "var(--accent-warn-soft)", color: "var(--accent-warn)",
        }}>
          <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12.5 }}>
            Este usuario es <b>administrador</b> (is_staff): ya tiene acceso total a todo el dashboard sin importar
            estos checkboxes. Igual puedes dejarlos configurados para el día que se le quite ese rol.
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ color: "var(--text-muted)" }}>Cargando…</div>
      ) : (
        Object.entries(grupos).map(([categoria, permisos]) => {
          const todosMarcados = permisos.every((p) => claves.has(p.clave));
          return (
            <div key={categoria} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  {categoria}
                </span>
                <button
                  onClick={() => toggleCategoria(categoria, !todosMarcados)}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  {todosMarcados ? <CheckSquare size={13} /> : <Square size={13} />}
                  {todosMarcados ? "Quitar todos" : "Marcar todos"}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {permisos.map((p) => (
                  <label
                    key={p.clave}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: 13 }}
                  >
                    <input
                      type="checkbox"
                      checked={claves.has(p.clave)}
                      onChange={() => toggle(p.clave)}
                      style={{ accentColor: "var(--accent-primary)", width: 15, height: 15, flexShrink: 0 }}
                    />
                    <span style={{ color: "var(--text-primary)" }}>{p.etiqueta}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })
      )}
    </DrawerPanel>
  );
}

function CrearUsuarioDrawer({ onClose, toast, onCreado, puedeAsignarStaff, roles }) {
  const [form, setForm] = useState({
    username: "", password: "", first_name: "", last_name: "", rol: "", is_staff: false,
  });
  const [guardando, setGuardando] = useState(false);
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const crear = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      toast("Usuario y contraseña son obligatorios", "error");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/usuarios/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ ...form, username: form.username.trim() }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo crear el usuario");
      toast(`Usuario ${resultado.usuario.username} creado`, "success");
      onCreado(resultado.usuario);
      onClose();
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <DrawerPanel
      icon={<UserPlus size={18} />}
      title="Nuevo usuario"
      subtitle="Se le asignan automáticamente los permisos básicos del equipo"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="form-crear-usuario" className="btn btn-primary" disabled={guardando}>
            <Save size={14} /> {guardando ? "Creando..." : "Crear usuario"}
          </button>
        </>
      }
    >
      <form id="form-crear-usuario" onSubmit={crear} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="form-grid">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nombre</label>
            <input className="form-input" value={form.first_name} onChange={(e) => upd("first_name", e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Apellido</label>
            <input className="form-input" value={form.last_name} onChange={(e) => upd("last_name", e.target.value)} />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Usuario (username)<span className="req"> *</span></label>
          <input className="form-input" value={form.username} onChange={(e) => upd("username", e.target.value)} required />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Contraseña<span className="req"> *</span></label>
          <input type="password" className="form-input" value={form.password} onChange={(e) => upd("password", e.target.value)} required />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Rol</label>
          <RolCombobox opciones={roles} value={form.rol} onChange={(v) => upd("rol", v)} placeholder="Ej. Analista, Supervisor..." />
        </div>
        {puedeAsignarStaff && (
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.is_staff}
              onChange={(e) => upd("is_staff", e.target.checked)}
              style={{ accentColor: "var(--accent-primary)", width: 15, height: 15 }}
            />
            Administrador (acceso total, sin restricciones)
          </label>
        )}
      </form>
    </DrawerPanel>
  );
}

function EditarUsuarioDrawer({ usuario, onClose, toast, onGuardado, esUnoMismo, puedeAsignarStaff, roles }) {
  const [form, setForm] = useState({
    first_name: usuario.first_name || "",
    last_name: usuario.last_name || "",
    rol: usuario.rol || "",
    is_active: usuario.is_active,
    is_staff: usuario.is_staff,
    password: "",
  });
  const [guardando, setGuardando] = useState(false);
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      // Si no puede tocar is_staff, se omite del payload por completo (no
      // solo se deshabilita el checkbox) -- el backend rechaza toda la
      // edición si "is_staff" viene en el body y quien la envía no es
      // is_staff real, así que mandarlo sin querer bloquearía también los
      // demás campos que sí tenía permiso de cambiar.
      if (!puedeAsignarStaff) delete payload.is_staff;
      const res = await fetch(`${API_BASE}/api/admin/usuarios/${usuario.id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo guardar");
      toast(`Usuario ${resultado.usuario.username} actualizado`, "success");
      onGuardado(resultado.usuario);
      onClose();
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <DrawerPanel
      icon={<Edit2 size={18} />}
      title={`Editar ${usuario.nombre}`}
      subtitle={`@${usuario.username}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="form-editar-usuario" className="btn btn-primary" disabled={guardando}>
            <Save size={14} /> {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </>
      }
    >
      <form id="form-editar-usuario" onSubmit={guardar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="form-grid">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nombre</label>
            <input className="form-input" value={form.first_name} onChange={(e) => upd("first_name", e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Apellido</label>
            <input className="form-input" value={form.last_name} onChange={(e) => upd("last_name", e.target.value)} />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Rol</label>
          <RolCombobox opciones={roles} value={form.rol} onChange={(v) => upd("rol", v)} placeholder="Ej. Analista, Supervisor..." />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Nueva contraseña</label>
          <input
            type="password"
            className="form-input"
            placeholder="Dejar en blanco para no cambiarla"
            value={form.password}
            onChange={(e) => upd("password", e.target.value)}
          />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => upd("is_active", e.target.checked)}
            style={{ accentColor: "var(--accent-primary)", width: 15, height: 15 }}
          />
          Cuenta activa (desmarcar le quita el acceso sin borrar su historial)
        </label>

        {puedeAsignarStaff ? (
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: esUnoMismo ? "default" : "pointer", opacity: esUnoMismo ? 0.6 : 1 }}>
            <input
              type="checkbox"
              checked={form.is_staff}
              disabled={esUnoMismo}
              onChange={(e) => upd("is_staff", e.target.checked)}
              style={{ accentColor: "var(--accent-primary)", width: 15, height: 15 }}
            />
            Administrador (acceso total, sin restricciones)
          </label>
        ) : (
          usuario.is_staff && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--text-muted)" }}>
              <Lock size={13} /> Solo un administrador puede quitar ese rol.
            </div>
          )
        )}
        {esUnoMismo && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--text-muted)" }}>
            <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} /> No puedes quitarte tu propio acceso de administrador.
          </div>
        )}
      </form>
    </DrawerPanel>
  );
}

export default function UsuariosPage() {
  const { user: usuarioActual } = useAuth();
  const puedeGestionarUsuarios = tienePermiso(usuarioActual, "administracion.gestionar_usuarios");
  const puedeAsignarPermisos = tienePermiso(usuarioActual, "administracion.asignar_permisos");
  // El backend solo deja tocar is_staff a otro is_staff real (no basta con
  // administracion.gestionar_usuarios) -- se refleja acá para no mostrar un
  // control que el servidor va a rechazar.
  const puedeAsignarStaff = !!usuarioActual?.is_staff;

  const [usuarios, setUsuarios] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [usuarioEditandoDatos, setUsuarioEditandoDatos] = useState(null);
  const [creandoUsuario, setCreandoUsuario] = useState(false);
  const [toastState, setToastState] = useState(null);
  const toast = (msg, type) => setToastState({ msg, type });

  const cargar = async () => {
    setLoading(true);
    try {
      const [resUsuarios, resPermisos, resRoles] = await Promise.all([
        fetch(`${API_BASE}/api/admin/usuarios/`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/permisos/`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/roles/`, { credentials: "include" }),
      ]);
      if (!resUsuarios.ok) throw new Error(`El servidor respondió ${resUsuarios.status}`);
      if (!resPermisos.ok) throw new Error(`El servidor respondió ${resPermisos.status}`);
      if (!resRoles.ok) throw new Error(`El servidor respondió ${resRoles.status}`);
      setUsuarios(await resUsuarios.json());
      setCatalogo(await resPermisos.json());
      setRoles(await resRoles.json());
    } catch (err) {
      toast(`Error cargando usuarios: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Si el usuario recién creado/editado trajo un rol que no estaba en el
  // catálogo, el backend ya lo agregó ahí -- se refleja acá al toque para
  // que la siguiente vez que se abra el combobox ya aparezca sugerido, sin
  // esperar a un refresco de página.
  const registrarRolSiEsNuevo = (rol) => {
    if (rol && !roles.includes(rol)) setRoles((rs) => [...rs, rol].sort());
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const filtrados = usuarios.filter((u) => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return true;
    return u.nombre.toLowerCase().includes(t) || u.username.toLowerCase().includes(t) || (u.rol || "").toLowerCase().includes(t);
  });

  const totalPermisos = catalogo.length;

  const onGuardado = (usuarioId, nuevaCantidad) => {
    setUsuarios((us) => us.map((u) => (u.id === usuarioId ? { ...u, cantidad_permisos: nuevaCantidad } : u)));
  };

  const onCreado = (nuevo) => {
    setUsuarios((us) => [nuevo, ...us]);
    registrarRolSiEsNuevo(nuevo.rol);
  };

  const onUsuarioGuardado = (actualizado) => {
    setUsuarios((us) => us.map((u) => (u.id === actualizado.id ? { ...u, ...actualizado } : u)));
    registrarRolSiEsNuevo(actualizado.rol);
  };

  const toggleActivo = async (u) => {
    const accion = u.is_active ? "desactivar" : "activar";
    if (!window.confirm(`¿Seguro que quieres ${accion} a ${u.nombre}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/usuarios/${u.id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      const resultado = await res.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo actualizar");
      onUsuarioGuardado(resultado.usuario);
      toast(`${u.nombre} ${resultado.usuario.is_active ? "activado" : "desactivado"}`, "success");
    } catch (err) {
      toast(`Error: ${err.message}`, "error");
    }
  };

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <div className="hero-eyebrow">Administración · Usuarios y permisos</div>
          <h2 className="hero-title">Usuarios</h2>
          <p className="hero-text">
            Qué vistas y qué acciones puede usar cada persona del equipo dentro del dashboard. Los administradores
            (is_staff) siempre tienen acceso total; para el resto, elige exactamente qué puede ver y hacer.
          </p>
        </div>
        {puedeGestionarUsuarios && (
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => setCreandoUsuario(true)}>
              <UserPlus size={15} /> Nuevo usuario
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              className="form-input"
              style={{ paddingLeft: 34 }}
              placeholder="Buscar por nombre, usuario o rol..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{totalPermisos} permisos en el catálogo</span>
        </div>

        {loading ? (
          <div style={{ color: "var(--text-muted)" }}>Cargando…</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Acceso</th>
                <th>Permisos asignados</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
                        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {inicialesDe(u.nombre)}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{u.nombre}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td>{u.rol || <span style={{ color: "var(--text-muted)" }}>Sin rol</span>}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span className="badge" style={{
                        background: u.is_active ? "var(--accent-success-soft)" : "var(--accent-danger-soft)",
                        color: u.is_active ? "var(--accent-success)" : "var(--accent-danger)",
                      }}>
                        {u.is_active ? "Activo" : "Inactivo"}
                      </span>
                      {u.is_staff && (
                        <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Crown size={11} /> Admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{u.is_staff ? "Todos" : `${u.cantidad_permisos} / ${totalPermisos}`}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {puedeAsignarPermisos && (
                        <button className="btn btn-sm btn-secondary" onClick={() => setUsuarioEditando(u)}>
                          <ShieldCheck size={12} /> Permisos
                        </button>
                      )}
                      {puedeGestionarUsuarios && (
                        <>
                          <button className="btn btn-sm btn-secondary" onClick={() => setUsuarioEditandoDatos(u)}>
                            <Edit2 size={12} /> Editar
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            style={u.is_active ? { color: "var(--accent-danger)" } : undefined}
                            onClick={() => toggleActivo(u)}
                            disabled={u.id === usuarioActual?.id}
                            title={u.id === usuarioActual?.id ? "No puedes desactivar tu propia cuenta" : undefined}
                          >
                            <Power size={12} /> {u.is_active ? "Desactivar" : "Activar"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                  Sin usuarios que coincidan con la búsqueda.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {usuarioEditando && (
        <PermisosDrawer
          usuario={usuarioEditando}
          catalogo={catalogo}
          onClose={() => setUsuarioEditando(null)}
          toast={toast}
          onGuardado={onGuardado}
        />
      )}

      {creandoUsuario && (
        <CrearUsuarioDrawer
          onClose={() => setCreandoUsuario(false)}
          toast={toast}
          onCreado={onCreado}
          puedeAsignarStaff={puedeAsignarStaff}
          roles={roles}
        />
      )}

      {usuarioEditandoDatos && (
        <EditarUsuarioDrawer
          usuario={usuarioEditandoDatos}
          onClose={() => setUsuarioEditandoDatos(null)}
          toast={toast}
          onGuardado={onUsuarioGuardado}
          esUnoMismo={usuarioEditandoDatos.id === usuarioActual?.id}
          puedeAsignarStaff={puedeAsignarStaff}
          roles={roles}
        />
      )}

      {toastState && <Toast message={toastState.msg} type={toastState.type} onClose={() => setToastState(null)} />}
    </div>
  );
}
