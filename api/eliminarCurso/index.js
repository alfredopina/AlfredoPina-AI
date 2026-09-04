// eliminarCurso/index.js
// Function protegida (rol "admin"): borra un curso completo — su fila en Cursos,
// todas sus filas en Recursos, y los archivos que esas filas tengan en Blob.
const { getCursosTable, getRecursosTable, getRecursosContainer } = require("../src/recursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json" };

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const curso = (body.curso || "").trim().toLowerCase();

  if (!HERRAMIENTAS.includes(herramienta) || !curso) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (herramienta o curso)." } };
    return;
  }

  try {
    const recursosTable = getRecursosTable();
    const container = getRecursosContainer();
    const partitionKey = `${herramienta}_${curso}`;
    const entidades = recursosTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
    });

    for await (const r of entidades) {
      if (r.blobPath) {
        try { await container.deleteBlob(r.blobPath); } catch (e) { context.log.warn("No se pudo borrar el blob " + r.blobPath, e.message); }
      }
      await recursosTable.deleteEntity(r.partitionKey, r.rowKey);
    }

    const cursosTable = getCursosTable();
    await cursosTable.deleteEntity(herramienta, curso);

    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando el curso:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el curso." } };
  }
};
