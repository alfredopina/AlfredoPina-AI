// anularDiploma/index.js
// Function protegida (rol "admin"): marca un diploma como "anulado" con un
// motivo obligatorio. No borra el registro — la corrección real es generar
// un diploma nuevo desde Resultados de Calificaciones (el mismo botón
// "Crear Diplomas" solo genera lo que falte). Si el grupo ya tiene link
// público, se reescribe el snapshot para que ese mismo link refleje la baja.
const { getPool, sql } = require("../src/backoffice-db");
const { reconstruirSnapshotGrupo } = require("../src/diplomas-snapshot");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const folio = ((req.body || {}).folio || "").trim();
  const motivo = ((req.body || {}).motivo || "").trim();
  if (!folio) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el folio." } };
    return;
  }
  if (!motivo) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Escribe el motivo de la anulación." } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("folio", sql.NVarChar, folio)
      .input("motivo", sql.NVarChar, motivo)
      .query("UPDATE Diploma SET estatus = 'anulado', motivo_anulacion = @motivo OUTPUT INSERTED.grupo_id WHERE folio = @folio");
    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese folio no existe." } };
      return;
    }

    const grupoId = result.recordset[0].grupo_id;
    if (grupoId) {
      const grupoRow = await pool.request().input("grupoId", sql.Int, grupoId).query("SELECT diploma_token FROM Grupo WHERE id = @grupoId");
      const token = grupoRow.recordset[0] && grupoRow.recordset[0].diploma_token;
      if (token) await reconstruirSnapshotGrupo(pool, grupoId, token);
    }

    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error anulando el diploma:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo anular: " + err.message } };
  }
};
