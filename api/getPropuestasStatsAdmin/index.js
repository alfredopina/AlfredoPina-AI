// getPropuestasStatsAdmin/index.js
// Function protegida (rol "admin"): vistas del cliente y aceptación de TODAS las propuestas, por código — para pintar
// los avisos en el panel Cotizaciones. Solo Table Storage (liviano, nunca despierta la base).
const { getPropuestasTable, listarEstadisticas } = require("../src/propuestas");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    context.res = { status: 200, headers: { ...JSON_HEADERS, "Cache-Control": "no-store" }, body: await listarEstadisticas(getPropuestasTable()) };
  } catch (err) {
    context.log.error("Error leyendo las estadísticas de propuestas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron leer las estadísticas." } };
  }
};
