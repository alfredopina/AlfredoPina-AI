// reiniciarMetricas/index.js
// Function protegida (rol "admin"): { tracking: "solicitudes"|"cotizaciones"|"grupos", accion, desde?, hasta? }.
//   "reiniciar" = las tarjetas acumuladas de ese Tracking cuentan desde AHORA · "quitar" = vuelven a contar todo ·
//   "rango" = de la fecha `desde` a la fecha `hasta` ("YYYY-MM-DD", el día "hasta" cuenta completo; cualquiera puede ir vacía).
// No borra datos: solo guarda el rango (api/src/metricas-desde.js). Regresa el rango de todos los Trackings.
const { cambiarMetricasDesde } = require("../src/metricas-desde");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const b = req.body || {};
  try {
    context.res = { status: 200, headers: JSON_HEADERS, body: await cambiarMetricasDesde(String(b.tracking || ""), String(b.accion || ""), { desde: b.desde, hasta: b.hasta }) };
  } catch (err) {
    const validacion = /Tracking|Acción|fecha|Elige/.test(err.message);
    if (!validacion) context.log.error("Error cambiando el rango de métricas:", err.message);
    context.res = { status: validacion ? 400 : 500, headers: JSON_HEADERS, body: { error: validacion ? err.message : "No se pudo guardar." } };
  }
};
