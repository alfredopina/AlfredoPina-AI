// listTarifasAdmin/index.js
// Function protegida (rol "admin"): las 6 tarifas por hora (una fila por
// herramienta, sembradas por sql/005_comercial.sql).
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT herramienta, precio_hora FROM TarifaHerramienta ORDER BY herramienta");
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error listando tarifas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las tarifas." } };
  }
};
