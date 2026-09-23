// eliminarDiplomasGrupo/index.js
// Function protegida (rol "admin"): borra TODOS los diplomas de un grupo —
// borrado real, a diferencia de anular. Pensado para deshacer un lote mal
// generado (grupo equivocado, datos mal cargados) sin dejar folios "anulado"
// consumidos para siempre. Limpia también el link público (Grupo.diploma_token
// vuelve a NULL, el snapshot de Table Storage se borra) — si se vuelven a
// generar diplomas de este grupo, nace un link nuevo.
const { getPool, sql } = require("../src/backoffice-db");
const { getDiplomasGrupoTable, eliminarDiplomasGrupoSnapshot } = require("../src/diplomas-reportes");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const grupoId = Number((req.body || {}).grupoId);
  if (!grupoId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el grupo." } };
    return;
  }

  try {
    const pool = await getPool();
    const grupoRow = await pool.request().input("grupoId", sql.Int, grupoId).query("SELECT diploma_token FROM Grupo WHERE id = @grupoId");
    const token = grupoRow.recordset[0] && grupoRow.recordset[0].diploma_token;

    const result = await pool.request().input("grupoId", sql.Int, grupoId).query("DELETE FROM Diploma WHERE grupo_id = @grupoId");
    await pool.request().input("grupoId", sql.Int, grupoId).query("UPDATE Grupo SET diploma_token = NULL WHERE id = @grupoId");
    if (token) await eliminarDiplomasGrupoSnapshot(getDiplomasGrupoTable(), token);

    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, eliminados: result.rowsAffected[0] } };
  } catch (err) {
    context.log.error("Error eliminando los diplomas del grupo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron eliminar: " + err.message } };
  }
};
