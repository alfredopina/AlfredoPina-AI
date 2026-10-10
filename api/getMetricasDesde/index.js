// getMetricasDesde/index.js
// Function protegida (rol "admin"): desde qué fecha cuenta cada Tracking sus tarjetas acumuladas
// (Configuración → Métricas de los Tracking). null = cuenta todo. Ver api/src/metricas-desde.js.
const { getMetricasDesde } = require("../src/metricas-desde");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    context.res = { status: 200, headers: { ...JSON_HEADERS, "Cache-Control": "no-store" }, body: await getMetricasDesde() };
  } catch (err) {
    context.log.error("Error leyendo 'contar desde':", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo leer." } };
  }
};
