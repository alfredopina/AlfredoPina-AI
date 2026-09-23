// moverPendiente/index.js
// Function protegida (rol "admin"): mueve una nota de un contenedor a otro
// (drag & drop entre columnas). En Table Storage el PartitionKey no se puede
// editar in-place — se lee la fila completa, se borra en el contenedor
// origen y se vuelve a insertar en el destino con el MISMO id (RowKey), para
// que el front no tenga que reconciliar un id nuevo. `orden` nace en
// -Date.now() para que caiga arriba de la columna destino, mismo criterio
// que crearPendiente.
const { getPendientesTable, CAT_PARTITION } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = (body.id || "").trim();
  const categoria = (body.categoria || "").trim().toLowerCase();
  const categoriaDestino = (body.categoriaDestino || "").trim().toLowerCase();

  if (!id || !categoria || !categoriaDestino) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id, la categoría de origen o la de destino." } };
    return;
  }
  if (categoriaDestino === CAT_PARTITION) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Contenedor destino inválido." } };
    return;
  }
  if (categoria === categoriaDestino) {
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
    return;
  }

  try {
    const table = getPendientesTable();
    let actual;
    try {
      actual = await table.getEntity(categoria, id);
    } catch (err) {
      if (err.statusCode === 404) {
        context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa nota ya no existe en el contenedor de origen." } };
        return;
      }
      throw err;
    }

    const orden = -Date.now();
    await table.upsertEntity(
      {
        partitionKey: categoriaDestino,
        rowKey: id,
        texto: actual.texto || "",
        fecha_creacion: actual.fecha_creacion || new Date().toISOString(),
        archivado: !!actual.archivado,
        fecha_archivado: actual.fecha_archivado || null,
        orden,
      },
      "Replace"
    );
    await table.deleteEntity(categoria, id);

    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, orden } };
  } catch (err) {
    context.log.error("Error moviendo el pendiente:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo mover el pendiente: " + err.message } };
  }
};
