// eliminarReporteCalificaciones/index.js
// Function protegida (rol "admin"): borra un reporte generado por su token.
// NO es excepción a "nunca borrar datos de verdad" — un reporte es un
// snapshot derivado (ver calificaciones-reportes.js); las calificaciones en
// SQL no se tocan y se puede volver a generar. El front pide confirmación
// igual, porque el link ya compartido deja de funcionar.
const { getCalificacionesReportesTable, eliminarReporteCalificaciones } = require("../src/calificaciones-reportes");
const { CODIGO_CORTO_RE } = require("../src/codigo-corto");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const token = String((req.body || {}).token || "").trim();
  if (!CODIGO_CORTO_RE.test(token)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el token del reporte." } };
    return;
  }

  try {
    await eliminarReporteCalificaciones(getCalificacionesReportesTable(), token);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    if (err.statusCode === 404) {
      context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
      return;
    }
    context.log.error("Error eliminando el reporte de calificaciones:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el reporte: " + err.message } };
  }
};
