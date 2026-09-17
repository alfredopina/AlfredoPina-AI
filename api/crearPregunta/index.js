// crearPregunta/index.js
// Function protegida (rol "admin"): upsert de una pregunta — si el body trae
// id, edita; si no, da de alta una nueva (uuid nuevo). El admin siempre pide
// esto con la MISMA sección que ya tenía la pregunta (no hay selector de
// sección en el form de edición, la sección la fija de qué lista se abrió el
// form) — no hace falta contemplar un cambio de PartitionKey al editar.
//
// Vive en Table Storage, no en SQL (2026-09-16) — ver encuesta-tables.js.
const crypto = require("crypto");
const { getEncuestaPreguntasTable, ensureTable, SECCIONES, TIPOS } = require("../src/encuesta-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = (body.id || "").trim() || null;
  const seccion = (body.seccion || "").trim();
  const texto = (body.texto || "").trim();
  const tipo = (body.tipo || "").trim();
  const orden = Number.isFinite(Number(body.orden)) ? Number(body.orden) : 0;
  const activa = body.activa !== false;

  if (!SECCIONES.includes(seccion)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Sección inválida." } };
    return;
  }
  if (!TIPOS.includes(tipo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Tipo inválido." } };
    return;
  }
  if (!texto) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el texto de la pregunta." } };
    return;
  }

  try {
    const table = getEncuestaPreguntasTable();
    await ensureTable(table);
    const idFinal = id || crypto.randomUUID();

    await table.upsertEntity({ partitionKey: seccion, rowKey: idFinal, texto, tipo, orden, activa }, "Replace");
    context.res = { status: 200, headers: JSON_HEADERS, body: { id: idFinal } };
  } catch (err) {
    context.log.error("Error guardando la pregunta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar: " + err.message } };
  }
};
