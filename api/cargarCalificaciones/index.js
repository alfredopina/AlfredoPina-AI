// cargarCalificaciones/index.js
// Function protegida (rol "admin"): registra las calificaciones de un Grupo
// (lo que se pega del Excel en Calificaciones → Cargar). Por cada fila da de
// alta o reutiliza el Alumno (ligado al cliente FINAL del grupo si lo tiene,
// si no al cliente que contrató) y REEMPLAZA el set completo del grupo — todo
// en una transacción, o entra todo o no entra nada. Es idempotente, así que
// el front puede reintentar sin miedo si la base estaba dormida. NO mueve la
// fase del grupo: eso lo confirma Alfredo en una ventana y lo hace
// avanzarFaseGrupo, una fase a la vez (queda todo en el historial).
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { derivarFase } = require("../src/grupo-fase");
const { resolverAlumno } = require("../src/alumnos");
const { validarFilas, FASES_CALIFICABLES } = require("../src/calificaciones-calc");

function fallo(context, status, error, extra) {
  context.res = { status, headers: JSON_HEADERS, body: { error, ...extra } };
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const grupoId = Number(body.grupoId);
  if (!grupoId) return fallo(context, 400, "Falta elegir el grupo.");

  const { filas, errores } = validarFilas(body.alumnos);
  if (errores.length) {
    const resto = errores.length > 3 ? ` (y ${errores.length - 3} más)` : "";
    return fallo(context, 400, "Revisa el grid: " + errores.slice(0, 3).join(" · ") + resto, { errores });
  }
  if (!filas.length) return fallo(context, 400, "El grid no trae alumnos.");

  try {
    const pool = await getPool();
    const g = await pool
      .request()
      .input("id", sql.Int, grupoId)
      .query("SELECT cliente_id, cliente_final_id, estatus_curso, estatus_cierre FROM Grupo WHERE id = @id");
    if (!g.recordset.length) return fallo(context, 404, "Ese grupo ya no existe.");

    const fase = derivarFase(g.recordset[0].estatus_curso, g.recordset[0].estatus_cierre);
    if (!FASES_CALIFICABLES.includes(fase)) {
      return fallo(context, 400, `Un grupo en fase "${fase}" no se califica — solo de En curso a Diplomas.`);
    }
    // los alumnos son del cliente FINAL (la empresa donde trabajan); si el
    // grupo es directo no hay cliente final y es el mismo que contrató
    const clienteId = g.recordset[0].cliente_final_id || g.recordset[0].cliente_id;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const nuevoRequest = () => new sql.Request(transaction);
      await nuevoRequest().input("grupoId", sql.Int, grupoId).query("DELETE FROM Calificacion WHERE grupo_id = @grupoId");

      for (const f of filas) {
        const alumnoId = await resolverAlumno(nuevoRequest, clienteId, f.nombreCompleto);
        await nuevoRequest()
          .input("grupoId", sql.Int, grupoId)
          .input("alumnoId", sql.Int, alumnoId)
          .input("participacion", sql.Int, f.participacion)
          .input("asistencia", sql.Int, f.asistencia)
          .input("proyecto", sql.Int, f.proyecto)
          .input("resultado", sql.NVarChar, f.resultado)
          .query(
            `INSERT INTO Calificacion (grupo_id, alumno_id, participacion, asistencia, proyecto, resultado)
             VALUES (@grupoId, @alumnoId, @participacion, @asistencia, @proyecto, @resultado)`
          );
      }
      await transaction.commit();
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        context.log.error("Error haciendo rollback:", rollbackErr.message);
      }
      // 2627/2601 = el UNIQUE(grupo, alumno): dos nombres distintos del grid
      // que resolvieron al mismo Alumno (ej. "José" y "Jose" ya dados de alta)
      if (err.number === 2627 || err.number === 2601) {
        return fallo(context, 400, "Dos filas del grid corresponden al mismo alumno — revisa nombres repetidos.");
      }
      throw err;
    }

    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, alumnos: filas.length, fase } };
  } catch (err) {
    context.log.error("Error cargando calificaciones:", err.message);
    fallo(context, 500, "No se pudieron guardar las calificaciones.");
  }
};
