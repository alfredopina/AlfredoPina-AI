// crearContacto/index.js
// Function protegida (rol "admin"): alta de un Contacto bajo un Cliente. Si
// llega es_principal=true, primero le quita la marca a cualquier otro contacto
// del mismo cliente dentro de la misma transacción — solo puede haber uno
// principal a la vez (ver editarContacto, misma regla).
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const clienteId = Number(body.cliente_id);
  const nombre = (body.nombre || "").trim();
  const correo = (body.correo || "").trim() || null;
  const telefono = (body.telefono || "").trim() || null;
  const tieneWhatsapp = body.tiene_whatsapp ? 1 : 0;
  const area = (body.area || "").trim() || null;
  const esPrincipal = body.es_principal ? 1 : 0;

  if (!clienteId || !nombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el cliente o el nombre del contacto." } };
    return;
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    if (esPrincipal) {
      await new sql.Request(transaction)
        .input("clienteId", sql.Int, clienteId)
        .query("UPDATE Contacto SET es_principal = 0 WHERE cliente_id = @clienteId");
    }

    const insert = await new sql.Request(transaction)
      .input("clienteId", sql.Int, clienteId)
      .input("nombre", sql.NVarChar, nombre)
      .input("correo", sql.NVarChar, correo)
      .input("telefono", sql.NVarChar, telefono)
      .input("tieneWhatsapp", sql.Bit, tieneWhatsapp)
      .input("area", sql.NVarChar, area)
      .input("esPrincipal", sql.Bit, esPrincipal)
      .query(
        `INSERT INTO Contacto (cliente_id, nombre, correo, telefono, tiene_whatsapp, area, es_principal)
         OUTPUT INSERTED.id
         VALUES (@clienteId, @nombre, @correo, @telefono, @tieneWhatsapp, @area, @esPrincipal)`
      );

    await transaction.commit();
    context.res = { status: 200, headers: JSON_HEADERS, body: { id: insert.recordset[0].id } };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      context.log.error("Error haciendo rollback:", rollbackErr.message);
    }
    context.log.error("Error creando el contacto:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo crear el contacto." } };
  }
};
