// getCatalogoCursosAdmin/index.js
// Function protegida (rol "admin"): conteos por herramienta (temas, temarios
// estándar y proyectos, publicados vs. total) para pintar el grid de
// herramientas del panel Cursos sin traer todo el detalle.
const { getTemasTable, getTemariosTable, getProyectosTable, isTableNotFound } = require("../src/cursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

async function contarPorHerramienta(table) {
  const conteos = {};
  HERRAMIENTAS.forEach((h) => { conteos[h] = { total: 0, publicados: 0 }; });
  try {
    const entidades = table.listEntities();
    for await (const e of entidades) {
      if (!conteos[e.partitionKey]) continue;
      conteos[e.partitionKey].total += 1;
      if (e.estado === "publicado") conteos[e.partitionKey].publicados += 1;
    }
  } catch (err) {
    if (!isTableNotFound(err)) throw err;
  }
  return conteos;
}

module.exports = async function (context, req) {
  try {
    const [temas, temarios, proyectos] = await Promise.all([
      contarPorHerramienta(getTemasTable()),
      contarPorHerramienta(getTemariosTable()),
      contarPorHerramienta(getProyectosTable()),
    ]);

    const resumen = {};
    HERRAMIENTAS.forEach((h) => {
      resumen[h] = { temas: temas[h], temarios: temarios[h], proyectos: proyectos[h] };
    });

    context.res = { status: 200, headers: JSON_HEADERS, body: resumen };
  } catch (err) {
    context.log.error("Error consultando conteos de cursos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los conteos: " + err.message } };
  }
};
