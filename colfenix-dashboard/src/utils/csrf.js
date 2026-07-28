export function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

// Cuando frontend y backend viven en hosts distintos (túnel de desarrollo),
// JS no puede leer la cookie 'csrftoken' que puso el backend en su propio
// dominio. App.jsx guarda aquí el valor que Django devuelve en el body de
// /api/csrf/ para usarlo como respaldo.
let cachedCsrfToken = null;

export function setCsrfToken(token) {
  cachedCsrfToken = token;
}

export function getCsrfToken() {
  return getCookie("csrftoken") || cachedCsrfToken;
}
