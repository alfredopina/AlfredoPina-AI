// eliminarPendientesCategoria/index.js
// Function protegida (rol "admin"): borrado real de un contenedor — solo si
// está vacío (sin notas activas ni archivadas). Si tiene algo, responde 409
// con el conteo para que Alfredo las mueva o archive primero — mismo
// criterio que eliminarCliente (nunca borrar de golpe algo con contenido).
const { getPendientesTable, CAT_PARTITION } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const id = ((req.body || {}).id || "").trim();
  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id del contenedor." } };
    return;
  }

  try {
    const table = getPendientesTable();

    let n = 0;
    for await (const p of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${id}'` } })) {
      n++;
    }
    if (n > 0) {
      context.res = {
        status: 409,
        headers: JSON_HEADERS,
        body: { error: `No se puede eliminar: tiene ${n} pendiente${n === 1 ? "" : "s"} (activos o archivados). Muévelos a otro contenedor primero.` },
      };
      return;
    }

    await table.deleteEntity(CAT_PARTITION, id);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando el contenedor:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el contenedor: " + err.message } };
  }
};
