// updateOrden/index.js
// Function protegida (rol "admin"): reordenamiento genérico tras un drag & drop.
// Sirve tanto para las pestañas de curso (tabla "Cursos") como para los recursos
// dentro de un tipo (tabla "Recursos") — solo cambia qué tabla y qué PartitionKey
// se manda desde el admin.
const { getCursosTable, getRecursosTable } = require("../src/recursos-tables");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const body = req.body || {};
  const tabla = body.tabla;
  const items = Array.isArray(body.items) ? body.items : [];

  if (tabla !== "Cursos" && tabla !== "Recursos") {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Tabla inválida." } };
    return;
  }
  if (!items.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No hay nada que reordenar." } };
    return;
  }

  try {
    const table = tabla === "Cursos" ? getCursosTable() : getRecursosTable();
    for (const item of items) {
      if (!item.partitionKey || !item.rowKey) continue;
      await table.upsertEntity(
        { partitionKey: item.partitionKey, rowKey: item.rowKey, orden: Number(item.orden) || 0 },
        "Merge"
      );
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error reordenando:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el nuevo orden: " + err.message } };
  }
};
