// actualizarUmbralNotificacion/index.js
// Function protegida (rol "admin"): guarda UN umbral a la vez — mismo patrón
// exacto que actualizarTarifa (un campo por llamada, no los 3 juntos).
const { actualizarUmbral } = require("../src/notificaciones-config");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const campo = (body.campo || "").trim();

  try {
    const valor = await actualizarUmbral(campo, body.valor);
    context.res = { status: 200, headers: JSON_HEADERS, body: { campo, valor } };
  } catch (err) {
    context.log.error("Error actualizando umbral de notificaciones:", err.message);
    context.res = {
      status: err.safe ? 400 : 500,
      headers: JSON_HEADERS,
      body: { error: err.safe ? err.message : "No se pudo guardar: " + err.message },
    };
  }
};
