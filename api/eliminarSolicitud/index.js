// eliminarSolicitud/index.js
// Function protegida (rol "admin"): borrado REAL de una Solicitud, en cualquier
// estatus. Excepción pedida por Alfredo (2026-10-07) al criterio de "nunca borrar
// de verdad" — sirve para limpiar pruebas y errores de captura; el front pide
// una confirmación fuerte antes de llamar aquí. Si la solicitud ya tiene
// cotizaciones, estas NO se borran: Cotizacion.solicitud_id (FK) se deja en NULL
// y cada cotización conserva sus propios datos (cliente, temas, precio, PDF).
// Todo en una transacción. La empresa (aunque sea un Prospecto que nació de esta
// solicitud) y su contacto se quedan en Clientes, donde ya se pueden eliminar.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const id = Number((req.body || {}).id);
  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id de la solicitud." } };
    return;
  }

  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const desligadas = await new sql.Request(transaction)
        .input("id", sql.Int, id)
        .query("UPDATE Cotizacion SET solicitud_id = NULL WHERE solicitud_id = @id");
      const result = await new sql.Request(transaction).input("id", sql.Int, id).query("DELETE FROM Solicitud WHERE id = @id");
      if (!result.rowsAffected[0]) {
        await transaction.rollback();
        context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa solicitud ya no existe." } };
        return;
      }
      await transaction.commit();
      context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, cotizacionesDesligadas: desligadas.rowsAffected[0] || 0 } };
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        context.log.error("Error haciendo rollback:", rollbackErr.message);
      }
      throw err;
    }
  } catch (err) {
    context.log.error("Error eliminando la solicitud:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar la solicitud." } };
  }
};
