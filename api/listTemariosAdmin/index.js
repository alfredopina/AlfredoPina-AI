// listTemariosAdmin/index.js
// Function protegida (rol "admin"): lista TODOS los temarios estándar de una
// herramienta, sin importar su estado, con los temas ya resueltos y horas/nivel
// calculados — para pintar la lista y el form de edición del admin.
const { getTemasTable, getTemariosTable, isTableNotFound } = require("../src/cursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const { resolverTemario, parseTemaIds } = require("../src/cursos-calc");
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

    const temariosTable = getTemariosTable();
    const temarios = [];
    try {
      const entidades = temariosTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${herramienta}'` } });
      for await (const t of entidades) {
        const { temas, horas, nivelLabel } = resolverTemario(t, temasPorId);
        temarios.push({
          id: t.rowKey,
          nombre: t.nombre || "",
          objetivo: t.objetivo || "",
          dirigido: t.dirigido || "",
          tags: t.tags || "",
          temaIds: parseTemaIds(t.temaIds),
          temas,
          horas,
          nivelLabel,
          estado: t.estado || "borrador",
          orden: t.orden || 0,
        });
      }
    } catch (err) {
      if (!isTableNotFound(err)) throw err;
    }
    temarios.sort((a, b) => (a.orden || 0) - (b.orden || 0));

    context.res = { status: 200, headers: JSON_HEADERS, body: { temarios } };
  } catch (err) {
    context.log.error("Error consultando la tabla TemariosEstandar:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los temarios: " + err.message } };
  }
};
