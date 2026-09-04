// getCatalogoRecursos/index.js
// Function pública (v3 clásico): regresa, para cada una de las 6 herramientas,
// la lista de cursos publicados (solo id + nombre, sin código). recursos.html la
// usa para armar el nivel 1 (qué herramienta ya tiene recursos vs "Próximamente")
// y las pestañas del nivel 2, sin tener que hardcodear esa lista en el HTML.
const { getCursosTable } = require("../src/recursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const catalogo = {};
  HERRAMIENTAS.forEach(h => { catalogo[h] = []; });

  try {
    const cursosTable = getCursosTable();
    const entidades = cursosTable.listEntities();
    for await (const c of entidades) {
      if (c.estado !== "publicado") continue;
      if (!catalogo[c.partitionKey]) continue;
      catalogo[c.partitionKey].push({ id: c.rowKey, nombre: c.nombre || c.rowKey, orden: c.orden || 0 });
    }
    Object.keys(catalogo).forEach(h => catalogo[h].sort((a, b) => a.orden - b.orden));
  } catch (err) {
    context.log.error("Error consultando la tabla Cursos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar el catálogo." } };
    return;
  }

  context.res = { status: 200, headers: JSON_HEADERS, body: catalogo };
};
