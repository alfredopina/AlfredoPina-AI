// listPreguntasDiagnosticoAdmin/index.js
// Function protegida (rol "admin"): TODAS las preguntas de una herramienta
// (activas e inactivas), CON opcion_correcta — a diferencia de
// getPreguntasDiagnostico, que es pública y nunca la incluye.
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
        `SELECT id, herramienta, nivel, texto, imagen_url, opcion_a, opcion_b, opcion_c, opcion_d, opcion_correcta, orden, activa
         FROM DiagnosticoPregunta
         WHERE herramienta = @herramienta
         ORDER BY nivel, orden`
      );
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error listando preguntas del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las preguntas: " + err.message } };
  }
};
