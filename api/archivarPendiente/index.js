// archivarPendiente/index.js
// Function protegida (rol "admin"): togglea archivado (booleano, no siempre
// true) — así "ver archivados" también puede desarchivar con este mismo
// endpoint, sin necesitar uno aparte. Al pasar a true guarda fecha_archivado
// = ahora; al pasar a false la limpia. Nunca borra — mismo criterio de
// "nunca borrar de verdad" que ya usa todo el proyecto (Cliente/Diploma/
// Solicitud/Grupo).
const { getPendientesTable, CATEGORIAS } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const categoria = (body.categoria || "").trim().toLowerCase();
  const id = (body.id || "").trim();
  const archivado = !!body.archivado;

  if (!CATEGORIAS.includes(categoria) || !id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta la categoría o el id del pendiente." } };
    return;
  }

  try {
    const table = getPendientesTable();
    const fechaArchivado = archivado ? new Date().toISOString() : null;
    await table.upsertEntity({ partitionKey: categoria, rowKey: id, archivado, fecha_archivado: fechaArchivado }, "Merge");
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, archivado, fecha_archivado: fechaArchivado } };
  } catch (err) {
    context.log.error("Error actualizando el pendiente:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo actualizar: " + err.message } };
  }
};
