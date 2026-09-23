// eliminarReporteEncuesta/index.js
// Function protegida (rol "admin"): borra un reporte generado por su token.
// NO es una excepción a "nunca borrar datos de verdad" — un reporte es un
// snapshot derivado (ver encuesta-reportes.js); las respuestas en SQL no se
// tocan y se puede volver a generar. El front pide confirmación igualmente,
// porque el link ya compartido deja de funcionar.
const { getEncuestaReportesTable, eliminarReporteEncuesta } = require("../src/encuesta-reportes");
const { CODIGO_CORTO_RE } = require("../src/codigo-corto");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const token = String((req.body || {}).token || "").trim();
  if (!CODIGO_CORTO_RE.test(token)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el token del reporte." } };
    return;
  }

  try {
    await eliminarReporteEncuesta(getEncuestaReportesTable(), token);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    if (err.statusCode === 404) {
      context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
      return;
    }
    context.log.error("Error eliminando el reporte de encuestas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el reporte: " + err.message } };
  }
};
