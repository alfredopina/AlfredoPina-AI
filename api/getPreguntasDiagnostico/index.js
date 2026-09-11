// getPreguntasDiagnostico/index.js
// Function pública: preguntas activas de una herramienta, ordenadas por nivel
// y orden, para pintar diagnostico.html. Nunca manda opcion_correcta — quien
// contesta no debe poder verla ni en la respuesta cruda de la red.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

const HERRAMIENTAS = ["excel", "powerbi"];

module.exports = async function (context, req) {
  const herramienta = (req.query.herramienta || "").trim().toLowerCase();
  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida (usa excel o powerbi)." } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("herramienta", sql.VarChar, herramienta)
      .query(
        `SELECT id, herramienta, nivel, texto, imagen_url, opcion_a, opcion_b, opcion_c, opcion_d, orden
         FROM DiagnosticoPregunta
         WHERE herramienta = @herramienta AND activa = 1
         ORDER BY nivel, orden`
      );
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error obteniendo preguntas del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar las preguntas en este momento." } };
  }
};
