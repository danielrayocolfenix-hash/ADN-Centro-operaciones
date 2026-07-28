import { useEffect } from "react";
import { X } from "lucide-react";

// Panel lateral compartido por todos los modales del dashboard (Novedades,
// Informes, Mantenimientos, Clientes): en vez de un diálogo centrado, se
// desliza desde la derecha, deja ver el listado de fondo y dedica todo el
// alto de la pantalla al contenido. Header/footer quedan fijos y solo el
// contenido central hace scroll.
export default function DrawerPanel({ icon, title, subtitle, onClose, footer, children, width }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" style={width ? { width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-header-info">
            {icon && <div className="drawer-header-icon">{icon}</div>}
            <div style={{ minWidth: 0 }}>
              <div className="drawer-title">{title}</div>
              {subtitle && <div className="drawer-subtitle">{subtitle}</div>}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </div>
  );
}
