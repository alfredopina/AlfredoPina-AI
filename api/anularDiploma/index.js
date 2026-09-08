// anularDiploma/index.js
// Function protegida (rol "admin"): marca un diploma como "anulado". No borra
// el blob ni la fila — la corrección real es generar un diploma nuevo desde
// "Crear Diplomas" (aunque sea un lote de 1) y opcionalmente anotar el folio
// viejo en corrige_a_folio del nuevo registro.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const folio = ((req.body || {}).folio || "").trim();
  if (!folio) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el folio." } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.request().input("folio", sql.NVarChar, folio).query("UPDATE Diploma SET estatus = 'anulado' WHERE folio = @folio");
    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese folio no existe." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error anulando el diploma:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo anular: " + err.message } };
  }
};
