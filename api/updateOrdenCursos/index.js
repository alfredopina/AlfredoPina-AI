// updateOrdenCursos/index.js
// Function protegida (rol "admin"): reordenamiento genérico tras un drag & drop
// para las 3 tablas del módulo Cursos (Temas, TemariosEstandar, Proyectos).
// Copia estructural de api/updateOrden (el de Recursos) pero separada a
// propósito, para no acoplar los dos módulos ni tocar código que ya funciona.
const { getTemasTable, getTemariosTable, getProyectosTable } = require("../src/cursos-tables");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const TABLAS = { Temas: getTemasTable, TemariosEstandar: getTemariosTable, Proyectos: getProyectosTable };

module.exports = async function (context, req) {
  const body = req.body || {};
  const tabla = body.tabla;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!TABLAS[tabla]) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Tabla inválida." } };
    return;
  }
  if (!items.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No hay nada que reordenar." } };
    return;
  }

  try {
    const table = TABLAS[tabla]();
    for (const item of items) {
      if (!item.partitionKey || !item.rowKey) continue;
      await table.upsertEntity(
        { partitionKey: item.partitionKey, rowKey: item.rowKey, orden: Number(item.orden) || 0 },
        "Merge"
      );
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error reordenando:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el nuevo orden: " + err.message } };
  }
};
