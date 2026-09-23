// editarPendientesCategoria/index.js
// Function protegida (rol "admin"): renombra un contenedor y/o le cambia el
// ícono (clave del mapa fijo del front). El id nunca cambia — así las notas
// que ya viven en esa partición no se mueven.
const { getPendientesTable, CAT_PARTITION } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = (body.id || "").trim();
  const nombre = (body.nombre || "").trim();
  const icono = (body.icono || "").trim();

  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id del contenedor." } };
    return;
  }
  if (!nombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El nombre no puede quedar vacío." } };
    return;
  }

  try {
    const table = getPendientesTable();
    const cambios = { partitionKey: CAT_PARTITION, rowKey: id, nombre };
    if (icono) cambios.icono = icono;
    await table.upsertEntity(cambios, "Merge");
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error editando el contenedor:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el cambio: " + err.message } };
  }
};
