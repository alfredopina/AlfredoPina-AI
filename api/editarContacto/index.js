// editarContacto/index.js
// Function protegida (rol "admin"): edita un Contacto existente. Misma regla
// de "un solo principal por cliente" que crearContacto.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = Number(body.id);
  const clienteId = Number(body.cliente_id);
  const nombre = (body.nombre || "").trim();
  const correo = (body.correo || "").trim() || null;
  const telefono = (body.telefono || "").trim() || null;
  const tieneWhatsapp = body.tiene_whatsapp ? 1 : 0;
  const area = (body.area || "").trim() || null;
  const planta = (body.planta || "").trim() || null;
  const esPrincipal = body.es_principal ? 1 : 0;

  if (!id || !clienteId || !nombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id, cliente o nombre del contacto." } };
    return;
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    if (esPrincipal) {
      await new sql.Request(transaction)
        .input("clienteId", sql.Int, clienteId)
        .input("id", sql.Int, id)
        .query("UPDATE Contacto SET es_principal = 0 WHERE cliente_id = @clienteId AND id <> @id");
    }

    const result = await new sql.Request(transaction)
      .input("id", sql.Int, id)
      .input("nombre", sql.NVarChar, nombre)
      .input("correo", sql.NVarChar, correo)
      .input("telefono", sql.NVarChar, telefono)
      .input("tieneWhatsapp", sql.Bit, tieneWhatsapp)
      .input("area", sql.NVarChar, area)
      .input("planta", sql.NVarChar, planta)
      .input("esPrincipal", sql.Bit, esPrincipal)
      .query(
        `UPDATE Contacto SET nombre=@nombre, correo=@correo, telefono=@telefono,
                tiene_whatsapp=@tieneWhatsapp, area=@area, planta=@planta, es_principal=@esPrincipal
         WHERE id=@id`
      );

    if (!result.rowsAffected[0]) {
      await transaction.rollback();
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese contacto ya no existe." } };
      return;
    }

    await transaction.commit();
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      context.log.error("Error haciendo rollback:", rollbackErr.message);
    }
    context.log.error("Error editando el contacto:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el contacto." } };
  }
};
