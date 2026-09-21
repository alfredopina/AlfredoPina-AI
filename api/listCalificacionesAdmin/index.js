// listCalificacionesAdmin/index.js
// Function protegida (rol "admin"): una fila por Grupo con calificaciones
// cargadas — datos del grupo + resultados generales calculados al vuelo con
// GROUP BY sobre Calificacion (nunca se guardan, así no se desincronizan).
// Alimenta la pestaña Resultados de Calificaciones y, más adelante, el
// reporte por grupo. La calificación promedio topa cada alumno a 100 (los
// puntos extra no inflan el promedio del grupo); la asistencia global es
// asistencias totales ÷ asistencias posibles (alumnos × sesiones), no un
// promedio de porcentajes. fase pasa siempre por derivarFase.
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { derivarFase } = require("../src/grupo-fase");

module.exports = async function (context) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT g.id AS grupo_id, c.nombre AS cliente, cf.nombre AS cliente_final,
             g.herramientas, g.nombre_curso, g.instructor, g.modalidad, g.horas,
             g.fecha_inicio, g.fecha_fin, g.estatus_curso, g.estatus_cierre,
             k.alumnos, k.aprobados, k.participaron, k.no_aprobados,
             k.prom_calificacion, k.asistencias_total, k.asistencias_posibles, k.sesiones, k.ultima_carga
      FROM (
        SELECT grupo_id,
               COUNT(*) AS alumnos,
               SUM(CASE WHEN resultado = 'Aprobado' THEN 1 ELSE 0 END) AS aprobados,
               SUM(CASE WHEN resultado = 'Participó' THEN 1 ELSE 0 END) AS participaron,
               SUM(CASE WHEN resultado = 'No Aprobado' THEN 1 ELSE 0 END) AS no_aprobados,
               AVG(CAST(CASE WHEN calificacion > 100 THEN 100 ELSE calificacion END AS FLOAT)) AS prom_calificacion,
               SUM(asistencias) AS asistencias_total,
               SUM(frecuencias) AS asistencias_posibles,
               MAX(frecuencias) AS sesiones,
               MAX(fecha_carga) AS ultima_carga
        FROM Calificacion
        GROUP BY grupo_id
      ) k
      JOIN Grupo g ON g.id = k.grupo_id
      JOIN Cliente c ON c.id = g.cliente_id
      LEFT JOIN Cliente cf ON cf.id = g.cliente_final_id
      ORDER BY k.ultima_carga DESC
    `);
    const filas = result.recordset.map((r) => ({ ...r, fase: derivarFase(r.estatus_curso, r.estatus_cierre) }));
    context.res = { status: 200, headers: JSON_HEADERS, body: filas };
  } catch (err) {
    context.log.error("Error listando calificaciones:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los resultados." } };
  }
};
