// Cliente compartido de Azure Table Storage y Blob Storage para el módulo de Recursos.
// La cadena de conexión vive en la Application Setting RECURSOS_STORAGE_CONNECTION
// del Static Web App (nunca en el repo) — mismo patrón que OUTLOOK_ICS_URL en Agenda.
const { TableClient } = require("@azure/data-tables");
const { BlobServiceClient } = require("@azure/storage-blob");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

function getCursosTable() {
  return TableClient.fromConnectionString(getConnectionString(), "Cursos");
}

function getRecursosTable() {
  return TableClient.fromConnectionString(getConnectionString(), "Recursos");
}

// Contador de intentos fallidos de código por curso (rate limiting de
// getRecursos) — a diferencia de Cursos/Recursos, esta tabla se crea sola la
// primera vez que se escribe, igual que las tablas del módulo Cursos.
async function getIntentosCodigoTable() {
  const table = TableClient.fromConnectionString(getConnectionString(), "IntentosCodigo");
  try {
    await table.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err; // 409 = la tabla ya existe, se ignora
  }
  return table;
}

// Contenedor Blob "recursos" (nivel de acceso "Blob" — lectura anónima por archivo).
function getRecursosContainer() {
  const serviceClient = BlobServiceClient.fromConnectionString(getConnectionString());
  return serviceClient.getContainerClient("recursos");
}

module.exports = { getCursosTable, getRecursosTable, getRecursosContainer, getIntentosCodigoTable };
