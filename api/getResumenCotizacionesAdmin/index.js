// getResumenCotizacionesAdmin/index.js
// (Pipeline = solo Enviada y En negociación: un Borrador aún no se le ofrece a nadie.)
// Function protegida (rol "admin"): scorecard del panel Seguimiento — pipeline
// activo, ganado/perdido, tasa de conversión y tiempo promedio de cierre,
// todo ACUMULADO (ningún Tracking reinicia sus métricas solo; el tiempo de cierre
// va de fecha_creacion a fecha_cierre). La tabla no guarda una fecha de cierre explícita
// (no existe fecha_cierre en el esquema), así que "del mes"/"tiempo de
// cierre" se aproximan con fecha_creacion → ahora para las cotizaciones que
// ya están Ganada/Perdida y se crearon este mes — simplificación explícita
// (ver CLAUDE.md/handoff de esta fase: "usa tu criterio si hace falta
// simplificar"). Alerta de "más de 10 días sin respuesta" del mockup se arma
// en el front con la misma dias_estatus que ya regresa listCotizacionesAdmin,
// no hace falta duplicarla aquí.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { getUmbrales } = require("../src/notificaciones-config");
const { getMetricasRango } = require("../src/metricas-desde");
const { representantes } = require("../src/cotizacion-alternativas");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const umbrales = await getUmbrales();
    // "Contar desde / hasta" (Configuración → Métricas): solo las cerradas (Ganada/Perdida) dentro del rango de su fecha de cierre; pipeline y antigüedad son estado vivo
    const { desde, hasta } = (await getMetricasRango()).cotizaciones;
    const paramDesde = desde ? new Date(desde) : null;
    const paramHasta = hasta ? new Date(hasta) : null;
    const result = await pool
      .request()
      .input("desde", sql.DateTime2, paramDesde)
      .input("hasta", sql.DateTime2, paramHasta)
      .input("umbral", sql.Int, umbrales.cotizacionesDias)
      .input("umbralSeguimiento", sql.Int, umbrales.cotizacionesSeguimientoDias)
      .query(`
      SELECT
        -- (el pipeline y su desglose por antigüedad se calculan abajo, en JS: un grupo de alternativas cuenta UNA vez)
        (SELECT COUNT(*) FROM Cotizacion
          WHERE estatus = 'Ganada' AND (@desde IS NULL OR COALESCE(fecha_cierre, fecha_estatus) >= @desde) AND (@hasta IS NULL OR COALESCE(fecha_cierre, fecha_estatus) < @hasta)) AS ganado_conteo,
        (SELECT ISNULL(SUM(precio_final), 0) FROM Cotizacion
          WHERE estatus = 'Ganada' AND (@desde IS NULL OR COALESCE(fecha_cierre, fecha_estatus) >= @desde) AND (@hasta IS NULL OR COALESCE(fecha_cierre, fecha_estatus) < @hasta)) AS ganado_monto,

        (SELECT COUNT(*) FROM Cotizacion
          WHERE estatus = 'Perdida' AND (@desde IS NULL OR COALESCE(fecha_cierre, fecha_estatus) >= @desde) AND (@hasta IS NULL OR COALESCE(fecha_cierre, fecha_estatus) < @hasta)) AS perdido_conteo,
        (SELECT ISNULL(SUM(precio_final), 0) FROM Cotizacion
          WHERE estatus = 'Perdida' AND (@desde IS NULL OR COALESCE(fecha_cierre, fecha_estatus) >= @desde) AND (@hasta IS NULL OR COALESCE(fecha_cierre, fecha_estatus) < @hasta)) AS perdido_monto,

        (SELECT COUNT(*) FROM Cotizacion WHERE estatus IN ('Ganada', 'Perdida') AND (@desde IS NULL OR COALESCE(fecha_cierre, fecha_estatus) >= @desde) AND (@hasta IS NULL OR COALESCE(fecha_cierre, fecha_estatus) < @hasta)) AS cerradas_90d,
        (SELECT COUNT(*) FROM Cotizacion WHERE estatus = 'Ganada' AND (@desde IS NULL OR COALESCE(fecha_cierre, fecha_estatus) >= @desde) AND (@hasta IS NULL OR COALESCE(fecha_cierre, fecha_estatus) < @hasta)) AS ganadas_90d,

        (SELECT AVG(CAST(DATEDIFF(day, fecha_creacion, fecha_cierre) AS FLOAT)) FROM Cotizacion
          WHERE estatus IN ('Ganada', 'Perdida') AND fecha_cierre IS NOT NULL AND (@desde IS NULL OR fecha_cierre >= @desde) AND (@hasta IS NULL OR fecha_cierre < @hasta)) AS tiempo_cierre_dias
    `);
    const r = result.recordset[0];
    // pipeline = Enviada + En negociación; las alternativas de una misma oportunidad cuentan una vez (monto más alto del grupo)
    const abiertas = await pool.request().input("umbral", sql.Int, umbrales.cotizacionesDias).input("umbralSeguimiento", sql.Int, umbrales.cotizacionesSeguimientoDias).query(`
      SELECT id, estatus, precio_final, alternativa_grupo,
             DATEDIFF(day, fecha_estatus, GETUTCDATE()) AS dias_estatus, DATEDIFF(day, fecha_creacion, GETUTCDATE()) AS dias_creacion
      FROM Cotizacion WHERE estatus IN ('Enviada', 'En negociación')`);
    const rep = representantes(abiertas.recordset);
    r.pipeline_conteo = rep.length;
    r.pipeline_monto = rep.reduce((a, c) => a + Number(c.precio_final || 0), 0);
    r.antiguedad_verde = rep.filter((c) => c.dias_estatus < umbrales.cotizacionesSeguimientoDias).length;
    r.antiguedad_amarillo = rep.filter((c) => c.dias_estatus >= umbrales.cotizacionesSeguimientoDias && c.dias_creacion < umbrales.cotizacionesDias).length;
    r.antiguedad_rojo = rep.filter((c) => c.dias_estatus >= umbrales.cotizacionesDias).length;
    // resumen por contenedor (mismos 5 del tablero): cantidad y monto, acumulados
    const porEstatus = await pool.request().input("desde", sql.DateTime2, paramDesde).input("hasta", sql.DateTime2, paramHasta).query(`
      SELECT estatus, COUNT(*) AS n, ISNULL(SUM(precio_final), 0) AS monto
      FROM Cotizacion WHERE estatus IN ('Borrador', 'Enviada', 'En negociación', 'Ganada', 'Perdida')
        AND (estatus NOT IN ('Ganada', 'Perdida') OR (@desde IS NULL OR COALESCE(fecha_cierre, fecha_estatus) >= @desde) AND (@hasta IS NULL OR COALESCE(fecha_cierre, fecha_estatus) < @hasta))
      GROUP BY estatus`);
    const contenedores = {};
    for (const k of ['Borrador', 'Enviada', 'En negociación', 'Ganada', 'Perdida']) contenedores[k] = { n: 0, monto: 0 };
    for (const row of porEstatus.recordset) contenedores[row.estatus] = { n: row.n, monto: Number(row.monto) };
    // Enviada / En negociación: cada grupo de alternativas se cuenta una vez, en el contenedor de su cotización de monto más alto
    for (const k of ['Enviada', 'En negociación']) {
      const delContenedor = rep.filter((c) => c.estatus === k);
      contenedores[k] = { n: delContenedor.length, monto: delContenedor.reduce((a, c) => a + Number(c.precio_final || 0), 0) };
    }
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
        contenedores,
        contando_desde: desde,
        contando_hasta: hasta,
        antiguedad: { verde: r.antiguedad_verde, amarillo: r.antiguedad_amarillo, rojo: r.antiguedad_rojo },
      },
    };
  } catch (err) {
    context.log.error("Error calculando el resumen de cotizaciones:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo calcular el resumen." } };
  }
};
