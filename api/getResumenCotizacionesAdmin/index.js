// getResumenCotizacionesAdmin/index.js
// Function protegida (rol "admin"): scorecard del panel Seguimiento — pipeline
// activo, ganado/perdido del mes, tasa de conversión (últimos 90 días) y
// tiempo promedio de cierre. La tabla no guarda una fecha de cierre explícita
// (no existe fecha_cierre en el esquema), así que "del mes"/"tiempo de
// cierre" se aproximan con fecha_creacion → ahora para las cotizaciones que
// ya están Ganada/Perdida y se crearon este mes — simplificación explícita
// (ver CLAUDE.md/handoff de esta fase: "usa tu criterio si hace falta
// simplificar"). Alerta de "más de 10 días sin respuesta" del mockup se arma
// en el front con la misma dias_abierta que ya regresa listCotizacionesAdmin,
// no hace falta duplicarla aquí.
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM Cotizacion WHERE estatus IN ('Borrador', 'Enviada', 'En negociación')) AS pipeline_conteo,
        (SELECT ISNULL(SUM(precio_final), 0) FROM Cotizacion WHERE estatus IN ('Borrador', 'Enviada', 'En negociación')) AS pipeline_monto,

        (SELECT COUNT(*) FROM Cotizacion
          WHERE estatus = 'Ganada' AND MONTH(fecha_creacion) = MONTH(GETUTCDATE()) AND YEAR(fecha_creacion) = YEAR(GETUTCDATE())) AS ganado_conteo,
        (SELECT ISNULL(SUM(precio_final), 0) FROM Cotizacion
          WHERE estatus = 'Ganada' AND MONTH(fecha_creacion) = MONTH(GETUTCDATE()) AND YEAR(fecha_creacion) = YEAR(GETUTCDATE())) AS ganado_monto,

        (SELECT COUNT(*) FROM Cotizacion
          WHERE estatus = 'Perdida' AND MONTH(fecha_creacion) = MONTH(GETUTCDATE()) AND YEAR(fecha_creacion) = YEAR(GETUTCDATE())) AS perdido_conteo,
        (SELECT ISNULL(SUM(precio_final), 0) FROM Cotizacion
          WHERE estatus = 'Perdida' AND MONTH(fecha_creacion) = MONTH(GETUTCDATE()) AND YEAR(fecha_creacion) = YEAR(GETUTCDATE())) AS perdido_monto,

        (SELECT COUNT(*) FROM Cotizacion WHERE estatus IN ('Ganada', 'Perdida') AND fecha_creacion >= DATEADD(day, -90, GETUTCDATE())) AS cerradas_90d,
        (SELECT COUNT(*) FROM Cotizacion WHERE estatus = 'Ganada' AND fecha_creacion >= DATEADD(day, -90, GETUTCDATE())) AS ganadas_90d,

        (SELECT AVG(DATEDIFF(day, fecha_creacion, GETUTCDATE())) FROM Cotizacion
          WHERE estatus IN ('Ganada', 'Perdida') AND MONTH(fecha_creacion) = MONTH(GETUTCDATE()) AND YEAR(fecha_creacion) = YEAR(GETUTCDATE())) AS tiempo_cierre_dias
    `);
    const r = result.recordset[0];
    const tasaConversion = r.cerradas_90d ? Math.round((r.ganadas_90d / r.cerradas_90d) * 100) : 0;
    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: {
        pipeline_conteo: r.pipeline_conteo,
        pipeline_monto: r.pipeline_monto,
        ganado_conteo: r.ganado_conteo,
        ganado_monto: r.ganado_monto,
        perdido_conteo: r.perdido_conteo,
        perdido_monto: r.perdido_monto,
        tasa_conversion: tasaConversion,
        tiempo_cierre_dias: r.tiempo_cierre_dias != null ? Math.round(r.tiempo_cierre_dias * 10) / 10 : null,
      },
    };
  } catch (err) {
    context.log.error("Error calculando el resumen de cotizaciones:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo calcular el resumen." } };
  }
};
