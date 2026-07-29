import { useEffect } from "react";
import { X } from "lucide-react";

// Diálogo centrado compartido por el dashboard (a diferencia de DrawerPanel,
// que se desliza desde el lado derecho). Pensado para contenido que necesita
// respirar en el centro de la pantalla, como la vista previa de un informe.
export default function Modal({ icon, title, subtitle, onClose, footer, children, size = "md" }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const sizeClass = size === "lg" ? "modal-lg" : size === "xl" ? "modal-xl" : "";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${sizeClass}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{icon}{title}</div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {subtitle && (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: -10, marginBottom: 16 }}>
              {subtitle}
            </div>
          )}
          {children}
        </div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
