// listPendientes/index.js
// Function protegida (rol "admin"): trae toda la tabla en una sola pasada
// (el volumen es mínimo) y la separa en `categorias` (contenedores, antes
// fijos, ahora dinámicos — partición especial "_cat") y `pendientes` (las
// notas reales). El front ordena las activas por `orden` (drag & drop /
// botón de ordenar) y las archivadas por fecha. `orden` puede venir null en
// notas creadas antes de que ese campo existiera — el front lo resuelve con
// la fecha de creación. Si la partición "_cat" viene vacía (primera lectura
// tras el cambio a categorías dinámicas), se siembran las 5 de siempre para
// que las notas ya existentes no queden huérfanas.
const { getPendientesTable, ensureTable, isTableNotFound, CAT_PARTITION, ensureCategorias } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const table = getPendientesTable();
    const pendientes = [];
    let categorias = [];
    try {
      const entidades = table.listEntities();
      for await (const p of entidades) {
        if (p.partitionKey === CAT_PARTITION) {
          categorias.push({ id: p.rowKey, nombre: p.nombre || p.rowKey, icono: p.icono || "sitio", orden: (typeof p.orden === "number") ? p.orden : 0 });
          continue;
        }
        pendientes.push({
          categoria: p.partitionKey,
          id: p.rowKey,
          texto: p.texto || "",
          fecha_creacion: p.fecha_creacion || null,
          archivado: !!p.archivado,
          fecha_archivado: p.fecha_archivado || null,
          orden: (typeof p.orden === "number") ? p.orden : null,
        });
      }
    } catch (err) {
      if (!isTableNotFound(err)) throw err;
    }
    if (!categorias.length) {
      await ensureTable(table);
      categorias = await ensureCategorias(table, categorias);
    }
    categorias.sort((a, b) => a.orden - b.orden);
    context.res = { status: 200, headers: JSON_HEADERS, body: { categorias, pendientes } };
  } catch (err) {
    context.log.error("Error listando pendientes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los pendientes: " + err.message } };
  }
};
