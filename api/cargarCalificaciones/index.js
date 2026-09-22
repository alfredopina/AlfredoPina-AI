// cargarCalificaciones/index.js
// Function protegida (rol "admin"): registra las calificaciones de un Grupo
// (lo que se pega del Excel en Calificaciones → Cargar, o el flujo de Editar
// desde Resultados). Por cada fila da de alta o reutiliza el Alumno (ligado
// al cliente FINAL del grupo si lo tiene, si no al cliente que contrató) y
// REEMPLAZA el set completo del grupo — todo en una transacción, o entra todo
// o no entra nada. Es idempotente, así que el front puede reintentar sin
// miedo si la base estaba dormida. NO mueve la fase del grupo: eso lo
// confirma Alfredo en una ventana y lo hace avanzarFaseGrupo (ver esa
// Function; ya acepta moverse a cualquier fase, no solo la siguiente).
// `soloActualizar: true` (modo Editar, ver Resultados → Editar) se salta la
// validación de fase calificable — Editar debe poder tocar un grupo ya en
// Diplomas o Cerrado, que el flujo normal de Cargar ni siquiera deja elegir.
// `notaGeneral` es un texto del GRUPO (no de un alumno) que se replica igual
// en cada fila (ver sql/024 — decisión de no crear una tabla aparte solo
// para esto).
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { derivarFase } = require("../src/grupo-fase");
const { resolverAlumno } = require("../src/alumnos");
const { validarFilas, validarNotaGeneral, FASES_CALIFICABLES } = require("../src/calificaciones-calc");

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

  const notaGeneralR = validarNotaGeneral(body.notaGeneral);
  if (notaGeneralR.error) return fallo(context, 400, "La nota general " + notaGeneralR.error + ".");
  const notaGeneral = notaGeneralR.valor;
  const soloActualizar = body.soloActualizar === true;

  try {
    const pool = await getPool();
    const g = await pool
      .request()
      .input("id", sql.Int, grupoId)
      .query("SELECT cliente_id, cliente_final_id, estatus_curso, estatus_cierre FROM Grupo WHERE id = @id");
    if (!g.recordset.length) return fallo(context, 404, "Ese grupo ya no existe.");

    const fase = derivarFase(g.recordset[0].estatus_curso, g.recordset[0].estatus_cierre);
    if (!soloActualizar && !FASES_CALIFICABLES.includes(fase)) {
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
        const alumnoId = await resolverAlumno(nuevoRequest, clienteId, f.nombreCompleto, f.correo);
        await nuevoRequest()
          .input("grupoId", sql.Int, grupoId)
          .input("alumnoId", sql.Int, alumnoId)
          .input("puntos", sql.Decimal(5, 1), f.puntos)
          .input("asistencias", sql.Int, f.asistencias)
          .input("frecuencias", sql.Int, f.frecuencias)
          .input("proyecto", sql.Decimal(5, 1), f.proyecto)
          .input("calificacion", sql.Decimal(5, 1), f.calificacion)
          .input("resultado", sql.NVarChar, f.resultado)
          .input("notas", sql.NVarChar, f.notas)
          .input("notaGeneral", sql.NVarChar, notaGeneral)
          .query(
            `INSERT INTO Calificacion (grupo_id, alumno_id, puntos, asistencias, frecuencias, proyecto, calificacion, resultado, notas, nota_general)
             VALUES (@grupoId, @alumnoId, @puntos, @asistencias, @frecuencias, @proyecto, @calificacion, @resultado, @notas, @notaGeneral)`
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

    const conteo = (r) => filas.filter((f) => f.resultado === r).length;
    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: { ok: true, alumnos: filas.length, fase, aprobados: conteo("Aprobado"), participaron: conteo("Participó"), no_aprobados: conteo("No Aprobado") },
    };
  } catch (err) {
    context.log.error("Error cargando calificaciones:", err.message);
    // endpoint solo de admin: se devuelve el mensaje real de la base para poder
    // diagnosticar sin abrir los logs (ej. "Invalid object name" = falta correr el SQL)
    fallo(context, 500, "Error de base de datos: " + err.message);
  }
};
