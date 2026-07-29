import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_BASE } from "../config/api";

const SiteConfigContext = createContext(null);

const CONFIG_DEFAULT = {
  nombre_sitio: "COLFENIX GPS",
  descripcion_sidebar: "Centro de operaciones",
  logo: null,
  mostrar_reloj_topbar: true,
  mostrar_tema_topbar: true,
  mostrar_alertas_topbar: true,
  mostrar_estado_sistema_topbar: true,
};

// Config global (marca + qué se ve en el topbar), editable desde
// Administración › Configuración del sitio. Se carga una vez al entrar a la
// app y Sidebar/Topbar la consumen directo de acá — así que al guardar
// cambios en esa pantalla, basta con llamar a `refrescar()` para que se
// reflejen sin recargar la página.
export function SiteConfigProvider({ children }) {
  const [config, setConfig] = useState(CONFIG_DEFAULT);
  const [loading, setLoading] = useState(true);

  const refrescar = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/configuracion-sitio/`, { credentials: "include" });
      if (res.ok) setConfig(await res.json());
    } catch {
      // Se queda con los valores por defecto / los últimos conocidos.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refrescar(); }, [refrescar]);

  return (
    <SiteConfigContext.Provider value={{ config, loading, refrescar }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) throw new Error("useSiteConfig debe usarse dentro de <SiteConfigProvider>");
  return ctx;
}
