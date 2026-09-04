// eliminarRecurso/index.js
// Function protegida (rol "admin"): borra un recurso individual — su fila en
// Recursos y, si tenía archivo (Manual/Caso/Plantilla), el blob asociado.
const { getRecursosTable, getRecursosContainer } = require("../src/recursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const curso = (body.curso || "").trim().toLowerCase();
  const rowKey = (body.rowKey || "").trim();

  if (!HERRAMIENTAS.includes(herramienta) || !curso || !rowKey) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (herramienta, curso o rowKey)." } };
    return;
  }

  const partitionKey = `${herramienta}_${curso}`;

  try {
    const recursosTable = getRecursosTable();
    let blobPath = null;
    try {
      const existente = await recursosTable.getEntity(partitionKey, rowKey);
      blobPath = existente.blobPath || null;
    } catch (e) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese recurso ya no existe." } };
      return;
    }

    if (blobPath) {
      const container = getRecursosContainer();
      try { await container.deleteBlob(blobPath); } catch (e) { context.log.warn("No se pudo borrar el blob " + blobPath, e.message); }
    }

    await recursosTable.deleteEntity(partitionKey, rowKey);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando el recurso:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el recurso: " + err.message } };
  }
};
