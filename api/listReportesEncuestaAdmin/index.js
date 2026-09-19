// listReportesEncuestaAdmin/index.js
// Function protegida (rol "admin"): lista los reportes de Encuestas ya
// generados para la pestaña "Reportes" — solo campos chicos (proyección
// `select`, ver listarReportesEncuesta), sin unir ni parsear el snapshot
// completo de cada fila.
const { getEncuestaReportesTable, listarReportesEncuesta } = require("../src/encuesta-reportes");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const lista = await listarReportesEncuesta(getEncuestaReportesTable());
    lista.sort((a, b) => new Date(b.generadoEn) - new Date(a.generadoEn));
    context.res = { status: 200, headers: JSON_HEADERS, body: lista };
  } catch (err) {
    context.log.error("Error listando los reportes de encuestas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los reportes: " + err.message } };
  }
};
