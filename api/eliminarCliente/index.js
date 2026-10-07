// eliminarCliente/index.js
// Function protegida (rol "admin"): borrado REAL de un Cliente/Prospecto —
// excepción pedida explícita por Alfredo (2026-09-20) para limpiar pruebas.
// Solo borra si NADA cuelga de él: si tiene Solicitudes, Cotizaciones, Grupos,
// Diplomas, Alumnos o respuestas de Diagnóstico/Encuesta, responde 409 con el
// desglose exacto de qué lo bloquea (para que Alfredo borre eso primero). Sus
// Contactos sí se borran junto con él (no son historial, son datos de ficha).
// Nunca hay cascada sobre lo demás: un cliente real con historial no debe
// poder desaparecer por un clic.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

const { contarBloqueos } = require("../src/cliente-dependencias");

module.exports = async function (context, req) {
  const id = Number((req.body || {}).id);
  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id del cliente." } };
    return;
  }

  try {
    const pool = await getPool();
    const existe = await pool.request().input("id", sql.Int, id).query("SELECT nombre FROM Cliente WHERE id = @id");
    if (!existe.recordset.length) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese cliente ya no existe." } };
      return;
    }

    const bloqueos = await contarBloqueos(() => pool.request(), id);
    if (bloqueos.length) {
      const lista = bloqueos.map((b) => `${b.n} ${b.clave}`).join(", ");
      const sinBoton = bloqueos.some((b) => ["Cotizaciones", "Diplomas"].includes(b.clave));
      context.res = {
        status: 409,
        headers: JSON_HEADERS,
        body: {
          error:
            `No se puede eliminar "${existe.recordset[0].nombre}": tiene ${lista}. Elimina o resuelve eso primero.` +
            (sinBoton ? " (Cotizaciones y Diplomas todavía no tienen botón de eliminar.)" : ""),
          bloqueos: Object.fromEntries(bloqueos.map((b) => [b.clave, b.n])),
        },
      };
      return;
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction).input("id", sql.Int, id).query("DELETE FROM Contacto WHERE cliente_id = @id");
      await new sql.Request(transaction).input("id", sql.Int, id).query("DELETE FROM Cliente WHERE id = @id");
      await transaction.commit();
      context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        context.log.error("Error haciendo rollback:", rollbackErr.message);
      }
      throw err;
    }
  } catch (err) {
    context.log.error("Error eliminando el cliente:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el cliente." } };
  }
};
