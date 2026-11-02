// getMetasAdmin/index.js
// Function protegida (rol "admin", cerrada por el comodín /api/*): las metas mensuales de dinero del Dashboard → Resumen
// ({ cot, gan, cob }; null = sin meta propia, se usa el promedio de 12 meses). Configuración → Metas. Ver api/src/metas.js.
const { getMetas } = require("../src/metas");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    context.res = { status: 200, headers: { ...JSON_HEADERS, "Cache-Control": "no-store" }, body: await getMetas() };
  } catch (err) {
    context.log.error("Error leyendo las metas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo leer." } };
  }
};
