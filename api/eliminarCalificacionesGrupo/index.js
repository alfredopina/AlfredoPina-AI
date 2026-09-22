// eliminarCalificacionesGrupo/index.js
// Function protegida (rol "admin"): borra TODAS las calificaciones de un
// Grupo (Resultados → Eliminar) — borrado real, pedido explícito de Alfredo
// (mismo criterio que eliminarGrupo/eliminarRespuestaDiagnostico/
// eliminarRespuestaEncuesta: excepción a "nunca borres datos de verdad",
// siempre con confirm() fuerte en el front). NO toca al Alumno (la persona
// puede tener historial en otro grupo). Regresa el grupo a la fase
// "Calificaciones" (pedido explícito de Alfredo, sin importar de dónde venía
// — puede ser un salto hacia adelante o hacia atrás según el caso); si no
// tenía nada que borrar, no se toca la fase. Si el grupo estaba en Cerrado se
// limpia fecha_cierre, mismo criterio que avanzarFaseGrupo al salir de
// Cerrado.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { derivarFase, estatusDeFase, registrarCambioFase } = require("../src/grupo-fase");

module.exports = async function (context, req) {
  const body = req.body || {};
  const grupoId = Number(body.grupoId);
  if (!grupoId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el grupo." } };
    return;
  }

  try {
    const pool = await getPool();
    const g = await pool
      .request()
      .input("id", sql.Int, grupoId)
      .query("SELECT estatus_curso, estatus_cierre, fecha_cierre FROM Grupo WHERE id = @id");
    if (!g.recordset.length) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese grupo ya no existe." } };
      return;
    }

    const conteo = await pool.request().input("id", sql.Int, grupoId).query("SELECT COUNT(*) AS n FROM Calificacion WHERE grupo_id = @id");
    const alumnosEliminados = conteo.recordset[0].n;
    if (!alumnosEliminados) {
      context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Este grupo no tiene calificaciones cargadas." } };
      return;
    }

    const faseAnterior = derivarFase(g.recordset[0].estatus_curso, g.recordset[0].estatus_cierre);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction).input("id", sql.Int, grupoId).query("DELETE FROM Calificacion WHERE grupo_id = @id");

      if (faseAnterior !== "Calificaciones") {
        const { estatusCurso, estatusCierre } = estatusDeFase("Calificaciones");
        const fechaCierre = faseAnterior === "Cerrado" ? null : g.recordset[0].fecha_cierre;
        await new sql.Request(transaction)
          .input("id", sql.Int, grupoId)
          .input("estatusCurso", sql.NVarChar, estatusCurso)
          .input("estatusCierre", sql.NVarChar, estatusCierre)
          .input("fechaCierre", sql.Date, fechaCierre)
          .query("UPDATE Grupo SET estatus_curso = @estatusCurso, estatus_cierre = @estatusCierre, fecha_cierre = @fechaCierre WHERE id = @id");
        await registrarCambioFase(transaction, grupoId, "Calificaciones", faseAnterior);
      }

      await transaction.commit();
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        context.log.error("Error haciendo rollback:", rollbackErr.message);
      }
      throw err;
    }

    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, alumnosEliminados, fase: "Calificaciones", faseAnterior } };
  } catch (err) {
    context.log.error("Error eliminando calificaciones:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron eliminar las calificaciones." } };
  }
};
