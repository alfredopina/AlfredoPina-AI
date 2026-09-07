// getContadorRespuestas/index.js
// Function protegida (rol "admin"): total de respuestas recibidas + cuántas
// llegaron "hoy", para el contador en vivo de la pestaña QR / Link — el admin
// lo consulta con polling, así Alfredo ve avanzar el conteo del grupo sin
// tener que refrescar la página a mano.
// "Hoy" se calcula contra fecha_envio (el timestamp real del envío, en UTC) —
// no contra el campo "fecha" del formulario (esa es la fecha del curso, que
// el respondiente puede editar). Puede haber un desfase de unas horas cerca
// de medianoche por la diferencia UTC/hora de México — aceptable para un
// contador de referencia en vivo, no es un dato que se reporte como oficial.
const { getPool } = require("../src/backoffice-db");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM EncuestaRespuesta) AS total,
        (SELECT COUNT(*) FROM EncuestaRespuesta WHERE CAST(fecha_envio AS DATE) = CAST(SYSUTCDATETIME() AS DATE)) AS hoy
    `);
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset[0] };
  } catch (err) {
    context.log.error("Error contando respuestas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo contar: " + err.message } };
  }
};
