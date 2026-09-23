// api/src/diplomas-snapshot.js
// Reconstruye y guarda el snapshot público (Table Storage) de los diplomas de
// UN grupo — lo usan generarDiplomas, anularDiploma y eliminarDiplomasGrupo
// cada vez que cambia algo, para que el link ya compartido con el cliente
// siempre refleje el estado vigente (ver diplomas-reportes.js).
const { sql } = require("./backoffice-db");
const { nivelTexto } = require("./diploma-folio");
const { getDiplomasGrupoTable, guardarDiplomasGrupo } = require("./diplomas-reportes");

async function reconstruirSnapshotGrupo(pool, grupoId, token) {
  const g = (
    await pool.request().input("grupoId", sql.Int, grupoId).query(
      `SELECT cli.nombre AS cliente, cli.codigo AS cliente_codigo, clf.nombre AS cliente_final,
              g.nombre_curso, g.herramientas, g.niveles, g.instructor, g.modalidad, g.fecha_inicio, g.fecha_fin, g.horas
       FROM Grupo g JOIN Cliente cli ON cli.id = g.cliente_id LEFT JOIN Cliente clf ON clf.id = g.cliente_final_id WHERE g.id = @grupoId`
    )
  ).recordset[0];
  if (!g) return;

  const todos = await pool
    .request()
    .input("grupoId", sql.Int, grupoId)
    .query(
      `SELECT d.folio, a.nombre_completo AS nombre, a.correo, d.resultado, d.estatus, d.motivo_anulacion, d.fecha_generacion
       FROM Diploma d JOIN Alumno a ON a.id = d.alumno_id WHERE d.grupo_id = @grupoId ORDER BY a.nombre_completo`
    );

  const snapshot = {
    grupoId,
    actualizadoEn: new Date().toISOString(),
    cliente: g.cliente_final || g.cliente,
    clienteVia: g.cliente_final ? g.cliente : null,
    clienteCodigo: g.cliente_codigo,
    curso: g.nombre_curso || "",
    herramientas: g.herramientas,
    nivel: nivelTexto(g.niveles),
    instructor: g.instructor || "",
    modalidad: g.modalidad || "",
    fechaInicio: g.fecha_inicio,
    fechaFin: g.fecha_fin,
    horas: g.horas,
    alumnos: todos.recordset,
  };
  await guardarDiplomasGrupo(getDiplomasGrupoTable(), { token, snapshot });
}

module.exports = { reconstruirSnapshotGrupo };
