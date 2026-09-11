// editarPendiente/index.js
// Function protegida (rol "admin"): actualiza solo el texto de una nota ya
// existente — categoria+id identifican la fila (PartitionKey+RowKey).
const { getPendientesTable, CATEGORIAS } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const categoria = (body.categoria || "").trim().toLowerCase();
  const id = (body.id || "").trim();
  const texto = (body.texto || "").trim();

  if (!CATEGORIAS.includes(categoria) || !id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta la categoría o el id del pendiente." } };
    return;
  }
  if (!texto) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El texto no puede quedar vacío." } };
    return;
  }

  try {
    const table = getPendientesTable();
    await table.upsertEntity({ partitionKey: categoria, rowKey: id, texto }, "Merge");
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error editando el pendiente:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el cambio: " + err.message } };
  }
};
