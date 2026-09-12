// eliminarGrupo/index.js
// Function protegida (rol "admin"): borrado REAL de un Grupo — única
// excepción en todo el proyecto al criterio de "nunca borrar de verdad"
// (Cliente/Diploma/Solicitud solo se corrigen o archivan). Alfredo lo pidió
// explícito para poder corregir errores de captura o limpiar pruebas
// mientras carga el backlog real de 2026, con una confirmación en el front
// antes de llamar aquí. GrupoFaseHistorial tiene FK a Grupo sin
// ON DELETE CASCADE (a propósito, ver sql/011 — se asumía que Grupo nunca se
// borra), así que hay que borrar su historial primero, en la misma
// transacción, o el DELETE de Grupo truena por la FK.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const id = Number((req.body || {}).id);
  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id del grupo." } };
    return;
  }

  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction).input("id", sql.Int, id).query("DELETE FROM GrupoFaseHistorial WHERE grupo_id = @id");
      const result = await new sql.Request(transaction).input("id", sql.Int, id).query("DELETE FROM Grupo WHERE id = @id");
      if (!result.rowsAffected[0]) {
        await transaction.rollback();
        context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese grupo ya no existe." } };
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
      throw err;
    }
  } catch (err) {
    context.log.error("Error eliminando el grupo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el grupo." } };
  }
};
