// getConfiguracionNotificaciones/index.js
// Function protegida (rol "admin"): los 3 umbrales configurables (días para
// considerar cada señal "urgente") — ver api/src/notificaciones-config.js.
const { getUmbrales } = require("../src/notificaciones-config");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const umbrales = await getUmbrales();
    context.res = { status: 200, headers: JSON_HEADERS, body: umbrales };
  } catch (err) {
    context.log.error("Error leyendo umbrales de notificaciones:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron leer los umbrales: " + err.message } };
  }
};
