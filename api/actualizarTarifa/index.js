// actualizarTarifa/index.js
// Function protegida (rol "admin"): actualiza el precio por hora de UNA
// herramienta. Las 6 filas ya existen desde la semilla de sql/005_comercial.sql
// — esta Function nunca inserta, solo actualiza (si la herramienta no existe,
// es un error de datos, no un caso normal a manejar).
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim();
  const precioHora = Number(body.precio_hora);

  if (!herramienta || !Number.isFinite(precioHora) || precioHora < 0) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta la herramienta o el precio por hora no es válido." } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("herramienta", sql.NVarChar, herramienta)
      .input("precioHora", sql.Decimal(10, 2), precioHora)
      .query("UPDATE TarifaHerramienta SET precio_hora = @precioHora WHERE herramienta = @herramienta");
    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa herramienta no existe en TarifaHerramienta." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error actualizando la tarifa:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar la tarifa." } };
  }
};
