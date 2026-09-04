// adminListCursos/index.js
// Function protegida (rol "admin" vía staticwebapp.config.json): lista TODOS los
// cursos de una herramienta, sin importar su estado, incluyendo el código —
// a diferencia de getRecursos/getCatalogoRecursos, que son públicas.
const { getCursosTable } = require("../src/recursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const herramienta = (req.query.herramienta || "").trim().toLowerCase();

  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }

  try {
    const cursosTable = getCursosTable();
    const entidades = cursosTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${herramienta}'` },
    });

    const cursos = [];
    for await (const c of entidades) {
      cursos.push({
        id: c.rowKey,
        nombre: c.nombre || "",
        codigo: c.codigo || "",
        estado: c.estado || "borrador",
        orden: c.orden || 0,
      });
    }
    cursos.sort((a, b) => a.orden - b.orden);

    context.res = { status: 200, headers: JSON_HEADERS, body: { cursos } };
  } catch (err) {
    context.log.error("Error consultando la tabla Cursos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los cursos." } };
  }
};
