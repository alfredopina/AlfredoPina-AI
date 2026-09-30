// eliminarPendiente/index.js
// Function protegida (rol "admin"): borrado real de UNA nota (activa o
// archivada) — a diferencia del checkbox (archivarPendiente), que nunca
// borra. Pedido explícito de Alfredo: archivar sigue siendo el default
// rápido y reversible; esto es el escape consciente para cuando de verdad
// ya no quiere guardar registro de la nota.
const { getPendientesTable } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const categoria = (body.categoria || "").trim().toLowerCase();
  const id = (body.id || "").trim();

  if (!categoria || !id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta la categoría o el id del pendiente." } };
    return;
  }

  try {
    const table = getPendientesTable();
    await table.deleteEntity(categoria, id);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando el pendiente:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar: " + err.message } };
  }
};
