// actualizarConfiguracionCorreo/index.js
// Function protegida (rol "admin"): guarda UNO o varios ajustes de los avisos por correo (interruptor general,
// uno por tipo, o los destinatarios del resumen semanal). Valida en el servidor (api/src/notificaciones-ajustes.js).
const { actualizarAjustes } = require("../src/notificaciones-ajustes");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const ajustes = await actualizarAjustes(req.body || {});
    context.res = { status: 200, headers: JSON_HEADERS, body: ajustes };
  } catch (err) {
    // los errores de validación (correo mal escrito, valor no booleano) llevan mensaje en español para mostrarse tal cual
    const validacion = /correo|Máximo|verdadero|nada que guardar/.test(err.message);
    if (!validacion) context.log.error("Error guardando los ajustes de correo:", err.message);
    context.res = { status: validacion ? 400 : 500, headers: JSON_HEADERS, body: { error: validacion ? err.message : "No se pudo guardar." } };
  }
};
