// getCalificacionesGrupo/index.js
// Function protegida (rol "admin"): las calificaciones ya cargadas de UN grupo
// (?grupoId=). Sirve para precargar el grid cuando se vuelve a elegir un grupo
// ya calificado (flujo normal o Editar desde Resultados) — así "volver a
// cargar" edita lo guardado en vez de partir de cero, y nunca quedan alumnos
// fantasma de una carga anterior. También alimenta el desglose por alumno que
// se despliega desde el pill "Alumnos" de Resultados. Trae calificacion y
// resultado ya calculados (el grid los recalcula en vivo al editar; el
// desglose de Resultados los usa tal cual, ya con su semáforo). nota_general
// es la misma en todas las filas del grupo (ver sql/024) — el front toma la
// del primer registro.
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
        `SELECT a.nombre_completo AS nombre, a.correo, c.puntos, c.asistencias, c.frecuencias, c.proyecto,
                c.calificacion, c.resultado, c.notas, c.nota_general, c.fecha_carga
         FROM Calificacion c
         JOIN Alumno a ON a.id = c.alumno_id
         WHERE c.grupo_id = @grupoId
         ORDER BY c.id`
      );
    context.res = { status: 200, headers: JSON_HEADERS, body: r.recordset };
  } catch (err) {
    context.log.error("Error leyendo calificaciones del grupo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron leer las calificaciones del grupo." } };
  }
};
