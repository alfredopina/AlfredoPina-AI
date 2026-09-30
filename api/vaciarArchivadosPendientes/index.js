// vaciarArchivadosPendientes/index.js
// Function protegida (rol "admin"): borra de un jalón TODAS las notas
// archivadas de un contenedor (las activas nunca se tocan). Complemento del
// borrado individual — para cuando ya cerró mentalmente un hilo completo y
// no quiere ir archivada por archivada.
const { getPendientesTable } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const categoria = ((req.body || {}).categoria || "").trim().toLowerCase();
  if (!categoria) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta la categoría." } };
    return;
  }

  try {
    const table = getPendientesTable();
    const archivadasRowKeys = [];
    for await (const p of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${categoria}' and archivado eq true` } })) {
      archivadasRowKeys.push(p.rowKey);
    }
    for (const rowKey of archivadasRowKeys) {
      await table.deleteEntity(categoria, rowKey);
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, eliminadas: archivadasRowKeys.length } };
  } catch (err) {
    context.log.error("Error vaciando archivados:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo vaciar: " + err.message } };
  }
};
