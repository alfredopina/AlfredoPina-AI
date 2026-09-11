// crearPendiente/index.js
// Function protegida (rol "admin"): alta de una nota rápida en una de las 5
// categorías fijas. RowKey es un UUID. `orden` nace en -Date.now() para que
// la nota nueva aparezca siempre arriba de la columna (mismo criterio que ya
// usan Temas/Proyectos con Date.now() positivo) — en cuanto Alfredo arrastre
// cualquier tarjeta de esa columna, TODAS se reindexan a 0,10,20… vía
// updateOrdenPendientes, sin importar qué valor traían antes.
const crypto = require("crypto");
const { getPendientesTable, ensureTable, CATEGORIAS } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const categoria = (body.categoria || "").trim().toLowerCase();
  const texto = (body.texto || "").trim();

  if (!CATEGORIAS.includes(categoria)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Categoría inválida." } };
    return;
  }
  if (!texto) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el texto del pendiente." } };
    return;
  }

  try {
    const table = getPendientesTable();
    await ensureTable(table);
    const id = crypto.randomUUID();
    const fechaCreacion = new Date().toISOString();
    const orden = -Date.now();
    await table.upsertEntity(
      { partitionKey: categoria, rowKey: id, texto, fecha_creacion: fechaCreacion, archivado: false, fecha_archivado: null, orden },
      "Replace"
    );
    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: { categoria, id, texto, fecha_creacion: fechaCreacion, archivado: false, fecha_archivado: null, orden },
    };
  } catch (err) {
    context.log.error("Error creando el pendiente:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el pendiente: " + err.message } };
  }
};
