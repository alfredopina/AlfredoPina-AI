// getMetricasDesde/index.js
// Function protegida (rol "admin"): el rango "contar desde / hasta" de cada Tracking con tarjetas acumuladas
// ({ solicitudes: { desde, hasta }, … }; null = sin límite). Configuración → Métricas de los Tracking. Ver api/src/metricas-desde.js.
const { getMetricasRango } = require("../src/metricas-desde");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    context.res = { status: 200, headers: { ...JSON_HEADERS, "Cache-Control": "no-store" }, body: await getMetricasRango() };
  } catch (err) {
    context.log.error("Error leyendo el rango de métricas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo leer." } };
  }
};
