// getConfiguracionCorreo/index.js
// Function protegida (rol "admin"): los interruptores y destinatarios de Configuración → Notificaciones (avisos por
// correo). Table Storage, nunca SQL. Ver api/src/notificaciones-ajustes.js.
const { getAjustes } = require("../src/notificaciones-ajustes");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    context.res = { status: 200, headers: { ...JSON_HEADERS, "Cache-Control": "no-store" }, body: await getAjustes() };
  } catch (err) {
    context.log.error("Error leyendo los ajustes de correo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron leer los ajustes." } };
  }
};
