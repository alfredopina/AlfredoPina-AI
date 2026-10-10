// reiniciarMetricas/index.js
// Function protegida (rol "admin"): { tracking: "solicitudes"|"cotizaciones"|"grupos", accion: "reiniciar"|"quitar" }.
// "reiniciar" = las tarjetas acumuladas de ese Tracking cuentan desde AHORA; "quitar" = vuelven a contar todo. No borra
// datos: solo guarda una fecha (api/src/metricas-desde.js).
const { cambiarMetricasDesde } = require("../src/metricas-desde");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const b = req.body || {};
  try {
    context.res = { status: 200, headers: JSON_HEADERS, body: await cambiarMetricasDesde(String(b.tracking || ""), String(b.accion || "")) };
  } catch (err) {
    const validacion = /Tracking|Acción/.test(err.message);
    if (!validacion) context.log.error("Error cambiando 'contar desde':", err.message);
    context.res = { status: validacion ? 400 : 500, headers: JSON_HEADERS, body: { error: validacion ? err.message : "No se pudo guardar." } };
  }
};
