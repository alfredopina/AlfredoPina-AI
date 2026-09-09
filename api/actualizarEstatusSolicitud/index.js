// actualizarEstatusSolicitud/index.js
// Function protegida (rol "admin"): cambia el estatus de una Solicitud desde
// el <select> inline de la tabla. El paso a "Cotizada" es manual hasta que
// exista Cotizaciones (Fase 3) — ahí se vuelve automático y este campo deja
// de tocarse a mano para ese caso puntual.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

const ESTATUS_VALIDOS = ["Nueva", "En seguimiento", "Cotizada", "Ganada", "Perdida"];

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = Number(body.id);
  const estatus = (body.estatus || "").trim();

  if (!id || !ESTATUS_VALIDOS.includes(estatus)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id o el estatus no es válido." } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("estatus", sql.NVarChar, estatus)
      .query("UPDATE Solicitud SET estatus = @estatus WHERE id = @id");
    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa solicitud ya no existe." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error actualizando el estatus:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo actualizar el estatus." } };
  }
};
