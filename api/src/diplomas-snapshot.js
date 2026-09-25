// api/src/diplomas-snapshot.js
// Reconstruye y guarda lo público de los diplomas de UN grupo — lo usan
// generarDiplomas, anularDiploma, cargarCalificaciones (al editar) y
// eliminarDiplomasGrupo cada vez que cambia algo:
//   1) el snapshot del link del grupo (Table Storage "DiplomasGrupo", ver
//      diplomas-reportes.js) para que el link ya compartido siempre refleje
//      el estado vigente;
//   2) los registros de verificación por diploma (Table Storage
//      "DiplomasVerif", ver diplomas-verif.js) que lee /verificar.
// De paso asigna el código de verificación (el del QR) a los diplomas que aún
// no lo tienen — así los emitidos antes de esta función lo reciben solos la
// próxima vez que se genere o actualice su grupo.
const { sql } = require("./backoffice-db");
const { nivelTexto } = require("./diploma-folio");
const { codigoCortoUnico } = require("./codigo-corto");
const { getDiplomasGrupoTable, guardarDiplomasGrupo } = require("./diplomas-reportes");
const { getDiplomasVerifTable, guardarRegistros } = require("./diplomas-verif");
const { getPerfilPublicoInstructor } = require("./plantillas-storage");

const iso = (f) => (f ? (f instanceof Date ? f.toISOString() : String(f)).slice(0, 10) : null);

async function asegurarCodigos(pool, filas) {
  for (const f of filas) {
    if (f.codigo_verif) continue;
    const codigo = await codigoCortoUnico(async (c) => {
      const r = await pool.request().input("c", sql.NVarChar, c).query("SELECT 1 FROM Diploma WHERE codigo_verif = @c");
      return r.recordset.length > 0;
    });
    await pool.request().input("c", sql.NVarChar, codigo).input("folio", sql.NVarChar, f.folio).query("UPDATE Diploma SET codigo_verif = @c WHERE folio = @folio");
    f.codigo_verif = codigo;
  }
}

async function reconstruirSnapshotGrupo(pool, grupoId, token) {
  const g = (
    await pool.request().input("grupoId", sql.Int, grupoId).query(
      `SELECT cli.nombre AS cliente, cli.codigo AS cliente_codigo, clf.nombre AS cliente_final,
              g.nombre_curso, g.herramientas, g.niveles, g.instructor, g.modalidad, g.fecha_inicio, g.fecha_fin, g.horas
       FROM Grupo g JOIN Cliente cli ON cli.id = g.cliente_id LEFT JOIN Cliente clf ON clf.id = g.cliente_final_id WHERE g.id = @grupoId`
    )
  ).recordset[0];
  if (!g) return;

  const todos = (
    await pool
      .request()
      .input("grupoId", sql.Int, grupoId)
      .query(
        `SELECT d.folio, d.codigo_verif, a.nombre_completo AS nombre, a.correo, d.resultado, d.estatus, d.motivo_anulacion, d.fecha_generacion,
                d.herramientas, d.curso, d.nivel, d.fecha_inicio, d.fecha_fin, d.instructor, d.horas
         FROM Diploma d JOIN Alumno a ON a.id = d.alumno_id WHERE d.grupo_id = @grupoId ORDER BY a.nombre_completo`
      )
  ).recordset;
  await asegurarCodigos(pool, todos);

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
    alumnos: todos.map((d) => ({
      folio: d.folio,
      codigoVerif: d.codigo_verif,
      nombre: d.nombre,
      correo: d.correo,
      resultado: d.resultado,
      estatus: d.estatus,
      motivo_anulacion: d.motivo_anulacion,
      fecha_generacion: d.fecha_generacion,
    })),
  };
  await guardarDiplomasGrupo(getDiplomasGrupoTable(), { token, snapshot });

  // registros de verificación: datos CONGELADOS en cada Diploma (curso, nivel,
  // fechas, instructor, horas, resultado) + lo del grupo que no se congeló
  // (modalidad) + "lo que aprendió" y el perfil del instructor
  const apr = await pool.request().input("grupoId", sql.Int, grupoId).query("SELECT TOP 1 aprendizaje FROM Calificacion WHERE grupo_id = @grupoId AND aprendizaje IS NOT NULL");
  const aprendizaje = apr.recordset.length ? String(apr.recordset[0].aprendizaje).split("\n").filter(Boolean) : [];
  const perfiles = new Map();
  const registros = [];
  for (const d of todos) {
    const nombreInstructor = d.instructor || g.instructor || "";
    if (!perfiles.has(nombreInstructor)) perfiles.set(nombreInstructor, await getPerfilPublicoInstructor(nombreInstructor));
    let herramientas = [];
    try { herramientas = JSON.parse(d.herramientas || "[]"); } catch (e) { herramientas = []; }
    registros.push({
      folio: d.folio,
      codigo: d.codigo_verif,
      grupoId,
      datos: {
        folio: d.folio,
        codigo: d.codigo_verif,
        nombre: d.nombre,
        curso: d.curso || g.nombre_curso || "",
        nivel: d.nivel || nivelTexto(g.niveles),
        herramientas,
        fechaInicio: iso(d.fecha_inicio),
        fechaFin: iso(d.fecha_fin),
        horas: d.horas || g.horas || null,
        modalidad: g.modalidad || "",
        resultado: d.resultado,
        estatus: d.estatus,
        emitido: iso(d.fecha_generacion),
        instructor: perfiles.get(nombreInstructor),
        aprendizaje,
      },
    });
  }
  await guardarRegistros(getDiplomasVerifTable(), registros);
}

module.exports = { reconstruirSnapshotGrupo };
