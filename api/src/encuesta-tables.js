// Cliente compartido de Azure Table Storage para el banco de preguntas de
// Encuestas — movido de Azure SQL a Table Storage (2026-09-16, mismo criterio
// ya aplicado a Diagnóstico el 2026-09-13, ver CLAUDE.md → Encuestas): el
// auto-pause de la base serverless (20-60s) podía dejar al primer alumno que
// abre el link en vivo (durante la sesión de cierre) esperando o de plano sin
// poder entrar. Table Storage nunca se pausa, así que cargar encuesta.html ya
// no depende de que la base SQL esté despierta. Las respuestas
// (EncuestaRespuesta/EncuestaRespuestaDetalle) se QUEDAN en SQL sin cambios
// de fondo — solo el banco de preguntas se mueve, para no perder el FK real a
// Cliente que sí necesita esa tabla.
//
// Mismo Storage Account/Application Setting que Cursos/Recursos/Temas/
// Pendientes/DiagnosticoPreguntas (RECURSOS_STORAGE_CONNECTION) —
// infraestructura compartida, tabla independiente, autocreada por código
// (Alfredo no toca el portal).
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

function getEncuestaPreguntasTable() {
  return TableClient.fromConnectionString(getConnectionString(), "EncuestaPreguntas");
}

function isTableNotFound(err) {
  if (!err || err.statusCode !== 404) return false;
  return /TableNotFound/i.test(err.code || "") || /table.*not.*found/i.test(err.message || "");
}

// PartitionKey = sección, RowKey = id (uuid). A diferencia de la tabla SQL
// vieja (un solo "orden" con offset reservado por sección para que Instructor
// y Curso y Materiales nunca se entrelazaran al arrastrar), aquí cada sección
// es su propia partición — el "orden" solo importa relativo a las demás
// preguntas de la MISMA sección, sin ningún truco de offset que mantener.
const SECCIONES = ["Instructor", "Curso y Materiales"];
const TIPOS = ["escala", "texto"];

function entidadAPregunta(e) {
  return {
    id: e.rowKey,
    seccion: e.partitionKey,
    texto: e.texto || "",
    tipo: e.tipo || "escala",
    orden: typeof e.orden === "number" ? e.orden : 0,
    activa: !!e.activa,
  };
}

// Todas las preguntas de una sección (activas e inactivas) — quien llama
// filtra/ordena según lo que necesite.
async function listarPreguntas(table, seccion) {
  const items = [];
  try {
    const entidades = table.listEntities({ queryOptions: { filter: `PartitionKey eq '${seccion}'` } });
    for await (const e of entidades) items.push(e);
  } catch (err) {
    if (!isTableNotFound(err)) throw err;
  }
  return items;
}

// Las 2 secciones completas, de un jalón — usado por listPreguntasAdmin y por
// getPreguntasEncuesta (que además filtra activa=true), en vez de que cada
// Function arme su propio loop.
async function listarTodas(table) {
  const items = [];
  try {
    const entidades = table.listEntities();
    for await (const e of entidades) items.push(e);
  } catch (err) {
    if (!isTableNotFound(err)) throw err;
  }
  return items;
}

module.exports = {
  getEncuestaPreguntasTable,
  ensureTable,
  isTableNotFound,
  SECCIONES,
  TIPOS,
  entidadAPregunta,
  listarPreguntas,
  listarTodas,
};
