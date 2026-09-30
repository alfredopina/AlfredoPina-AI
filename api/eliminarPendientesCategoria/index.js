// eliminarPendientesCategoria/index.js
// Function protegida (rol "admin"): borrado real de un contenedor — bloquea
// solo si tiene notas ACTIVAS (esas sí las tiene que mover o archivar primero,
// mismo criterio que eliminarCliente: nunca borrar de golpe algo con
// contenido vivo). Si solo tiene archivadas, se borran junto con el
// contenedor — una archivada ya es "ya lo pensé, fuera de la vista", borrarla
// al eliminar el contenedor no pierde nada que Alfredo siguiera necesitando.
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

    let activas = 0;
    const archivadasRowKeys = [];
    for await (const p of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${id}'` } })) {
      if (p.archivado) archivadasRowKeys.push(p.rowKey);
      else activas++;
    }
    if (activas > 0) {
      context.res = {
        status: 409,
        headers: JSON_HEADERS,
        body: { error: `No se puede eliminar: tiene ${activas} pendiente${activas === 1 ? "" : "s"} activo${activas === 1 ? "" : "s"}. Muévelas o archívalas primero.` },
      };
      return;
    }

    for (const rowKey of archivadasRowKeys) {
      await table.deleteEntity(id, rowKey);
    }
    await table.deleteEntity(CAT_PARTITION, id);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando el contenedor:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el contenedor: " + err.message } };
  }
};
