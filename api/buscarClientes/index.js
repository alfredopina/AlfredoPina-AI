// buscarClientes/index.js
// Autocompletado de Cliente — recibe texto parcial (?q=), regresa coincidencias
// por nombre o código. Nació protegida (rol "admin") para el formulario de
// lote de Diplomas; se volvió pública en staticwebapp.config.json cuando
// Encuestas la reusó para encuesta.html (página sin login) — nombre y código
// de cliente no son datos sensibles, y bloquearla ahí habría roto el flujo
// público de la encuesta.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const q = (req.query.q || "").trim();
  if (!q) {
    context.res = { status: 200, headers: JSON_HEADERS, body: [] };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("q", sql.NVarChar, `%${q}%`)
      .query("SELECT TOP 20 id, nombre, codigo FROM Cliente WHERE nombre LIKE @q OR codigo LIKE @q ORDER BY nombre");
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error buscando clientes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo buscar clientes en este momento." } };
  }
};
