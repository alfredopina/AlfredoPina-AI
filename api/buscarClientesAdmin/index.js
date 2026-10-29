// buscarClientesAdmin/index.js
// Function protegida (rol "admin"): igual que buscarClientes pero INCLUYE
// Prospectos y regresa tipo_cliente, para los pickers del admin que sí los
// aceptan (Solicitud, Cotización, Grupo, link de Diagnóstico). buscarClientes
// (pública) nunca los regresa.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const q = (req.query.q || "").trim();
  // Los Terceros (facturas por cuenta de terceros) solo se ofrecen en Cobranza: ?facturables=1 trae únicamente los que pueden recibir factura
  // (Directo, Intermediario y Tercero); sin ese parámetro los Terceros nunca salen (Solicitud, Cotización y Grupo no deben verlos).
  const filtroTipos = req.query.facturables ? "tipo_cliente IN ('Directo', 'Intermediario', 'Tercero')" : "tipo_cliente <> 'Tercero'";
  // con ?facturables=1 (Cobranza) también salen los datos con los que nace una cuenta: nombre fiscal, RFC, plazo y tipo de factura
  const campos = req.query.facturables ? ", razon_social, rfc, plazo_pago_dias, tipo_factura_default" : "";
  // ?todos=1 (sin q): la flecha del combobox del formulario de Solicitudes despliega los primeros 300 por nombre
  if (!q && req.query.todos) {
    try {
      const pool = await getPool();
      const todos = await pool.request().query(`SELECT TOP 300 id, nombre, codigo, tipo_cliente${campos} FROM Cliente WHERE ${filtroTipos} ORDER BY nombre`);
      context.res = { status: 200, headers: JSON_HEADERS, body: todos.recordset };
    } catch (err) {
      context.log.error("Error listando clientes (admin):", err.message);
      context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo listar clientes en este momento." } };
    }
    return;
  }
  if (!q) {
    context.res = { status: 200, headers: JSON_HEADERS, body: [] };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("q", sql.NVarChar, `%${q}%`)
      .query(`SELECT TOP 20 id, nombre, codigo, tipo_cliente${campos} FROM Cliente WHERE (nombre LIKE @q OR codigo LIKE @q) AND ${filtroTipos} ORDER BY nombre`);
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error buscando clientes (admin):", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo buscar clientes en este momento." } };
  }
};
