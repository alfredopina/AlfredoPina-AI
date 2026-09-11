// updateOrdenPendientes/index.js
// Function protegida (rol "admin"): guarda el orden manual (drag & drop, o el
// botón "ordenar por fecha") de los pendientes ACTIVOS de una categoría —
// mismo patrón que updateOrden/updateOrdenCursos, pero sobre la tabla
// Pendientes y siempre acotado a una sola categoría (PartitionKey) a la vez,
// porque el drag nunca mueve una nota entre columnas.
const { getPendientesTable, CATEGORIAS } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const categoria = (body.categoria || "").trim().toLowerCase();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!CATEGORIAS.includes(categoria)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Categoría inválida." } };
    return;
  }
  if (!items.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No hay nada que reordenar." } };
    return;
  }

  try {
    const table = getPendientesTable();
    for (const item of items) {
      if (!item.id) continue;
      await table.upsertEntity(
        { partitionKey: categoria, rowKey: item.id, orden: Number(item.orden) || 0 },
        "Merge"
      );
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error reordenando pendientes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el nuevo orden: " + err.message } };
  }
};
