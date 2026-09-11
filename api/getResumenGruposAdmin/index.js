// getResumenGruposAdmin/index.js
// Function protegida (rol "admin"): scorecard del panel Tracking Operación.
// A diferencia de getResumenCotizacionesAdmin (que tuvo que aproximar
// "tiempo de cierre" con fecha_creacion porque Cotizacion no tiene una fecha
// de cierre real), Grupo sí tiene fecha_fin/fecha_cierre reales, así que aquí
// el cálculo es exacto, no aproximado.
//
// "Activos"/"Cierre pendiente" se calculan con una condición sobre
// estatus_cierre (no reimplementando la tabla de reglas de derivarFase en
// SQL): estatus_cierre = 'Cerrado' es, por cómo crearGrupo/editarGrupo/
// avanzarFaseGrupo escriben esos 2 campos siempre juntos, exactamente
// equivalente a "la fase derivada es Cerrado" — ver src/grupo-fase.js.
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM Grupo WHERE estatus_cierre IS NULL OR estatus_cierre <> 'Cerrado') AS activos,
        (SELECT COUNT(*) FROM Grupo WHERE estatus_curso = 'En proceso') AS en_curso,
        (SELECT COUNT(*) FROM Grupo WHERE estatus_curso = 'Por iniciar') AS por_iniciar,
        (SELECT COUNT(*) FROM Grupo WHERE estatus_curso = 'Terminado' AND (estatus_cierre IS NULL OR estatus_cierre <> 'Cerrado')) AS cierre_pendiente,
        (SELECT AVG(CAST(DATEDIFF(day, fecha_fin, fecha_cierre) AS FLOAT)) FROM Grupo
          WHERE estatus_cierre = 'Cerrado' AND fecha_fin IS NOT NULL AND fecha_cierre IS NOT NULL) AS tiempo_cierre_dias
    `);
    const r = result.recordset[0];
    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: {
        activos: r.activos,
        en_curso: r.en_curso,
        por_iniciar: r.por_iniciar,
        cierre_pendiente: r.cierre_pendiente,
        tiempo_cierre_dias: r.tiempo_cierre_dias != null ? Math.round(r.tiempo_cierre_dias * 10) / 10 : null,
      },
    };
  } catch (err) {
    context.log.error("Error calculando el resumen de grupos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo calcular el resumen." } };
  }
};
