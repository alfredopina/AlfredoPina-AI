// buscarGlobalAdmin/index.js
// Function protegida (solo admin: /api/* está cerrado por defecto): búsqueda global de la barra superior del admin (Ctrl+K).
// Un texto → hasta 5 clientes, cotizaciones, grupos, solicitudes y contactos. Toca SQL (despierta la base si dormía): por eso el
// front espera a que el usuario deje de escribir y exige 2 caracteres. Ver api/src/busqueda-global.js.
const { getPool, sql } = require("../src/backoffice-db");
const { buscar } = require("../src/busqueda-global");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const r = await buscar(pool, sql, (req.query || {}).q);
    context.res = { status: 200, headers: JSON_HEADERS, body: r };
  } catch (err) {
    context.log.error("Error en la búsqueda global:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo buscar en este momento." } };
  }
};
