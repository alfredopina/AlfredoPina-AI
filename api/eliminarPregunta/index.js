// eliminarPregunta/index.js
// Function protegida (rol "admin"): borra una pregunta de verdad (no es un
// simple desactivar). Las respuestas históricas que ya la usaron NO se tocan
// — ver el comentario en sql/003_encuestas.sql sobre por qué pregunta_id no
// tiene FK: se vuelve un id huérfano a propósito, y listRespuestasEncuesta lo
// muestra como "(pregunta eliminada)".
//
// Vive en Table Storage, no en SQL (2026-09-16) — necesita seccion
// (PartitionKey) además del id (RowKey) para poder borrar sin recorrer toda
// la tabla; el admin ya conoce la sección de la lista desde donde se llama.
const { getEncuestaPreguntasTable, SECCIONES } = require("../src/encuesta-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = (body.id || "").trim();
  const seccion = (body.seccion || "").trim();

  if (!id || !SECCIONES.includes(seccion)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id o la sección de la pregunta." } };
    return;
  }

  try {
    const table = getEncuestaPreguntasTable();
    try {
      await table.deleteEntity(seccion, id);
    } catch (err) {
      if (err.statusCode === 404) {
        context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa pregunta ya no existe." } };
        return;
      }
      throw err;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando la pregunta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar: " + err.message } };
  }
};
