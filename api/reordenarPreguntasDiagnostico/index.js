// reordenarPreguntasDiagnostico/index.js
// Function protegida (rol "admin"): reordenamiento tras un drag & drop en la
// pestaña Preguntas — reordena dentro de herramienta+nivel. A diferencia de
// reordenarPreguntas (Encuestas), aquí nivel ya es una columna propia, no
// algo que se arrastre entre secciones con un offset — cada lista de nivel
// se reordena de forma independiente, sin riesgo de entrelazarse con otra.
//
// Vive en Table Storage, no en SQL (2026-09-13) — necesita herramienta
// (PartitionKey) además de los id (RowKey) de cada item.
const { getDiagnosticoPreguntasTable, HERRAMIENTAS } = require("../src/diagnostico-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!HERRAMIENTAS.includes(herramienta) || !items.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No hay nada que reordenar." } };
    return;
  }

  try {
    const table = getDiagnosticoPreguntasTable();
    for (const item of items) {
      const id = (item.id || "").trim();
      if (!id) continue;
      const orden = Number(item.orden) || 0;
      try {
        await table.updateEntity({ partitionKey: herramienta, rowKey: id, orden }, "Merge");
      } catch (err) {
        // pregunta borrada entre que se cargó la lista y se soltó el drag — se ignora, no tumba el resto del reorden
        if (err.statusCode !== 404) throw err;
      }
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error reordenando preguntas del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el nuevo orden: " + err.message } };
  }
};
