// crearProyecto/index.js
// Function protegida (rol "admin"): alta o edición de un proyecto (upsert por
// herramienta+id). temaIds es la lista de temas REQUERIDOS para que el
// proyecto se desbloquee en el constructor (deben estar TODOS seleccionados).
const { getTemasTable, getProyectosTable, ensureTable, isTableNotFound } = require("../src/cursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const id = (body.id || "").trim().toLowerCase();
  const nombre = (body.nombre || "").trim();
  const objetivo = (body.objetivo || "").trim();
  const temaIds = Array.isArray(body.temaIds) ? body.temaIds.filter((x) => typeof x === "string" && x) : [];
  const estado = body.estado === "publicado" ? "publicado" : "borrador";
  const orden = Number.isFinite(body.orden) ? body.orden : 0;

  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }
  if (!SLUG_RE.test(id)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El id del proyecto solo puede tener minúsculas, números y guiones (ej. dashboard-ventas)." } };
    return;
  }
  if (!nombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el nombre del proyecto." } };
    return;
  }
  if (!temaIds.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Selecciona al menos un tema requerido para el proyecto." } };
    return;
  }

  try {
    const temasTable = getTemasTable();
    const existentes = new Set();
    try {
      const entidades = temasTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${herramienta}'` } });
      for await (const t of entidades) existentes.add(t.rowKey);
    } catch (err) {
      if (!isTableNotFound(err)) throw err;
    }
    const faltantes = temaIds.filter((tid) => !existentes.has(tid));
    if (faltantes.length) {
      context.res = { status: 400, headers: JSON_HEADERS, body: { error: `Estos temas ya no existen en ${herramienta}: ${faltantes.join(", ")}.` } };
      return;
    }

    const proyectosTable = getProyectosTable();
    await ensureTable(proyectosTable);
    await proyectosTable.upsertEntity(
      { partitionKey: herramienta, rowKey: id, nombre, objetivo, temaIds: JSON.stringify(temaIds), estado, orden },
      "Replace"
    );
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error guardando el proyecto:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el proyecto: " + err.message } };
  }
};
