// actualizarListaEsperaAbierta/index.js
// Function protegida (rol "admin"): marca una persona de la lista de espera como avisada o descartada (o la regresa a nueva). Nunca borra.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

const res = (context, status, body) => { context.res = { status, headers: JSON_HEADERS, body }; };

module.exports = async function (context, req) {
  const b = req.body || {};
  const id = Number(b.id), estado = String(b.estado || "");
  if (!Number.isInteger(id) || id < 1) return res(context, 400, { error: "Falta la persona." });
  if (!["nueva", "avisada", "descartada"].includes(estado)) return res(context, 400, { error: "Estado inválido." });
  try {
    const pool = await getPool();
    const r = await pool.request().input("id", sql.Int, id).input("e", sql.NVarChar, estado).query("UPDATE ListaEspera SET estado = @e, fecha_estado = SYSUTCDATETIME() WHERE id = @id");
    if (!r.rowsAffected || !r.rowsAffected[0]) return res(context, 404, { error: "Esa persona ya no está en la lista." });
    return res(context, 200, { ok: true, estado });
  } catch (err) {
    context.log.error("Error actualizando la lista de espera:", err.message);
    return res(context, 500, { error: "No se pudo actualizar la lista de espera." });
  }
};
