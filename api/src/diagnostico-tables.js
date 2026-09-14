// Cliente compartido de Azure Table Storage para el banco de preguntas del
// Diagnóstico — movido de Azure SQL a Table Storage (2026-09-13) porque el
// auto-pause de la base serverless (20-60s) podía dejar a la primera persona
// que abre el link en vivo esperando o de plano sin poder entrar. Table
// Storage nunca se pausa, así que cargar diagnostico.html ya no depende de
// que la base SQL esté despierta. Las respuestas (DiagnosticoRespuesta/
// DiagnosticoRespuestaDetalle) se QUEDAN en SQL sin cambios de fondo — solo
// el banco de preguntas se mueve, para no perder los reportes cruzados con
// Cliente que sí necesitan esas tablas. Ver CLAUDE.md → Diagnóstico.
//
// Mismo Storage Account/Application Setting que Cursos/Recursos/Temas/
// Pendientes (RECURSOS_STORAGE_CONNECTION) — infraestructura compartida,
// tabla independiente, autocreada por código (Alfredo no toca el portal).
const { TableClient } = require("@azure/data-tables");

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

function getDiagnosticoPreguntasTable() {
  return TableClient.fromConnectionString(getConnectionString(), "DiagnosticoPreguntas");
}

function isTableNotFound(err) {
  if (!err || err.statusCode !== 404) return false;
  return /TableNotFound/i.test(err.code || "") || /table.*not.*found/i.test(err.message || "");
}

const HERRAMIENTAS = ["excel", "powerbi"];

// PartitionKey = herramienta, RowKey = id (uuid). Los nombres de propiedad se
// dejan idénticos a los que ya usaba la tabla SQL (snake_case) para no tener
// que tocar diagnostico.html ni el admin más de lo necesario.
function entidadAPregunta(e, { conCorrecta }) {
  const p = {
    id: e.rowKey,
    herramienta: e.partitionKey,
    nivel: e.nivel,
    texto: e.texto || "",
    imagen_url: e.imagen_url || "",
    opcion_a: e.opcion_a || "",
    opcion_b: e.opcion_b || "",
    opcion_c: e.opcion_c || "",
    opcion_d: e.opcion_d || "",
    orden: typeof e.orden === "number" ? e.orden : 0,
    activa: !!e.activa,
  };
  if (conCorrecta) p.opcion_correcta = e.opcion_correcta || "";
  return p;
}

// Todas las preguntas de una herramienta (activas e inactivas) — quien llama
// filtra/ordena/oculta opcion_correcta según lo que necesite.
async function listarPreguntas(table, herramienta) {
  const items = [];
  try {
    const entidades = table.listEntities({ queryOptions: { filter: `PartitionKey eq '${herramienta}'` } });
    for await (const e of entidades) items.push(e);
  } catch (err) {
    if (!isTableNotFound(err)) throw err;
  }
  return items;
}

module.exports = {
  getDiagnosticoPreguntasTable,
  ensureTable,
  isTableNotFound,
  HERRAMIENTAS,
  entidadAPregunta,
  listarPreguntas,
};
