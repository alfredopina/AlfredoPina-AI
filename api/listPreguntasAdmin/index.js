// listPreguntasAdmin/index.js
// Function protegida (rol "admin"): TODAS las preguntas (activas e inactivas)
// para el panel de edición — a diferencia de getPreguntasEncuesta, que solo
// regresa las activas para el formulario público.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      "SELECT id, seccion, texto, tipo, orden, activa FROM EncuestaPregunta ORDER BY orden"
    );
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error listando preguntas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las preguntas: " + err.message } };
  }
};
