// editarRecurso/index.js
// Function protegida (rol "admin"): alta o edición (upsert) de un recurso SIN
// archivo — Skills (texto = el prompt) y Contenido Complementario (url de
// YouTube). También sirve para editar título/texto de un recurso con archivo
// (Manual/Caso/Plantilla) sin tocar el archivo — para reemplazar el archivo
// se usa uploadRecurso con el mismo rowKey.
const crypto = require("crypto");
const { getRecursosTable } = require("../src/recursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const TIPOS = ["manual", "caso", "plantilla", "skill", "extra"];

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const curso = (body.curso || "").trim().toLowerCase();
  const tipo = (body.tipo || "").trim().toLowerCase();
  const titulo = (body.titulo || "").trim();
  const texto = (body.texto || "").trim();
  const url = (body.url || "").trim();
  const rowKey = (body.rowKey || "").trim() || crypto.randomUUID();
  const orden = body.orden !== undefined ? Number(body.orden) : Date.now();

  if (!HERRAMIENTAS.includes(herramienta) || !curso || !TIPOS.includes(tipo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (herramienta, curso o tipo inválido)." } };
    return;
  }
  if (!titulo) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el título del recurso." } };
    return;
  }
  if (tipo === "extra" && !url) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta la URL del recurso complementario." } };
    return;
  }
  if (tipo === "skill" && !texto) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el texto del prompt." } };
    return;
  }

  const partitionKey = `${herramienta}_${curso}`;
  const entity = { partitionKey, rowKey, tipo, titulo, texto, orden };
  if (url) entity.url = url;

  try {
    const recursosTable = getRecursosTable();
    // Merge en vez de Replace: así no se pierde blobPath/url si solo se está
    // editando el título/texto de un recurso con archivo (manual/caso/plantilla).
    await recursosTable.upsertEntity(entity, "Merge");
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, rowKey } };
  } catch (err) {
    context.log.error("Error guardando el recurso:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el recurso: " + err.message } };
  }
};
