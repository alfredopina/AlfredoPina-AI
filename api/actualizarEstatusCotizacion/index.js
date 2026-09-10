// actualizarEstatusCotizacion/index.js
// Function protegida (rol "admin"): cambia el estatus de una Cotización. Si
// el nuevo estatus es "Enviada" y todavía no tenía fecha_envio, la pone a
// ahora — usada también por getResumenCotizacionesAdmin/tiempo de cierre de
// forma indirecta (ver esa Function para el criterio de "tiempo de cierre").
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

const ESTATUS_VALIDOS = ["Borrador", "Enviada", "En negociación", "Ganada", "Perdida", "Expirada", "Reemplazada"];

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
      .query(
        `UPDATE Cotizacion SET estatus = @estatus,
           fecha_envio = CASE WHEN @estatus = 'Enviada' AND fecha_envio IS NULL THEN SYSUTCDATETIME() ELSE fecha_envio END
         WHERE id = @id`
      );
    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa cotización ya no existe." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error actualizando el estatus:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo actualizar el estatus." } };
  }
};
