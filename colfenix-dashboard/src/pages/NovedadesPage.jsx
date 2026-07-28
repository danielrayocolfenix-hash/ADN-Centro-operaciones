import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Plus, FileText, Eye, Edit2, Trash2,
  Building2, ChevronDown, ChevronUp, UserCog,
} from "lucide-react";
import Toast from "../components/ui/Toast";
import DrawerPanel from "../components/ui/DrawerPanel";
import DynamicForm from "../components/DynamicForm/DynamicForm";
import NovedadesTable from "../components/DynamicTable/DynamicTable";
import { getCsrfToken } from "../utils/csrf";
import { API_BASE as API_HOST } from "../config/api";
import { useAuth } from "../context/AuthContext";

const API_BASE = `${API_HOST}/api`;

// Una tarjeta colapsable por cliente, cada una con su propia instancia de
// NovedadesTable (búsqueda, columnas, orden y paginación 100% independientes
// entre clientes, ya que cada instancia mantiene su propio estado interno).
function ClienteGrupo({ cliente, items, actions, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          background: "none", border: "none", cursor: "pointer", padding: 0,
          marginBottom: open ? 16 : 0, fontFamily: "inherit",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Building2 size={16} color="var(--accent-primary)" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{cliente || "Sin cliente"}</span>
          <span className="badge" style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}>
            {items.length} {items.length === 1 ? "novedad" : "novedades"}
          </span>
        </span>
        {open ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </button>
      {open && <NovedadesTable data={items} actions={actions} />}
    </div>
  );
}

function ModalNovedad({ novedad, onClose, onSave, onGenerarInforme }) {
  const isEdit = !!novedad?.id;

  return (
    <DrawerPanel
      icon={<AlertTriangle size={18} />}
      title={isEdit ? "Editar novedad" : "Registrar novedad"}
      subtitle={isEdit ? `Código ${novedad.codigo_novedad}` : "Completa la información para crear una nueva novedad"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          {isEdit && !novedad.tiene_informe && (
            <button className="btn btn-success" onClick={() => onGenerarInforme(novedad)}>
              <FileText size={14} /> Generar informe
            </button>
          )}
          <button type="submit" form="dynamic-form" className="btn btn-primary">
            {isEdit ? "Guardar cambios" : "Registrar novedad"}
          </button>
        </>
      }
    >
      <DynamicForm
        endpoint="/api/formulario/novedades/"
        initialData={novedad}
        onSubmit={onSave}
        hideActions
      />
    </DrawerPanel>
  );
}

// Panel para reasignar el analista responsable de una novedad — solo se abre
// desde la acción de fila "Asignar analista", visible únicamente para
// usuarios is_staff (super usuario). Queda registrado en la Trazabilidad de
// la novedad (NovedadEvento campo="analista") por el backend.
function AsignarAnalistaDrawer({ novedad, analistas, onClose, onAsignar }) {
  const [analistaId, setAnalistaId] = useState(novedad.analista_id || "");
  const [guardando, setGuardando] = useState(false);

  const handleAsignar = async () => {
    if (!analistaId) return;
    setGuardando(true);
    try {
      const ok = await onAsignar(novedad, Number(analistaId));
      if (ok) onClose();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <DrawerPanel
      icon={<UserCog size={18} />}
      title="Asignar analista"
      subtitle={`${novedad.codigo_novedad} · Actualmente: ${novedad.analista || "sin analista"}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleAsignar} disabled={guardando || !analistaId}>
            {guardando ? "Asignando..." : "Asignar"}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Analista</label>
        <select className="form-select" value={analistaId} onChange={(e) => setAnalistaId(e.target.value)}>
          <option value="">Seleccione un analista...</option>
          {analistas.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>
      {analistas.length === 0 && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          No hay usuarios con rol de analista registrados todavía.
        </p>
      )}
    </DrawerPanel>
  );
}

export default function NovedadesPage({ onGenerarInforme }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [analistas, setAnalistas] = useState([]);
  const [novedades, setNovedades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);

  // Trae las novedades reales del backend al montar la página.
  // Antes el estado se inicializaba con mockData y nunca se refrescaba
  // contra el servidor, así que lo creado en sesiones previas no aparecía.
  useEffect(() => {
    let cancelado = false;

    async function cargarNovedades() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(`${API_BASE}/novedades/`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`El servidor respondió ${response.status}`);
        }
        const data = await response.json();
        if (!cancelado) setNovedades(data);
      } catch (err) {
        console.error("Error cargando novedades:", err);
        if (!cancelado) setLoadError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    cargarNovedades();
    return () => { cancelado = true; };
  }, []);

  // El listado de analistas asignables solo lo necesita (y solo puede
  // pedirlo) un usuario is_staff — se evita el fetch para el resto.
  useEffect(() => {
    if (!user?.is_staff) return;
    let cancelado = false;
    fetch(`${API_BASE}/usuarios/analistas/`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (!cancelado) setAnalistas(data); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [user?.is_staff]);

  // Filtro usando los nombres de campo reales que devuelve novedades_view
  // (codigo_novedad, tipo_informe, ruta, estado_novedad, nivel_prioridad),
  // no los del mock viejo (id, tipo, ubicacion, estado, prioridad).
  //
  // En vez de una única tabla con todas las novedades mezcladas, se agrupan
  // por cliente: cada cliente obtiene su propia tarjeta con su propia
  // instancia de NovedadesTable (búsqueda, columnas, orden y paginación
  // 100% independientes entre clientes). Se ordenan por cantidad de
  // novedades descendente, para priorizar visualmente quién tiene más
  // actividad pendiente de revisar.
  const grupos = useMemo(() => {
    const porCliente = new Map();
    for (const n of novedades) {
      const key = n.cliente_id ?? n.cliente ?? "sin-cliente";
      if (!porCliente.has(key)) {
        porCliente.set(key, { key, cliente: n.cliente || n.cliente_id || "Sin cliente", items: [] });
      }
      porCliente.get(key).items.push(n);
    }
    return [...porCliente.values()].sort((a, b) => b.items.length - a.items.length);
  }, [novedades]);

  const handleSave = async (form) => {
    try {
      const isEditing = modal === "editar" && selected;
      // La vista combinada de detalle/edición vive en /api/novedades/<id>/
      // (GET trae el detalle, POST actualiza) — antes esto apuntaba a
      // /api/editar-novedad/<id>/, una ruta que nunca existió en el backend.
      const url = isEditing
        ? `${API_BASE}/novedades/${selected.id}/`
        : `${API_BASE}/crear-novedad/`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
        },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const resultado = await response.json();

      if (!resultado.success) {
        throw new Error(resultado.mensaje || "Error al guardar la novedad");
      }

      if (isEditing) {
        setNovedades((ns) => ns.map((n) => (n.id === selected.id ? { ...n, ...form } : n)));
        setToast({ msg: "Novedad actualizada", type: "success" });
      } else {
        const nueva = { ...form, id: resultado.codigo, codigo_novedad: resultado.codigo, tiene_informe: false };
        setNovedades((ns) => [nueva, ...ns]);
        setToast({ msg: `Novedad ${resultado.codigo} registrada`, type: "success" });
      }

      setModal(null);
      setSelected(null);
    } catch (err) {
      console.error("Error guardando novedad:", err);
      setToast({ msg: `Error: ${err.message}`, type: "error" });
      // OJO: no cierres el modal si falla, para que el usuario no pierda sus datos
    }
  };

  const handleEliminar = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/novedades/${id}/eliminar/`, {
        method: "DELETE",
        headers: {
          "X-CSRFToken": getCsrfToken(),
        },
        credentials: "include",
      });

      const resultado = await response.json();

      if (!resultado.success) {
        throw new Error(resultado.mensaje || "Error al eliminar la novedad");
      }

      setNovedades((ns) => ns.filter((n) => n.id !== id));
      setToast({ msg: "Novedad eliminada", type: "success" });
    } catch (err) {
      console.error("Error eliminando novedad:", err);
      setToast({ msg: `Error: ${err.message}`, type: "error" });
    }
  };

  const handleGenerarInforme = (novedad) => {
    setModal(null);
    setSelected(null);
    onGenerarInforme(novedad);
  };

  const handleAsignar = async (novedad, analistaId) => {
    try {
      const response = await fetch(`${API_BASE}/novedades/${novedad.id}/asignar-analista/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({ analista_id: analistaId }),
      });
      const resultado = await response.json();
      if (!resultado.success) throw new Error(resultado.mensaje || "No se pudo asignar el analista");

      const nuevoAnalista = analistas.find((a) => a.value === analistaId);
      setNovedades((ns) => ns.map((n) => (
        n.id === novedad.id
          ? { ...n, analista_id: analistaId, analista: nuevoAnalista?.label || n.analista }
          : n
      )));
      setToast({ msg: resultado.mensaje, type: "success" });
      return true;
    } catch (err) {
      setToast({ msg: `Error: ${err.message}`, type: "error" });
      return false;
    }
  };

  const alertasCriticas = novedades.filter(
    (n) => n.nivel_prioridad === "Prioridad_Alta" && n.estado_novedad !== "Completado"
  ).length;

  const rowActions = [
    {
      key: "ver",
      label: "Ver detalle",
      tooltip: "Abrir el flujo de revisión DVR de esta novedad",
      icon: <Eye size={14} />,
      onClick: (row) => navigate(`/novedades/${row.id}`),
    },
    {
      key: "generar-informe",
      label: "Generar informe",
      tooltip: "Crear el informe asociado a esta novedad",
      icon: <FileText size={14} />,
      variant: "primary",
      onClick: (row) => onGenerarInforme(row),
      show: (row) => row.estado_novedad !== "Pendiente_por_responder",
    },
    {
      key: "editar",
      label: "Editar",
      tooltip: "Modificar la información de la novedad",
      icon: <Edit2 size={14} />,
      variant: "secondary",
      onClick: (row) => {
        setSelected(row);
        setModal("editar");
      },
    },
    ...(user?.is_staff ? [{
      key: "asignar",
      label: "Asignar analista",
      tooltip: "Reasignar el analista responsable de esta novedad",
      icon: <UserCog size={14} />,
      variant: "secondary",
      onClick: (row) => {
        setSelected(row);
        setModal("asignar");
      },
    }] : []),
    {
      key: "eliminar",
      label: "Eliminar",
      tooltip: "Eliminar permanentemente la novedad",
      icon: <Trash2 size={14} />,
      variant: "danger",
      onClick: (row) => {
        if (
          window.confirm(
            `¿Eliminar la novedad ${row.codigo_novedad}? Esta acción no se puede deshacer.`
          )
        ) {
          handleEliminar(row.id);
        }
      },
    },
  ];

  return (
    <div className="page-shell">
      <div className="hero-panel compact">
        <div>
          <div className="hero-eyebrow">Flujo operatvo</div>
          <h2 className="hero-title">Gestiona novedades, evidencia y decisiones desde un único espacio</h2>
          <p className="hero-text">La vista prioriza los casos críticos, el estado de revisión y la posibilidad de avanzar directamente a la generación del informe.</p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => { setSelected(null); setModal("nuevo"); }}>
            <Plus size={15} /> Registrar novedad
          </button>
        </div>
      </div>

      <div className="hero-metrics">
        <div className="metric-pill"><strong>{novedades.length}</strong> registros</div>
        <div className="metric-pill"><strong>{alertasCriticas}</strong> alertas críticas</div>
        <div className="metric-pill"><strong>{novedades.filter((n) => n.estado_novedad === "Pendiente_por_responder").length}</strong> pendientes</div>
        <div className="metric-pill"><strong>{grupos.length}</strong> clientes</div>
      </div>

      {loading && <div className="card" style={{ color: "var(--text-muted)" }}>Cargando novedades…</div>}
      {loadError && (
        <div className="card" style={{ color: "var(--accent-danger)" }}>
          No se pudieron cargar las novedades: {loadError}
        </div>
      )}

      {!loading && !loadError && grupos.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>
          Sin novedades registradas todavía.
        </div>
      )}

      {!loading && !loadError && grupos.map((grupo) => (
        <ClienteGrupo key={grupo.key} cliente={grupo.cliente} items={grupo.items} actions={rowActions} />
      ))}

      {(modal === "nuevo" || modal === "editar") && (
        <ModalNovedad novedad={modal === "editar" ? selected : null} onClose={() => setModal(null)} onSave={handleSave} onGenerarInforme={handleGenerarInforme} />
      )}
      {modal === "asignar" && selected && (
        <AsignarAnalistaDrawer
          novedad={selected}
          analistas={analistas}
          onClose={() => setModal(null)}
          onAsignar={handleAsignar}
        />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
