// getReporteCalificacionesPublico/index.js
// Function PÚBLICA (reporte-resultados.html no tiene sesión, igual que los
// reportes de Diagnóstico y Encuestas): lee un snapshot ya calculado de Table
// Storage por su token opaco — nunca toca SQL, así la página carga al
// instante sin depender del auto-pause de apcweb-backoffice.
const { getCalificacionesReportesTable, leerReporteCalificaciones, registrarVistaReporte } = require("../src/calificaciones-reportes");
const { JSON_HEADERS } = require("../src/http");

const TOKEN_RE = /^[a-f0-9]{32}$/;

module.exports = async function (context, req) {
  const token = String(req.query.token || "").trim();
  if (!TOKEN_RE.test(token)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el token del reporte." } };
    return;
  }

  try {
    const table = getCalificacionesReportesTable();
    const snapshot = await leerReporteCalificaciones(table, token);
    if (!snapshot) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese reporte no existe o ya no está disponible." } };
      return;
    }
    // no debe tumbar la carga del reporte si el contador falla por lo que sea
    registrarVistaReporte(table, token).catch((err) => context.log.error("Error registrando vista del reporte:", err.message));
    context.res = { status: 200, headers: JSON_HEADERS, body: snapshot };
  } catch (err) {
    context.log.error("Error leyendo el reporte de calificaciones:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar el reporte." } };
  }
};
