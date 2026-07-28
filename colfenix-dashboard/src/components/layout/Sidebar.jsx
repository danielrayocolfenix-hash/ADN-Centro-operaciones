import React from "react";
import {
  LayoutDashboard, Users, Wrench, AlertTriangle, FileText,
  Radio, MapPin, LogOut, Clock, BarChart3
} from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Principal" },
  { id: "monitoreo", label: "Monitoreo en vivo", icon: Radio, group: "Principal", badge: null },
  { id: "clientes", label: "Clientes", icon: Users, group: "Operaciones" },
  { id: "novedades", label: "Novedades", icon: AlertTriangle, group: "Operaciones", badgeKey: "alertas" },
  { id: "mantenimientos", label: "Mantenimientos", icon: Wrench, group:"Operaciones" },
  { id: "informes", label: "Informes legales", icon: FileText, group: "Operaciones" },
  {
    // Antes "Motivos de negativa" tenía su propia página — ahora ese catálogo
    // (junto con el nuevo de Motivos de positiva) vive dentro de esta misma
    // pantalla de SLA de revisión, para no repartir la configuración del
    // flujo de DVR en varios lugares distintos.
    id: "administracion/sla", label: "Configuración de novedades", icon: Clock,
    group: "Administración", activeId: "administracion", staffOnly: true,
  },
  {
    id: "administracion/metricas-analistas", label: "Métricas de analistas", icon: BarChart3,
    group: "Administración", activeId: "administracion", staffOnly: true,
  },
];

function inicialesDe(nombre) {
  if (!nombre) return "??";
  const partes = nombre.trim().split(/\s+/);
  const primeras = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() || "");
  return primeras.join("") || "??";
}

export default function Sidebar({ active, onNavigate, alertCount, user, onLogout }) {
  const visibles = navItems.filter((i) => !i.staffOnly || user?.is_staff);
  const groups = [...new Set(visibles.map(i => i.group))];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">
            <MapPin size={18} color="white" />
          </div>
          <div className="logo-text">
            <strong>COLFENIX GPS</strong>
            <span>Centro de operaciones</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {groups.map(group => (
          <div className="nav-group" key={group}>
            <div className="nav-group-label">{group}</div>
            {visibles.filter(i => i.group === group).map(item => (
              <button
                key={item.id}
                className={`nav-item ${active === (item.activeId || item.id) ? "active" : ""}`}
                onClick={() => onNavigate(item.id)}
              >
                <item.icon size={16} />
                {item.label}
                {item.badgeKey === "alertas" && alertCount > 0 && (
                  <span className="nav-badge">{alertCount}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="operator-card">
          <div className="operator-avatar">{inicialesDe(user?.nombre)}</div>
          <div className="operator-info" style={{ minWidth: 0, flex: 1 }}>
            <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.nombre || "—"}
            </strong>
            <span>{user?.rol || "Sin rol asignado"}</span>
          </div>
          {onLogout && (
            <button className="btn-icon" title="Cerrar sesión" onClick={onLogout}>
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
