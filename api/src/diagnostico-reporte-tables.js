// Cliente compartido de Azure Table Storage para los reportes generados del
// Diagnóstico (vista pública de 3 pestañas: General/Grupos/Individual). Cada
// fila es un snapshot YA CALCULADO (nunca se recalcula al abrir el link) —
// mismo motivo que el banco de preguntas (ver diagnostico-tables.js): la
// página pública no puede depender de que apcweb-backoffice esté despierta.
// generarReporteDiagnostico hace el cálculo pesado una sola vez contra SQL y
// lo guarda aquí; getReporteDiagnosticoPublico solo lee esta tabla.
//
// PartitionKey fijo "reporte" (volumen esperado bajo — reportes generados a
// mano, no uno por envío) — RowKey = token opaco (uuid), el mismo valor que
// viaja en el link público. No se expone clienteId en la URL a propósito
// (ver getReporteDiagnosticoPublico) para no permitir enumerar reportes de
// otros clientes.
const { TableClient } = require("@azure/data-tables");
const crypto = require("crypto");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

async function ensureTable(tableClient) {
  try {
    await tableClient.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err; // 409 = la tabla ya existe, se ignora
  }
  return tableClient;
}

function getDiagnosticoReportesTable() {
  return TableClient.fromConnectionString(getConnectionString(), "DiagnosticoReportes");
}

function nuevoToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

async function guardarReporte(table, { token, herramienta, clienteId, clienteNombre, desde, hasta, snapshot }) {
  await ensureTable(table);
  await table.upsertEntity(
    {
      partitionKey: "reporte",
      rowKey: token,
      herramienta,
      clienteId,
      clienteNombre,
      desde: desde || "",
      hasta: hasta || "",
      generadoEn: new Date().toISOString(),
      snapshotJson: JSON.stringify(snapshot),
    },
    "Replace"
  );
}

async function leerReporte(table, token) {
  try {
    const e = await table.getEntity("reporte", token);
    return {
      token: e.rowKey,
      herramienta: e.herramienta,
      clienteId: e.clienteId,
      clienteNombre: e.clienteNombre,
      desde: e.desde || null,
      hasta: e.hasta || null,
      generadoEn: e.generadoEn,
      snapshot: JSON.parse(e.snapshotJson),
    };
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

module.exports = { getDiagnosticoReportesTable, nuevoToken, guardarReporte, leerReporte };
