// Cliente compartido de Azure Table Storage para el panel Pendientes —
// captura rápida de notas de Alfredo, deliberadamente en Table Storage y no
// en la base SQL del backoffice: el punto de esta herramienta es capturar al
// instante, sin el auto-pause de 20-60s que sí se tolera en el resto del
// backoffice. Reusa el mismo Storage Account/Application Setting que Cursos/
// Recursos/Temas (RECURSOS_STORAGE_CONNECTION) — infraestructura compartida,
// tabla independiente.
const { TableClient } = require("@azure/data-tables");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

// Se crea sola la primera vez que alguien escribe — mismo criterio que
// Temas/TemariosEstandar/Proyectos, Alfredo no tiene que tocar el portal.
async function ensureTable(tableClient) {
  try {
    await tableClient.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err; // 409 = la tabla ya existe, se ignora
  }
  return tableClient;
}

function getPendientesTable() {
  return TableClient.fromConnectionString(getConnectionString(), "Pendientes");
}

// true si el error es porque la tabla todavía no existe (nadie ha guardado
// nada todavía) — se debe tratar como "sin pendientes", no como error 500.
function isTableNotFound(err) {
  if (!err || err.statusCode !== 404) return false;
  return /TableNotFound/i.test(err.code || "") || /table.*not.*found/i.test(err.message || "");
}

// Las categorías (contenedores) ahora son dinámicas — Alfredo las crea/edita/
// borra desde el panel (2026-09-23). Antes eran 5 fijas hardcodeadas en el
// código; esas 5 quedan como DEFAULT_CATEGORIAS para sembrar la partición
// especial "_cat" la primera vez que alguien lee el panel después de este
// cambio, así las notas que ya existían con esas 5 categorías no quedan
// huérfanas. "icono" es una CLAVE (no SVG/HTML) — el front tiene el mapa
// clave→SVG, nunca se guarda ni se inyecta markup que venga del backend.
const CAT_PARTITION = "_cat";
const DEFAULT_CATEGORIAS = [
  { id: "comercial", nombre: "Comercial", icono: "maletin", orden: 0 },
  { id: "operacion", nombre: "Operación", icono: "engrane", orden: 1 },
  { id: "productos", nombre: "Productos", icono: "caja", orden: 2 },
  { id: "marca", nombre: "Marca Personal", icono: "persona", orden: 3 },
  { id: "sitio", nombre: "Sitio", icono: "globo", orden: 4 },
];

// Se llama desde listPendientes con las entidades YA leídas de la partición
// "_cat" (evita una segunda vuelta a la tabla) — si viene vacía (primera vez
// que se lee el panel tras este cambio), siembra las 5 de siempre.
async function ensureCategorias(table, categoriasExistentes) {
  if (categoriasExistentes.length) return categoriasExistentes;
  for (const c of DEFAULT_CATEGORIAS) {
    await table.upsertEntity({ partitionKey: CAT_PARTITION, rowKey: c.id, nombre: c.nombre, icono: c.icono, orden: c.orden }, "Replace");
  }
  return DEFAULT_CATEGORIAS.map((c) => ({ ...c }));
}

module.exports = { getPendientesTable, ensureTable, isTableNotFound, CAT_PARTITION, DEFAULT_CATEGORIAS, ensureCategorias };
