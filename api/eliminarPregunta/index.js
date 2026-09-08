// eliminarPregunta/index.js
// Function protegida (rol "admin"): borra una pregunta de verdad (no es un
// simple desactivar). Las respuestas históricas que ya la usaron NO se tocan
// — ver el comentario en sql/003_encuestas.sql sobre por qué pregunta_id no
// tiene FK: se vuelve un id huérfano a propósito, y listRespuestasEncuesta lo
// muestra como "(pregunta eliminada)".
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const id = Number((req.body || {}).id);
  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id de la pregunta." } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.request().input("id", sql.Int, id).query("DELETE FROM EncuestaPregunta WHERE id = @id");
    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa pregunta ya no existe." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando la pregunta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar: " + err.message } };
  }
};
