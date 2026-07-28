// Ruta relativa: el dev server de React (ver src/setupProxy.js) reenvía
// /api, /admin y /media a Django en localhost:8000. Así el navegador solo
// ve un origen (el del propio frontend), tanto en localhost como por túnel.
export const API_BASE = process.env.REACT_APP_API_BASE || "";
