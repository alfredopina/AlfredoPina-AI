// eliminarReporteDiagnostico/index.js
// Function protegida (rol "admin"): borra un reporte generado por su token.
// A diferencia de eliminarGrupo/eliminarRespuestaDiagnostico, esto NO es una
// excepción a "nunca borrar datos de verdad" — un Reporte es un snapshot
// derivado/cacheado (ver diagnostico-reporte-tables.js), no el dato fuente:
// las respuestas del Diagnóstico en SQL no se tocan, y el reporte se puede
// volver a generar en cualquier momento. Aun así el front pide confirmación
// fuerte antes de llamar esto (pedido explícito de Alfredo), porque el link
// ya compartido con el cliente deja de funcionar.
const { getDiagnosticoReportesTable, eliminarReporte } = require("../src/diagnostico-reporte-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const token = ((req.body || {}).token || "").trim();
  if (!token) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el token del reporte." } };
    return;
  }

  try {
    const table = getDiagnosticoReportesTable();
    await eliminarReporte(table, token);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    if (err.statusCode === 404) {
      context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
      return;
    }
    context.log.error("Error eliminando el reporte de diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el reporte: " + err.message } };
  }
};
