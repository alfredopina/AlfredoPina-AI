// getCatalogoCursosAdmin/index.js
// Function protegida (rol "admin"): resumen por herramienta del catálogo (temas,
// programas y proyectos: publicados vs. total) para el grid de herramientas del
// panel Programas y el Dashboard → Productos (inventario).
//   resumen[h] = {
//     temas:     { total, publicados },
//     temarios:  { total, publicados },   // = Programas (el nombre de la tabla es histórico)
//     proyectos: { total, publicados },
//     horas:     { temas, programas },    // temas = horas del banco de temas PUBLICADOS;
//                                         // programas = suma de horas de los programas publicados
//     temasSinUsar,                       // temas que ningún programa incluye
//   }
const { getTemasTable, getTemariosTable, getProyectosTable, isTableNotFound } = require("../src/cursos-tables");
const { parseTemaIds } = require("../src/cursos-calc");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");

async function leerPorHerramienta(table) {
  const por = {};
  HERRAMIENTAS.forEach((h) => { por[h] = []; });
  try {
    for await (const e of table.listEntities()) {
      if (por[e.partitionKey]) por[e.partitionKey].push(e);
    }
  } catch (err) {
    if (!isTableNotFound(err)) throw err;
  }
  return por;
}

function contar(entidades) {
  return { total: entidades.length, publicados: entidades.filter((e) => e.estado === "publicado").length };
}

module.exports = async function (context, req) {
  try {
    const [temas, temarios, proyectos] = await Promise.all([
      leerPorHerramienta(getTemasTable()),
      leerPorHerramienta(getTemariosTable()),
      leerPorHerramienta(getProyectosTable()),
    ]);

    const resumen = {};
    HERRAMIENTAS.forEach((h) => {
      const horasPorTema = {};
      temas[h].forEach((t) => { horasPorTema[t.rowKey] = Number(t.horas) || 0; });
      const usados = new Set();
      let horasProgramas = 0;
      temarios[h].forEach((p) => {
        const ids = parseTemaIds(p.temaIds);
        ids.forEach((id) => usados.add(id));
        if (p.estado === "publicado") horasProgramas += ids.reduce((s, id) => s + (horasPorTema[id] || 0), 0);
      });
      const horasTemas = temas[h].filter((t) => t.estado === "publicado").reduce((s, t) => s + (Number(t.horas) || 0), 0);

      resumen[h] = {
        temas: contar(temas[h]),
        temarios: contar(temarios[h]),
        proyectos: contar(proyectos[h]),
        horas: { temas: horasTemas, programas: horasProgramas },
        temasSinUsar: temas[h].filter((t) => !usados.has(t.rowKey)).length,
      };
    });

    context.res = { status: 200, headers: JSON_HEADERS, body: resumen };
  } catch (err) {
    context.log.error("Error consultando conteos de cursos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los conteos: " + err.message } };
  }
};
