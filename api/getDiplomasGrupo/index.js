// getDiplomasGrupo/index.js
// Function protegida (rol "admin"): el desglose por alumno de los diplomas
// de UN grupo (?grupoId=) — alimenta el pill "Alumnos" de Consultar Diplomas,
// mismo patrón que getCalificacionesGrupo en Resultados de Calificaciones.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const grupoId = Number(req.query.grupoId);
  if (!grupoId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el grupo." } };
    return;
  }
  try {
    const pool = await getPool();
    const r = await pool
      .request()
      .input("grupoId", sql.Int, grupoId)
      .query(
        `SELECT d.folio, a.nombre_completo AS nombre, a.correo, d.resultado, d.estatus, d.motivo_anulacion,
                d.fecha_generacion, d.corrige_a_folio, c.calificacion
         FROM Diploma d
         JOIN Alumno a ON a.id = d.alumno_id
         LEFT JOIN Calificacion c ON c.grupo_id = d.grupo_id AND c.alumno_id = d.alumno_id
         WHERE d.grupo_id = @grupoId
         ORDER BY a.nombre_completo`
      );
    context.res = { status: 200, headers: JSON_HEADERS, body: r.recordset };
  } catch (err) {
    context.log.error("Error leyendo diplomas del grupo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron leer los diplomas del grupo." } };
  }
};
