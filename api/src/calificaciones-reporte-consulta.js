// api/src/calificaciones-reporte-consulta.js
// Lee las filas de Calificacion (una por alumno) que van a un Reporte de
// Resultados — filtradas por UN grupo exacto (?grupoId=, el botón "Reporte"
// de cada fila de Resultados) o por los mismos filtros que el panel
// (Empresa/Herramienta/Curso/Instructor/Fechas), igual que
// generarReporteEncuesta filtra con leerRespuestasFiltradas. Cada fila trae
// ya la metadata de su Grupo (curso, herramientas, instructor, fechas,
// cliente) para que el cálculo no tenga que volver a pedir nada.
const { sql } = require("./backoffice-db");

async function leerCalificacionesFiltradas(pool, { grupoId, empresa, herramienta, curso, instructor, desde, hasta }) {
  const request = pool.request();
  const condiciones = [];

  if (grupoId) {
    condiciones.push("g.id = @grupoId");
    request.input("grupoId", sql.Int, grupoId);
  } else {
    if (empresa) {
      condiciones.push("(cli.nombre LIKE @empresa OR clf.nombre LIKE @empresa)");
      request.input("empresa", sql.NVarChar, `%${empresa}%`);
    }
    if (herramienta) {
      condiciones.push("g.herramientas LIKE @herramienta");
      request.input("herramienta", sql.NVarChar, `%"${herramienta}"%`);
    }
    if (curso) {
      condiciones.push("g.nombre_curso LIKE @curso");
      request.input("curso", sql.NVarChar, `%${curso}%`);
    }
    if (instructor) {
      condiciones.push("g.instructor = @instructor");
      request.input("instructor", sql.NVarChar, instructor);
    }
    if (desde) {
      condiciones.push("g.fecha_inicio >= @desde");
      request.input("desde", sql.Date, new Date(desde));
    }
    if (hasta) {
      condiciones.push("g.fecha_inicio <= @hasta");
      request.input("hasta", sql.Date, new Date(hasta));
    }
  }

  const where = condiciones.length ? "WHERE " + condiciones.join(" AND ") : "";
  const result = await request.query(`
    SELECT c.id, c.grupo_id, c.puntos, c.asistencias, c.frecuencias, c.proyecto, c.calificacion, c.resultado,
           c.notas, c.nota_general, c.fecha_carga,
           a.id AS alumno_id, a.nombre_completo AS alumno, a.correo,
           g.cliente_id, g.nombre_curso, g.herramientas, g.niveles, g.horas, g.instructor, g.modalidad, g.fecha_inicio, g.fecha_fin,
           cli.nombre AS cliente, cli.codigo AS cliente_codigo, clf.nombre AS cliente_final, clf.codigo AS cliente_final_codigo
    FROM Calificacion c
    JOIN Alumno a ON a.id = c.alumno_id
    JOIN Grupo g ON g.id = c.grupo_id
    JOIN Cliente cli ON cli.id = g.cliente_id
    LEFT JOIN Cliente clf ON clf.id = g.cliente_final_id
    ${where}
    ORDER BY g.fecha_inicio DESC, a.nombre_completo ASC
  `);
  return result.recordset;
}

module.exports = { leerCalificacionesFiltradas };
