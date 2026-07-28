// Genera código abreviado de 6 caracteres a partir del nombre del cliente
export function generarCodigoCliente(razonSocial) {
  if (!razonSocial) return "";
  
  // Palabras ignoradas
  const stopWords = ["de", "del", "la", "los", "las", "el", "y", "e", "s.a.", "s.a.s", "ltda", "sas", "sa", "co", "s.a.s.", "ltda."];
  
  const palabras = razonSocial
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter((p) => p.length > 0 && !stopWords.includes(p.toLowerCase()));

  if (palabras.length === 0) return razonSocial.substring(0, 6).toUpperCase();
  
  if (palabras.length === 1) {
    return palabras[0].substring(0, 6).padEnd(6, "X");
  }

  // Tomar primeras letras de las palabras principales
  let codigo = "";
  for (const palabra of palabras) {
    if (codigo.length < 6) {
      const letras = Math.min(Math.ceil(6 / palabras.length), palabra.length);
      codigo += palabra.substring(0, letras);
    }
  }
  return codigo.substring(0, 6).padEnd(6, "X");
}

export function formatFecha(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatFechaHora(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function getPrioridadColor(prioridad) {
  switch (prioridad) {
    case "Alta": return "#EF4444";
    case "Media": return "#F59E0B";
    case "Baja": return "#22C55E";
    default: return "#6B7280";
  }
}

export function getEstadoColor(estado) {
  switch (estado) {
    case "Abierta": return { bg: "#FEF3C7", text: "#92400E" };
    case "En proceso": return { bg: "#DBEAFE", text: "#1E40AF" };
    case "Cerrada": return { bg: "#D1FAE5", text: "#065F46" };
    case "Requiere informe": return { bg: "#FEE2E2", text: "#991B1B" };
    default: return { bg: "#F3F4F6", text: "#374151" };
  }
}

export function getVehiculoEstadoColor(estado) {
  switch (estado) {
    case "En ruta": return "#22C55E";
    case "Detenido": return "#F59E0B";
    case "Sin señal": return "#EF4444";
    default: return "#6B7280";
  }
}

export function generarIdNovedad(novedades) {
  const anio = new Date().getFullYear();
  const siguiente = novedades.length + 1;
  return `NOV-${anio}-${String(siguiente).padStart(3, "0")}`;
}

export function generarIdInforme(informes) {
  const anio = new Date().getFullYear();
  const siguiente = informes.length + 1;
  return `INF-${anio}-${String(siguiente).padStart(3, "0")}`;
}
