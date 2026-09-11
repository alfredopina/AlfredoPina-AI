// Cliente compartido de Azure Table Storage para el panel Pendientes —
// captura rápida de notas de Alfredo, deliberadamente en Table Storage y no
// en la base SQL del backoffice: el punto de esta herramienta es capturar al
// instante, sin el auto-pause de 20-60s que sí se tolera en el resto del
// backoffice. Reusa el mismo Storage Account/Application Setting que Cursos/
// Recursos/Temas (RECURSOS_STORAGE_CONNECTION) — infraestructura compartida,
// tabla independiente.
const { TableClient } = require("@azure/data-tables");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

// Se crea sola la primera vez que alguien escribe — mismo criterio que
// Temas/TemariosEstandar/Proyectos, Alfredo no tiene que tocar el portal.
async function ensureTable(tableClient) {
  try {
    await tableClient.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err; // 409 = la tabla ya existe, se ignora
  }
  return tableClient;
}

function getPendientesTable() {
  return TableClient.fromConnectionString(getConnectionString(), "Pendientes");
}

// true si el error es porque la tabla todavía no existe (nadie ha guardado
// nada todavía) — se debe tratar como "sin pendientes", no como error 500.
function isTableNotFound(err) {
  if (!err || err.statusCode !== 404) return false;
  return /TableNotFound/i.test(err.code || "") || /table.*not.*found/i.test(err.message || "");
}

// 5 categorías fijas — PartitionKey. Sin más por ahora, a propósito.
const CATEGORIAS = ["comercial", "operacion", "productos", "marca", "sitio"];

module.exports = { getPendientesTable, ensureTable, isTableNotFound, CATEGORIAS };
