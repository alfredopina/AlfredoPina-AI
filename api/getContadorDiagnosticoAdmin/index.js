// getContadorDiagnosticoAdmin/index.js
// Function protegida (rol "admin"): total de diagnósticos recibidos +
// desglose Excel/Power BI, para el contador en vivo de la pestaña QR / Link
// — mismo criterio que getContadorRespuestas de Encuestas.
//
// Incluye `pendientes`: envíos que esperan en la cola (Table Storage) para pasar a SQL — la tarjeta "por importar"
// del panel. El total cuenta lo recibido (encolado + ya en SQL).
//
// YA NO toca SQL en cada consulta (2026-09-19): enviarDiagnostico suma 1 en
// Table Storage al guardar y eliminarRespuestaDiagnostico resta 1 (ver
// diagnostico-contador.js), y esto solo lee ese contador — se puede consultar
// cada 10 s sin despertar la base. SQL solo se consulta (COUNT) en dos casos:
//   · la primera vez, mientras el contador no se haya sembrado, y
//   · con ?recalcular=1 (botón "Recalcular desde SQL" del panel), por si algún
//     query manual contra la base o un fallo de Storage lo desfasó.
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { getColaTable, resumenPendientes } = require("../src/diagnostico-cola");
const { getDiagnosticoContadorTable, leerContadorDiagnostico, sembrarContadorDiagnostico } = require("../src/diagnostico-contador");

async function contarDesdeSql() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN herramienta = 'excel' THEN 1 ELSE 0 END) AS excel,
      SUM(CASE WHEN herramienta = 'powerbi' THEN 1 ELSE 0 END) AS powerbi
    FROM DiagnosticoRespuesta
  `);
  const row = result.recordset[0];
  return { total: row.total || 0, excel: row.excel || 0, powerbi: row.powerbi || 0 };
}

module.exports = async function (context, req) {
  try {
    const table = getDiagnosticoContadorTable();
    const forzar = (req.query || {}).recalcular === "1";
    let pend = null;
    try { pend = await resumenPendientes(getColaTable()); } catch (errCola) { context.log.error("No se pudo leer la cola de diagnósticos:", errCola.message); }
    let conteo = forzar ? null : await leerContadorDiagnostico(table);
    if (!conteo) {
      // lo recibido = lo que ya está en SQL + lo que aún espera en la cola
      const enSql = await contarDesdeSql();
      conteo = { total: enSql.total + (pend ? pend.total : 0), excel: enSql.excel + (pend ? pend.excel : 0), powerbi: enSql.powerbi + (pend ? pend.powerbi : 0) };
      await sembrarContadorDiagnostico(table, conteo);
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ...conteo, pendientes: pend } };
  } catch (err) {
    context.log.error("Error contando diagnósticos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo contar: " + err.message } };
  }
};
