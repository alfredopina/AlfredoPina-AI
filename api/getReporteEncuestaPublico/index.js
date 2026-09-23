// getReporteEncuestaPublico/index.js
// Function PÚBLICA (reporte-encuesta.html no tiene sesión, igual que el
// reporte de Diagnóstico): lee un snapshot ya calculado de Table Storage por
// su token opaco — nunca toca SQL, así la página carga al instante sin
// depender del auto-pause de apcweb-backoffice.
const { getEncuestaReportesTable, leerReporteEncuesta } = require("../src/encuesta-reportes");
const { CODIGO_CORTO_RE } = require("../src/codigo-corto");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const token = String(req.query.token || "").trim();
  if (!CODIGO_CORTO_RE.test(token)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el token del reporte." } };
    return;
  }

  try {
    const snapshot = await leerReporteEncuesta(getEncuestaReportesTable(), token);
    if (!snapshot) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese reporte no existe o ya no está disponible." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: snapshot };
  } catch (err) {
    context.log.error("Error leyendo el reporte de encuestas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar el reporte." } };
  }
};
