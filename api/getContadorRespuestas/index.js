// getContadorRespuestas/index.js
// Function protegida (rol "admin"): total de respuestas recibidas, para el
// contador en vivo de la pestaña QR / Link.
const { getPool } = require("../src/backoffice-db");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT COUNT(*) AS total FROM EncuestaRespuesta");
    context.res = { status: 200, headers: JSON_HEADERS, body: { total: result.recordset[0].total } };
  } catch (err) {
    context.log.error("Error contando respuestas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo contar: " + err.message } };
  }
};
