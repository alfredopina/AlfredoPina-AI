// getResumenGruposAdmin/index.js
// Function protegida (rol "admin"): scorecard + stepper vivo del panel
// Tracking Operación (rediseño 2026-09-13, ver CLAUDE.md). Regresa:
//   - activos / cerrados_este_anio / dias_promedio_cierre: las 3 tarjetas.
//   - conteos_fase: cuántos Grupos activos hay en cada una de las 5 fases
//     que no son Cerrado — para el stepper. Se calcula en JS con
//     derivarFase sobre estatus_curso/estatus_cierre crudos, nunca
//     reimplementando esa tabla de reglas en SQL (mismo criterio que
//     listGruposAdmin con la columna `fase`).
//   - grupos_directos: de los Grupos activos, cuántos los contrató
//     (cliente_id, no cliente_final_id) un Cliente Tipo=Directo, y su % —
//     entre más alto, menos depende Alfredo de sus intermediarios.
// "Activos"/"cerrados" siguen sin reimplementar la tabla de reglas de
// derivarFase en SQL: estatus_cierre = 'Cerrado' es, por cómo
// crearGrupo/editarGrupo/avanzarFaseGrupo escriben esos 2 campos siempre
// juntos, exactamente equivalente a "la fase derivada es Cerrado".
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { derivarFase, FASES } = require("../src/grupo-fase");

const FASES_STEPPER = FASES.filter((f) => f !== "Cerrado");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const [totales, activosRaw, directos] = await Promise.all([
      pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM Grupo WHERE estatus_cierre IS NULL OR estatus_cierre <> 'Cerrado') AS activos,
          (SELECT COUNT(*) FROM Grupo WHERE estatus_cierre = 'Cerrado' AND YEAR(fecha_cierre) = YEAR(SYSUTCDATETIME())) AS cerrados_este_anio,
          (SELECT AVG(CAST(DATEDIFF(day, fecha_fin, fecha_cierre) AS FLOAT)) FROM Grupo
            WHERE estatus_cierre = 'Cerrado' AND fecha_fin IS NOT NULL AND fecha_cierre IS NOT NULL) AS dias_promedio_cierre
      `),
      pool.request().query(`
        SELECT estatus_curso, estatus_cierre FROM Grupo WHERE estatus_cierre IS NULL OR estatus_cierre <> 'Cerrado'
      `),
      pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM Grupo g JOIN Cliente c ON c.id = g.cliente_id
            WHERE (g.estatus_cierre IS NULL OR g.estatus_cierre <> 'Cerrado') AND c.tipo_cliente = 'Directo') AS directos,
          (SELECT COUNT(*) FROM Grupo WHERE estatus_cierre IS NULL OR estatus_cierre <> 'Cerrado') AS total_activos
      `),
    ]);

    const conteosFase = Object.fromEntries(FASES_STEPPER.map((f) => [f, 0]));
    for (const g of activosRaw.recordset) {
      const fase = derivarFase(g.estatus_curso, g.estatus_cierre);
      if (fase in conteosFase) conteosFase[fase]++;
    }

    const r = totales.recordset[0];
    const d = directos.recordset[0];
    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: {
        activos: r.activos,
        cerrados_este_anio: r.cerrados_este_anio,
        dias_promedio_cierre: r.dias_promedio_cierre != null ? Math.round(r.dias_promedio_cierre * 10) / 10 : null,
        conteos_fase: conteosFase,
        grupos_directos: d.directos,
        total_activos: d.total_activos,
        pct_directos: d.total_activos ? Math.round((d.directos / d.total_activos) * 100) : 0,
      },
    };
  } catch (err) {
    context.log.error("Error calculando el resumen de grupos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo calcular el resumen." } };
  }
};
