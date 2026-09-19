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

// PartitionKey = categoría, RowKey = id (uuid). A diferencia de la tabla SQL
// vieja (un solo "orden" con offset reservado por sección para que Instructor
// y Curso y Materiales nunca se entrelazaran al arrastrar), aquí cada
// categoría es su propia partición — el "orden" solo importa relativo a las
// demás preguntas de la MISMA categoría, sin ningún truco de offset.
//
// Estructura FIJA de la encuesta (Fase 1, 2026-09-19, definida por Alfredo):
// 15 preguntas — 3 categorías de hasta 4 preguntas de escala 1-5 + Globales
// (hasta 2 de escala 1-5 y 1 comentario abierto FIJO). El orden de este
// arreglo es el orden en que se muestran en la encuesta pública Y en el
// admin (homologados a propósito). Sin Activa/Inactiva: con una estructura
// fija, apagar una pregunta rompería la comparabilidad entre grupos.
const CATEGORIAS = ["Curso y Materiales", "Instructor", "Aprendizaje y Aplicación", "Globales"];
const TOPE_ESCALA = { "Curso y Materiales": 4, Instructor: 4, "Aprendizaje y Aplicación": 4, Globales: 2 };
const TIPOS = ["escala", "texto"];

// La pregunta de comentarios es una sola, fija, vive en Globales con este
// RowKey (no un uuid) — el admin solo puede editar su texto, nunca agregar
// otra ni borrarla ("puedes dejarlo fijo para evitar errores").
const COMENTARIO_ID = "comentarios";
const COMENTARIO_CATEGORIA = "Globales";
const COMENTARIO_TEXTO_DEFAULT = "¿Algún comentario adicional que quieras compartir?";
const COMENTARIO_ORDEN = 1000;

// Textos de la escala 1-5 — los mismos para las 14 preguntas de escala,
// editables desde el admin (tabla aparte EncuestaConfig).
const ESCALA_DEFAULT = ["Malo", "Regular", "Bueno", "Muy bueno", "Excelente"];

function entidadAPregunta(e) {
  return {
    id: e.rowKey,
    seccion: e.partitionKey,
    texto: e.texto || "",
    tipo: e.tipo || "escala",
    orden: typeof e.orden === "number" ? e.orden : 0,
    activa: !!e.activa,
    // solo las 2 de escala de Globales lo usan: el encabezado de su columna en
    // Resultados (el texto de la pregunta es largo y editable)
    nombreCorto: e.nombreCorto || "",
  };
}

function getEncuestaConfigTable() {
  return TableClient.fromConnectionString(getConnectionString(), "EncuestaConfig");
}

async function leerEscala(configTable) {
  try {
    const e = await configTable.getEntity("config", "escala");
    return ESCALA_DEFAULT.map((def, i) => ((e["e" + (i + 1)] || "").toString().trim() || def));
  } catch (err) {
    if (err.statusCode === 404 || isTableNotFound(err)) return ESCALA_DEFAULT.slice();
    throw err;
  }
}

async function guardarEscala(configTable, textos) {
  await ensureTable(configTable);
  const entidad = { partitionKey: "config", rowKey: "escala" };
  textos.forEach((t, i) => { entidad["e" + (i + 1)] = t; });
  await configTable.upsertEntity(entidad, "Replace");
}

// Crea la pregunta de comentarios si todavía no existe (idempotente) — solo la
// llama listPreguntasAdmin, para que el admin siempre la vea disponible sin
// tener que "crearla" ni poder crear una segunda.
async function asegurarComentario(table) {
  await ensureTable(table);
  try {
    await table.getEntity(COMENTARIO_CATEGORIA, COMENTARIO_ID);
  } catch (err) {
    if (err.statusCode !== 404) throw err;
    await table.upsertEntity(
      { partitionKey: COMENTARIO_CATEGORIA, rowKey: COMENTARIO_ID, texto: COMENTARIO_TEXTO_DEFAULT, tipo: "texto", orden: COMENTARIO_ORDEN, activa: true },
      "Replace"
    );
  }
}

// El banco "vigente" — solo las categorías de la estructura fija (cualquier
// partición vieja que haya quedado de la estructura anterior se ignora).
function bancoVigente(entidades) {
  return entidades.filter((e) => CATEGORIAS.includes(e.partitionKey) && e.activa !== false);
}

// Orden de despliegue: categoría (CATEGORIAS) y dentro de ella "orden".
function compararPreguntas(a, b) {
  const ca = CATEGORIAS.indexOf(a.seccion), cb = CATEGORIAS.indexOf(b.seccion);
  if (ca !== cb) return ca - cb;
  return a.orden - b.orden;
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
  getEncuestaConfigTable,
  ensureTable,
  isTableNotFound,
  CATEGORIAS,
  TOPE_ESCALA,
  TIPOS,
  COMENTARIO_ID,
  COMENTARIO_CATEGORIA,
  COMENTARIO_ORDEN,
  ESCALA_DEFAULT,
  entidadAPregunta,
  bancoVigente,
  compararPreguntas,
  leerEscala,
  guardarEscala,
  asegurarComentario,
  listarPreguntas,
  listarTodas,
};
