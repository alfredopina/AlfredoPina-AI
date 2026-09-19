// eliminarPregunta/index.js
// Function protegida (rol "admin"): borra una pregunta de verdad. Las
// respuestas históricas que ya la usaron NO se tocan — pregunta_id no tiene FK
// (ver sql/003_encuestas.sql) y, desde la Fase 1 de Encuestas, cada respuesta
// guarda además una copia congelada del texto/categoría de la pregunta
// (sql/019), así que el histórico conserva su significado aunque la pregunta
// desaparezca del banco. La pregunta de comentarios es FIJA: no se puede
// borrar (solo editar su texto).
//
// Vive en Table Storage, no en SQL (2026-09-16) — necesita la categoría
// (PartitionKey) además del id (RowKey) para poder borrar sin recorrer toda
// la tabla; el admin ya conoce la categoría de la lista desde donde se llama.
const { getEncuestaPreguntasTable, CATEGORIAS, COMENTARIO_ID } = require("../src/encuesta-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = (body.id || "").trim();
  const categoria = (body.seccion || "").trim();

  if (!id || !CATEGORIAS.includes(categoria)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id o la categoría de la pregunta." } };
    return;
  }
  if (id === COMENTARIO_ID) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "La pregunta de comentarios es fija — solo se puede editar su texto." } };
    return;
  }

  try {
    const table = getEncuestaPreguntasTable();
    try {
      await table.deleteEntity(categoria, id);
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
