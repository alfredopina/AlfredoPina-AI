// reordenarPreguntasDiagnostico/index.js
// Function protegida (rol "admin"): reordenamiento tras un drag & drop en la
// pestaña Preguntas — reordena dentro de herramienta+nivel. A diferencia de
// reordenarPreguntas (Encuestas), aquí nivel ya es una columna propia, no
// algo que se arrastre entre secciones con un offset — cada lista de nivel
// se reordena de forma independiente, sin riesgo de entrelazarse con otra.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const items = Array.isArray((req.body || {}).items) ? req.body.items : [];
  if (!items.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No hay nada que reordenar." } };
    return;
  }

  try {
    const pool = await getPool();
    for (const item of items) {
      const id = Number(item.id);
      if (!id) continue;
      const orden = Number(item.orden) || 0;
      await pool.request().input("id", sql.Int, id).input("orden", sql.Int, orden).query("UPDATE DiagnosticoPregunta SET orden = @orden WHERE id = @id");
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error reordenando preguntas del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el nuevo orden: " + err.message } };
  }
};
