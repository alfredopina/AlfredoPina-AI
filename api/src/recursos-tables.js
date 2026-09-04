// Cliente compartido de Azure Table Storage para el módulo de Recursos.
// La cadena de conexión vive en la Application Setting RECURSOS_STORAGE_CONNECTION
// del Static Web App (nunca en el repo) — mismo patrón que OUTLOOK_ICS_URL en Agenda.
const { TableClient } = require("@azure/data-tables");

function getCursosTable() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return TableClient.fromConnectionString(conn, "Cursos");
}

function getRecursosTable() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return TableClient.fromConnectionString(conn, "Recursos");
}

module.exports = { getCursosTable, getRecursosTable };
