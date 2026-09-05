// eliminarTema/index.js
// Function protegida (rol "admin"): borra un tema, PERO bloquea el borrado si
// el tema está referenciado por algún Temario Estándar o Proyecto existente —
// evita dejar referencias rotas que después revienten getCatalogoCursos.
const { getTemasTable, getTemariosTable, getProyectosTable, isTableNotFound } = require("../src/cursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const { parseTemaIds } = require("../src/cursos-calc");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

async function buscarUsos(table, herramienta, temaId) {
  const usos = [];
  try {
    const entidades = table.listEntities({ queryOptions: { filter: `PartitionKey eq '${herramienta}'` } });
    for await (const e of entidades) {
      if (parseTemaIds(e.temaIds).includes(temaId)) usos.push(e.nombre || e.rowKey);
    }
  } catch (err) {
    if (!isTableNotFound(err)) throw err;
  }
  return usos;
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const id = (body.id || "").trim().toLowerCase();

  if (!HERRAMIENTAS.includes(herramienta) || !id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (herramienta o id)." } };
    return;
  }

  try {
    const [enTemarios, enProyectos] = await Promise.all([
      buscarUsos(getTemariosTable(), herramienta, id),
      buscarUsos(getProyectosTable(), herramienta, id),
    ]);

    if (enTemarios.length || enProyectos.length) {
      const partes = [];
      if (enTemarios.length) partes.push(`el temario "${enTemarios.join('", "')}"`);
      if (enProyectos.length) partes.push(`el proyecto "${enProyectos.join('", "')}"`);
      context.res = {
        status: 400,
        headers: JSON_HEADERS,
        body: { error: `No se puede eliminar: lo está usando ${partes.join(" y ")}. Quítalo de ahí primero.` },
      };
      return;
    }

    const temasTable = getTemasTable();
    await temasTable.deleteEntity(herramienta, id);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando el tema:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el tema: " + err.message } };
  }
};
