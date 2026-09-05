// getResumenProductosAdmin/index.js
// Function protegida (rol "admin"): conteos por herramienta del módulo Recursos
// (cursos con código de descarga y cuántos de esos ya tienen al menos un recurso
// cargado) para las tarjetas de Producto del Dashboard. Un solo recorrido por
// tabla (Cursos, Recursos) en vez de una llamada por curso.
const { getCursosTable, getRecursosTable } = require("../src/recursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  try {
    const resumen = {};
    const cursosPorHerramienta = {};
    HERRAMIENTAS.forEach((h) => {
      resumen[h] = { cursos: { total: 0, publicados: 0 }, cursosConRecursos: 0 };
      cursosPorHerramienta[h] = [];
    });

    const cursosTable = getCursosTable();
    for await (const c of cursosTable.listEntities()) {
      if (!resumen[c.partitionKey]) continue;
      resumen[c.partitionKey].cursos.total += 1;
      if (c.estado === "publicado") resumen[c.partitionKey].cursos.publicados += 1;
      cursosPorHerramienta[c.partitionKey].push(c.rowKey);
    }

    const conRecursos = new Set();
    const recursosTable = getRecursosTable();
    for await (const r of recursosTable.listEntities()) {
      conRecursos.add(r.partitionKey);
    }

    HERRAMIENTAS.forEach((h) => {
      resumen[h].cursosConRecursos = cursosPorHerramienta[h].filter((cursoId) =>
        conRecursos.has(`${h}_${cursoId}`)
      ).length;
    });

    context.res = { status: 200, headers: JSON_HEADERS, body: resumen };
  } catch (err) {
    context.log.error("Error consultando el resumen de Producto:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar el resumen: " + err.message } };
  }
};
