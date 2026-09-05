// Cliente compartido de Azure Table Storage para el módulo de Cursos (Temarios).
// Reusa el mismo Storage Account y la misma Application Setting que Recursos
// (RECURSOS_STORAGE_CONNECTION) — son módulos de datos independientes (tablas
// distintas), solo comparten infraestructura para no crear un recurso nuevo.
const { TableClient } = require("@azure/data-tables");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

// A diferencia de Cursos/Recursos (creadas a mano en el portal), estas tablas
// se crean solas la primera vez que alguien escribe — así Alfredo no tiene que
// entrar al portal de Azure a preparar nada antes de usar el módulo.
async function ensureTable(tableClient) {
  try {
    await tableClient.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err; // 409 = la tabla ya existe, se ignora
  }
  return tableClient;
}

function getTemasTable() {
  return TableClient.fromConnectionString(getConnectionString(), "Temas");
}

function getTemariosTable() {
  return TableClient.fromConnectionString(getConnectionString(), "TemariosEstandar");
}

function getProyectosTable() {
  return TableClient.fromConnectionString(getConnectionString(), "Proyectos");
}

// true si el error es porque la tabla todavía no existe (nadie ha guardado
// nada todavía) — se debe tratar como "catálogo vacío", no como error 500.
function isTableNotFound(err) {
  if (!err || err.statusCode !== 404) return false;
  return /TableNotFound/i.test(err.code || "") || /table.*not.*found/i.test(err.message || "");
}

module.exports = { getTemasTable, getTemariosTable, getProyectosTable, ensureTable, isTableNotFound };
