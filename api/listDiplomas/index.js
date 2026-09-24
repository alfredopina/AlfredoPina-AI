// listDiplomas/index.js
// Function protegida (rol "admin"): una fila por GRUPO que ya tiene al menos
// un diploma generado — filtros (Cliente/Herramienta/Curso/Instructor/Fechas)
// son del lado del cliente sobre esta misma lista, mismo criterio que
// Resultados de Calificaciones (listCalificacionesAdmin). El desglose de
// alumnos se pide aparte con getDiplomasGrupo.
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT g.id AS grupo_id, cli.nombre AS cliente, cli.codigo AS cliente_codigo, clf.nombre AS cliente_final, clf.codigo AS cliente_final_codigo, ct.nombre AS contacto,
             g.nombre_curso, g.herramientas, g.instructor, g.modalidad, g.fecha_inicio, g.fecha_fin, g.horas, g.diploma_token,
             COUNT(d.folio) AS total, SUM(CASE WHEN d.estatus = 'vigente' THEN 1 ELSE 0 END) AS vigentes,
             SUM(CASE WHEN d.estatus = 'anulado' THEN 1 ELSE 0 END) AS anulados, MAX(d.fecha_generacion) AS ultima_generacion
      FROM Diploma d
      JOIN Grupo g ON g.id = d.grupo_id
      JOIN Cliente cli ON cli.id = g.cliente_id
      LEFT JOIN Cliente clf ON clf.id = g.cliente_final_id
      LEFT JOIN Contacto ct ON ct.id = g.contacto_id
      GROUP BY g.id, cli.nombre, cli.codigo, clf.nombre, clf.codigo, ct.nombre, g.nombre_curso, g.herramientas, g.instructor, g.modalidad, g.fecha_inicio, g.fecha_fin, g.horas, g.diploma_token
      ORDER BY MAX(d.fecha_generacion) DESC
    `);
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error listando diplomas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los diplomas: " + err.message } };
  }
};
