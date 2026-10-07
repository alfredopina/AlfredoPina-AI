// getResumenSolicitudesAdmin/index.js
// Function protegida (rol "admin"): las 5 tarjetas del tracking de Solicitudes.
// Son ACUMULADAS: ningún Tracking reinicia sus métricas solo (decisión de Alfredo
// 2026-10-07); cuando exista, un botón en Configuración las reiniciará a mano.
//   manuales / sitio ........ por canal_origen
//   atendidas / total ....... atendida = cualquier estatus distinto de "Nueva"
//   horas_atencion .......... promedio de HORAS entre que llegó la solicitud y se
//                             creó su PRIMERA cotización (solo las que ya tienen)
//   prospectos_generados .... solicitudes que dieron de alta una empresa Prospecto
// Además trae el semáforo de las solicitudes "Nueva" abiertas AHORA (de cualquier
// año; es trabajo vivo, no un acumulado): a tiempo / seguimiento / urgente, con los
// umbrales en HORAS de Configuración → Notificaciones. Alimenta Tracking View.
const { getPool, sql } = require("../src/backoffice-db");
const { getUmbrales, DEFAULTS } = require("../src/notificaciones-config");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT
         SUM(CASE WHEN s.canal_origen = 'Manual' THEN 1 ELSE 0 END) AS manuales,
         SUM(CASE WHEN s.canal_origen = 'Sitio' THEN 1 ELSE 0 END) AS sitio,
         COUNT(*) AS total,
         SUM(CASE WHEN s.estatus <> 'Nueva' THEN 1 ELSE 0 END) AS atendidas,
         SUM(CASE WHEN s.creo_prospecto = 1 THEN 1 ELSE 0 END) AS prospectos_generados,
         AVG(CASE WHEN p.primera IS NOT NULL THEN CAST(DATEDIFF(MINUTE, s.fecha_creacion, p.primera) AS FLOAT) / 60.0 END) AS horas_atencion
       FROM Solicitud s
       LEFT JOIN (SELECT solicitud_id, MIN(fecha_creacion) AS primera FROM Cotizacion WHERE solicitud_id IS NOT NULL GROUP BY solicitud_id) p
         ON p.solicitud_id = s.id
`
    );
    const r = result.recordset[0];

    let umbrales = DEFAULTS;
    try { umbrales = await getUmbrales(); } catch (e) { context.log.error("Resumen de solicitudes: umbrales por default:", e.message); }
    const sem = await pool
      .request()
      .input("urgente", sql.Int, umbrales.solicitudesHoras * 60)
      .input("seguimiento", sql.Int, umbrales.solicitudesSeguimientoHoras * 60)
      .query(
        `SELECT
           SUM(CASE WHEN m > @urgente THEN 1 ELSE 0 END) AS hot,
           SUM(CASE WHEN m > @seguimiento AND m <= @urgente THEN 1 ELSE 0 END) AS warn,
           SUM(CASE WHEN m <= @seguimiento THEN 1 ELSE 0 END) AS ok
         FROM (SELECT DATEDIFF(MINUTE, fecha_creacion, SYSUTCDATETIME()) AS m FROM Solicitud WHERE estatus = 'Nueva') x`
      );
    const sm = sem.recordset[0] || {};
    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: {
        manuales: r.manuales || 0,
        sitio: r.sitio || 0,
        total: r.total || 0,
        atendidas: r.atendidas || 0,
        prospectos_generados: r.prospectos_generados || 0,
        horas_atencion: r.horas_atencion == null ? null : Math.max(0, Math.round(r.horas_atencion * 10) / 10),
        semaforo: { ok: sm.ok || 0, warn: sm.warn || 0, hot: sm.hot || 0 },
      },
    };
  } catch (err) {
    context.log.error("Error calculando el resumen de solicitudes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo calcular el resumen." } };
  }
};
