// reordenarPreguntas/index.js
// Function protegida (rol "admin"): reordenamiento tras un drag & drop en la
// pestaña Preguntas — reordena dentro de una categoría. Cada categoría es su
// propia partición de Table Storage, así que el "orden" solo importa relativo
// a las demás preguntas de esa MISMA categoría. La pregunta de comentarios
// (fija, siempre al final) nunca se reordena.
//
// Vive en Table Storage, no en SQL (2026-09-16) — necesita la categoría
// (PartitionKey) además de los id (RowKey) de cada item.
const { getEncuestaPreguntasTable, CATEGORIAS, COMENTARIO_ID } = require("../src/encuesta-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const categoria = (body.seccion || "").trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!CATEGORIAS.includes(categoria) || !items.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No hay nada que reordenar." } };
    return;
  }

  try {
    const table = getEncuestaPreguntasTable();
    for (const item of items) {
      const id = (item.id || "").trim();
      if (!id || id === COMENTARIO_ID) continue;
      const orden = Number(item.orden) || 0;
      try {
        await table.updateEntity({ partitionKey: categoria, rowKey: id, orden }, "Merge");
      } catch (err) {
        // pregunta borrada entre que se cargó la lista y se soltó el drag — se ignora, no tumba el resto del reorden
        if (err.statusCode !== 404) throw err;
      }
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error reordenando preguntas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el nuevo orden: " + err.message } };
  }
};
