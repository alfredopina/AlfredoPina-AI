// listReportesDiagnosticoAdmin/index.js
// Function protegida (rol "admin"): lista los reportes de Diagnóstico ya
// generados, para la pestaña propia "Reportes" — lee solo campos chicos
// (proyección `select`, ver listarReportes) sin parsear el snapshot completo
// de cada fila, es una tabla que puede crecer bastante.
const { getDiagnosticoReportesTable, listarReportes } = require("../src/diagnostico-reporte-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const table = getDiagnosticoReportesTable();
    const lista = await listarReportes(table);
    lista.sort((a, b) => new Date(b.generadoEn) - new Date(a.generadoEn));
    context.res = { status: 200, headers: JSON_HEADERS, body: lista };
  } catch (err) {
    context.log.error("Error listando los reportes de diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los reportes: " + err.message } };
  }
};
