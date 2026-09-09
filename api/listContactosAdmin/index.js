// listContactosAdmin/index.js
// Function protegida (rol "admin"): contactos de un Cliente (?clienteId=),
// principal primero.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const clienteId = Number(req.query.clienteId);
  if (!clienteId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta clienteId." } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("clienteId", sql.Int, clienteId)
      .query(
        `SELECT id, cliente_id, nombre, correo, telefono, tiene_whatsapp, area, planta, es_principal
         FROM Contacto WHERE cliente_id = @clienteId ORDER BY es_principal DESC, nombre`
      );
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error listando contactos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los contactos." } };
  }
};
