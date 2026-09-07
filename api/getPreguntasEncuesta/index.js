// getPreguntasEncuesta/index.js
// Function pública: preguntas activas de la encuesta, ordenadas, para pintar
// el formulario en encuesta.html.
const { getPool, sql } = require("../src/backoffice-db");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      "SELECT id, seccion, texto, tipo, orden FROM EncuestaPregunta WHERE activa = 1 ORDER BY orden"
    );
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error obteniendo preguntas de la encuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar las preguntas: " + err.message } };
  }
};
