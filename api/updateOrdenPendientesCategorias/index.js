// updateOrdenPendientesCategorias/index.js
// Function protegida (rol "admin"): guarda el orden manual (drag & drop) de
// los CONTENEDORES — mismo patrón que updateOrdenPendientes, pero sobre la
// partición especial "_cat" en vez de una categoría de notas.
const { getPendientesTable, CAT_PARTITION } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const items = Array.isArray((req.body || {}).items) ? req.body.items : [];
  if (!items.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No hay nada que reordenar." } };
    return;
  }

  try {
    const table = getPendientesTable();
    for (const item of items) {
      if (!item.id) continue;
      await table.upsertEntity({ partitionKey: CAT_PARTITION, rowKey: item.id, orden: Number(item.orden) || 0 }, "Merge");
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error reordenando contenedores:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el nuevo orden: " + err.message } };
  }
};
