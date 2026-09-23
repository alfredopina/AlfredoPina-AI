// crearPendientesCategoria/index.js
// Function protegida (rol "admin"): alta de un contenedor (categoría) nuevo
// en el panel Pendientes. El id es un slug derivado del nombre — si choca
// con uno existente, le agrega un sufijo numérico. "icono" es una CLAVE del
// mapa fijo que vive en el front (`admin/index.html`), nunca SVG/HTML —
// evita guardar o inyectar markup que venga del cliente.
const { getPendientesTable, ensureTable, CAT_PARTITION } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

function slugify(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const nombre = (body.nombre || "").trim();
  const icono = (body.icono || "sitio").trim();

  if (!nombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el nombre del contenedor." } };
    return;
  }

  try {
    const table = getPendientesTable();
    await ensureTable(table);

    const base = slugify(nombre) || "contenedor";
    const existentes = new Set();
    for await (const c of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${CAT_PARTITION}'` } })) {
      existentes.add(c.rowKey);
    }
    let id = base;
    let n = 2;
    while (existentes.has(id) || id === CAT_PARTITION) {
      id = `${base}-${n}`;
      n++;
    }

    const orden = Date.now();
    await table.upsertEntity({ partitionKey: CAT_PARTITION, rowKey: id, nombre, icono, orden }, "Replace");
    context.res = { status: 200, headers: JSON_HEADERS, body: { id, nombre, icono, orden } };
  } catch (err) {
    context.log.error("Error creando el contenedor:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo crear el contenedor: " + err.message } };
  }
};
