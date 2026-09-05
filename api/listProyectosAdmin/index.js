// listProyectosAdmin/index.js
// Function protegida (rol "admin"): lista TODOS los proyectos de una
// herramienta, sin importar su estado, con temaIds ya parseado a array.
const { getTemasTable, getProyectosTable, isTableNotFound } = require("../src/cursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const { parseTemaIds } = require("../src/cursos-calc");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const herramienta = (req.query.herramienta || "").trim().toLowerCase();
  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }

  try {
    const temasTable = getTemasTable();
    const temasPorId = {};
    try {
      const entidades = temasTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${herramienta}'` } });
      for await (const t of entidades) temasPorId[t.rowKey] = t;
    } catch (err) {
      if (!isTableNotFound(err)) throw err;
    }

    const proyectosTable = getProyectosTable();
    const proyectos = [];
    try {
      const entidades = proyectosTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${herramienta}'` } });
      for await (const p of entidades) {
        const temaIds = parseTemaIds(p.temaIds);
        const temas = temaIds.map((id) => temasPorId[id]).filter(Boolean).map((t) => ({ id: t.rowKey, nombre: t.nombre || "" }));
        proyectos.push({
          id: p.rowKey,
          nombre: p.nombre || "",
          objetivo: p.objetivo || "",
          temaIds,
          temas,
          estado: p.estado || "borrador",
          orden: p.orden || 0,
        });
      }
    } catch (err) {
      if (!isTableNotFound(err)) throw err;
    }
    proyectos.sort((a, b) => (a.orden || 0) - (b.orden || 0));

    context.res = { status: 200, headers: JSON_HEADERS, body: { proyectos } };
  } catch (err) {
    context.log.error("Error consultando la tabla Proyectos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los proyectos: " + err.message } };
  }
};
