// getReporteDiagnosticoPublico/index.js
// Function PÚBLICA (reporte-diagnostico.html no tiene sesión, igual que
// getPreguntasDiagnostico): lee un snapshot ya calculado de Table Storage por
// su token opaco — nunca toca SQL, así la página carga instantáneo sin
// depender del auto-pause de apcweb-backoffice (ver diagnostico-reporte-tables.js).
const { getDiagnosticoReportesTable, leerReporte, incrementarVisitas } = require("../src/diagnostico-reporte-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const token = (req.query.token || "").trim();
  if (!token) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el token del reporte." } };
    return;
  }

  try {
    const table = getDiagnosticoReportesTable();
    const reporte = await leerReporte(table, token);
    if (!reporte) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese reporte no existe o ya no está disponible." } };
      return;
    }
    await incrementarVisitas(table, token);
    context.res = { status: 200, headers: JSON_HEADERS, body: reporte };
  } catch (err) {
    context.log.error("Error leyendo el reporte de diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar el reporte: " + err.message } };
  }
};
