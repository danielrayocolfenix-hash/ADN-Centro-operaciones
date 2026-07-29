import React from "react";
import {
  LayoutDashboard, Users, Wrench, AlertTriangle, FileText,
  Radio, MapPin, Clock, BarChart3, Settings, ShieldCheck, BookOpen,
} from "lucide-react";
import { API_BASE } from "../../config/api";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { tienePermiso } from "../../utils/permisos";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Principal", permiso: "vista.dashboard" },
  { id: "monitoreo", label: "Monitoreo en vivo", icon: Radio, group: "Principal", permiso: "vista.monitoreo" },
  { id: "clientes", label: "Clientes", icon: Users, group: "Operaciones", permiso: "vista.clientes" },
  { id: "novedades", label: "Novedades", icon: AlertTriangle, group: "Operaciones", badgeKey: "alertas", permiso: "vista.novedades" },
  { id: "mantenimientos", label: "Mantenimientos", icon: Wrench, group:"Operaciones", permiso: "vista.mantenimientos" },
  { id: "informes", label: "Informes legales", icon: FileText, group: "Operaciones", permiso: "vista.informes" },
  {
    // Antes "Motivos de negativa" tenía su propia página — ahora ese catálogo
    // (junto con el nuevo de Motivos de positiva) vive dentro de esta misma
    // pantalla de SLA de revisión, para no repartir la configuración del
    // flujo de DVR en varios lugares distintos.
    id: "administracion/sla", label: "Configuración de novedades", icon: Clock,
    group: "Administración", activeId: "administracion", permiso: "vista.administracion_novedades",
  },
  {
    id: "administracion/metricas-analistas", label: "Métricas de analistas", icon: BarChart3,
    group: "Administración", activeId: "administracion", permiso: "vista.administracion_metricas",
  },

  {
    id: "administracion/usuarios", label: "Usuarios y permisos", icon: ShieldCheck,
    group: "Administración", activeId: "administracion", permiso: "vista.administracion_usuarios",
  },
  // Sin `permiso` -- visible para cualquier usuario. Pantalla propia con
  // recorridos guiados (Driver.js) "en vivo" sobre novedades reales.
  { id: "manual", label: "Manual de uso", icon: BookOpen, group: "Ayuda" },
];

export default function Sidebar({ active, onNavigate, alertCount, user }) {
  const { config } = useSiteConfig();
  const visibles = navItems.filter((i) => !i.permiso || tienePermiso(user, i.permiso));
  const groups = [...new Set(visibles.map(i => i.group))];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          {config.logo ? (
            <img className="logo-img" src={`${API_BASE}${config.logo}`} alt={config.nombre_sitio} />
          ) : (
            <div className="logo-icon">
              <MapPin size={18} color="white" />
            </div>
          )}
          <div className="logo-text">
            <strong>{config.nombre_sitio}</strong>
            <span>{config.descripcion_sidebar}</span>
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
                <span className="nav-item-icon"><item.icon size={16} /></span>
                {item.label}
                {item.badgeKey === "alertas" && alertCount > 0 && (
                  <span className="nav-badge">{alertCount}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
