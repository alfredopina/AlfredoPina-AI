// generarReporteDiagnostico/index.js
// Function protegida (rol "admin"): arma el snapshot de un Reporte de
// Diagnóstico (General/Grupos/Individual) a partir de los mismos filtros que
// usa Resultados (Herramienta+Empresa+fechas) y lo guarda en Table Storage
// con un token opaco nuevo — la página pública solo lee ese snapshot, nunca
// vuelve a tocar SQL (ver api/src/diagnostico-reporte-tables.js). Cada clic
// en "Generar reporte" crea un token nuevo (no se reusa/actualiza uno viejo)
// — más simple para el MVP; si Alfredo quiere "mismo link, datos frescos" más
// adelante, se agrega ahí.
const { getPool, sql } = require("../src/backoffice-db");
const { calcularReporte } = require("../src/diagnostico-reporte-calc");
const { getDiagnosticoReportesTable, leerReporte, guardarReporte } = require("../src/diagnostico-reporte-tables");
const { codigoCortoUnico } = require("../src/codigo-corto");
const { JSON_HEADERS } = require("../src/http");

const HERRAMIENTAS = ["excel", "powerbi"];

module.exports = async function (context, req) {
  const { herramienta, clienteId, clienteNombre, desde, hasta } = req.body || {};

  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }
  const clienteIdNum = Number(clienteId);
  if (!Number.isInteger(clienteIdNum) || clienteIdNum <= 0) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el cliente." } };
    return;
  }

  try {
    const pool = await getPool();
    const snapshot = await calcularReporte(pool, sql, {
      herramienta,
      clienteId: clienteIdNum,
      clienteNombre: clienteNombre || "",
      desde: desde || null,
      hasta: hasta || null,
    });

    const table = getDiagnosticoReportesTable();
    const token = await codigoCortoUnico(async (candidato) => Boolean(await leerReporte(table, candidato)));
    await guardarReporte(table, {
      token,
      herramienta,
      clienteId: clienteIdNum,
      clienteNombre: clienteNombre || "",
      desde: desde || null,
      hasta: hasta || null,
      snapshot,
    });

    context.res = { status: 200, headers: JSON_HEADERS, body: { token } };
  } catch (err) {
    context.log.error("Error generando el reporte de diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo generar el reporte: " + err.message } };
  }
};
