// actualizarEstatusSolicitud/index.js
// Function protegida (rol "admin"): Descartar / Reabrir una Solicitud. Solicitud
// tiene 3 estatus (Nueva, Cotizada, Descartada): "Cotizada" NO se pone a mano,
// lo pone crearCotizacion al crear una cotización con solicitud_id. Ganada y
// Perdida son de la Cotización, no de la Solicitud. fecha_estatus solo se mueve
// cuando el estatus de verdad cambia (alimenta "Última actualización").
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

const ESTATUS_VALIDOS = ["Nueva", "Descartada"];

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = Number(body.id);
  const estatus = (body.estatus || "").trim();

  if (!id || !ESTATUS_VALIDOS.includes(estatus)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id o el estatus no es válido (solo Nueva o Descartada; Cotizada se pone sola al cotizar)." } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("estatus", sql.NVarChar, estatus)
      .query("UPDATE Solicitud SET estatus = @estatus, fecha_estatus = CASE WHEN estatus <> @estatus THEN SYSUTCDATETIME() ELSE fecha_estatus END WHERE id = @id");
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
