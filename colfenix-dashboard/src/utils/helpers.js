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

// Tiempo relativo corto (ej. "hace 4 min", "hace 2 d") para listas donde
// la fecha exacta importa menos que "qué tan reciente es esto" -- ej. el
// Centro de notificaciones del portal. Cae a formatFecha() pasada una
// semana, donde "hace 9 d" deja de ser más útil que la fecha real.
export function formatFechaRelativa(dateStr) {
  if (!dateStr) return "—";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return "justo ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `hace ${dias} d`;
  return formatFecha(dateStr);
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

// Duración legible (ej. "2h 15m", "1d 4h") a partir de una cantidad de horas
// (no ms) — así se recibe desde el backend (horas_habiles_entre ya devuelve
// horas). null/undefined -> "—".
export function formatDuracionHoras(horas) {
  if (horas == null) return "—";
  const totalMin = Math.round(horas * 60);
  const dias = Math.floor(totalMin / 1440);
  const horasResto = Math.floor((totalMin % 1440) / 60);
  const minutos = totalMin % 60;
  if (dias > 0) return `${dias}d ${horasResto}h`;
  if (horasResto > 0) return `${horasResto}h ${minutos}m`;
  return `${Math.max(1, minutos)}m`;
}

export function generarIdInforme(informes) {
  const anio = new Date().getFullYear();
  const siguiente = informes.length + 1;
  return `INF-${anio}-${String(siguiente).padStart(3, "0")}`;
}

// "#4f8cff" -> "FF4F8CFF" (ARGB de ExcelJS: alfa + RGB). Acepta también la
// forma corta "#48f". Cae al color dado en `fallback` si el input no es un
// hex válido -- usado por todos los modales de "Configurar exportación"
// (Novedades, Trazabilidad, Métricas de analistas) para el color de
// encabezado que elige el usuario.
export function hexToArgb(hex, fallback = "4F8CFF") {
  let limpio = String(hex || "").replace("#", "").trim().toUpperCase();
  if (/^[0-9A-F]{3}$/.test(limpio)) {
    limpio = limpio.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9A-F]{6}$/.test(limpio)) limpio = fallback;
  return `FF${limpio}`;
}

// Duración en palabras completas (ej. "1 hora 13 minutos", "2 días 3
// horas") a partir de una cantidad de horas -- a diferencia de
// formatDuracionHoras (abreviada: "1h 13m"), esta es la que se usa en las
// exportaciones a Excel que incluyen el campo SLA, para que el tiempo real
// transcurrido quede legible en un reporte impreso, no solo en pantalla.
export function formatDuracionLarga(horas) {
  if (horas == null) return "—";
  const totalMin = Math.round(Math.abs(horas) * 60);
  const dias = Math.floor(totalMin / 1440);
  const horasResto = Math.floor((totalMin % 1440) / 60);
  const minutos = totalMin % 60;
  const partes = [];
  if (dias > 0) partes.push(`${dias} ${dias === 1 ? "día" : "días"}`);
  if (horasResto > 0) partes.push(`${horasResto} ${horasResto === 1 ? "hora" : "horas"}`);
  if (minutos > 0 || partes.length === 0) partes.push(`${minutos} ${minutos === 1 ? "minuto" : "minutos"}`);
  return partes.join(" ");
}

// "YYYY-MM-DD" -> "DD/MM/YYYY", para mostrar el rango elegido en los
// modales de "Configurar exportación" (inputs <input type="date"> ya
// entregan/reciben ese formato ISO corto).
export function formatFechaCortaISO(iso) {
  const [y, m, d] = String(iso || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : (iso || "");
}

// Texto -> slug para nombres de archivo exportados (ej. "Flota La Macarena"
// -> "flota_la_macarena").
export function slug(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
