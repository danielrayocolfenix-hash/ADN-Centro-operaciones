const { createProxyMiddleware } = require("http-proxy-middleware");

// El navegador solo habla con el origen del propio dev server de React
// (el túnel del puerto 3000). Este proxy reenvía /api, /admin y /media
// hacia Django en localhost:8000 desde el propio servidor de desarrollo,
// así que para el navegador es una única "site" y las cookies de sesión
// y CSRF funcionan igual que en desarrollo normal sin túnel.
module.exports = function (app) {
  app.use(
    ["/api", "/admin", "/media"],
    createProxyMiddleware({
      target: "http://localhost:8000",
      changeOrigin: true,
    })
  );
};
