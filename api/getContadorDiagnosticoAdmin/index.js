// getContadorDiagnosticoAdmin/index.js
// Function protegida (rol "admin"): total de diagnósticos recibidos +
// desglose Excel/Power BI, para el contador en vivo de la pestaña QR / Link
// — mismo criterio que getContadorRespuestas de Encuestas.
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN herramienta = 'excel' THEN 1 ELSE 0 END) AS excel,
        SUM(CASE WHEN herramienta = 'powerbi' THEN 1 ELSE 0 END) AS powerbi
      FROM DiagnosticoRespuesta
    `);
    const row = result.recordset[0];
    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: { total: row.total || 0, excel: row.excel || 0, powerbi: row.powerbi || 0 },
    };
  } catch (err) {
    context.log.error("Error contando diagnósticos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo contar: " + err.message } };
  }
};
