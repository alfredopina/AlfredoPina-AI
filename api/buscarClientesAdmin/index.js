// buscarClientesAdmin/index.js
// Function protegida (rol "admin"): igual que buscarClientes pero INCLUYE
// Prospectos y regresa tipo_cliente, para los pickers del admin que sí los
// aceptan (Solicitud, Cotización, Grupo, link de Diagnóstico). buscarClientes
// (pública) nunca los regresa.
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
      .query("SELECT TOP 20 id, nombre, codigo, tipo_cliente FROM Cliente WHERE nombre LIKE @q OR codigo LIKE @q ORDER BY nombre");
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error buscando clientes (admin):", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo buscar clientes en este momento." } };
  }
};
