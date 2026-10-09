// extenderVigenciaCotizacion/index.js
// Function protegida (rol "admin"): le da más tiempo a una cotización abierta SIN folio nuevo — cambia
// Cotizacion.fecha_vigencia y la fecha dentro del snapshot de la propuesta (mismo link, conserva vistas y aceptación).
// Solo Borrador / Enviada / En negociación: una cerrada o reemplazada no se "revive" por aquí.
const { getPool, sql } = require("../src/backoffice-db");
const { getPropuestasTable, codigoDePropuesta, actualizarVigenciaPropuesta } = require("../src/propuestas");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = Number(body.id);
  const fecha = String(body.fecha_vigencia || "").trim();
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(new Date(fecha).getTime())) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id o la fecha no es válida." } };
    return;
  }
  if (fecha < new Date().toISOString().slice(0, 10)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "La nueva vigencia no puede ser una fecha pasada." } };
    return;
  }
  try {
    const pool = await getPool();
    const r = await pool.request().input("id", sql.Int, id).query("SELECT estatus, blob_path FROM Cotizacion WHERE id = @id");
    if (!r.recordset.length) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa cotización ya no existe." } };
      return;
    }
    const { estatus, blob_path } = r.recordset[0];
    if (!["Borrador", "Enviada", "En negociación"].includes(estatus)) {
      context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Solo se extiende la vigencia de una cotización abierta." } };
      return;
    }
    await pool.request().input("id", sql.Int, id).input("fecha", sql.Date, new Date(fecha)).query("UPDATE Cotizacion SET fecha_vigencia = @fecha WHERE id = @id");
    const codigo = codigoDePropuesta(blob_path);
    if (codigo) await actualizarVigenciaPropuesta(getPropuestasTable(), codigo, fecha);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, fecha_vigencia: fecha } };
  } catch (err) {
    context.log.error("Error extendiendo la vigencia:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo extender la vigencia." } };
  }
};
