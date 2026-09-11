// avanzarFaseGrupo/index.js
// Function protegida (rol "admin"), ligera a propósito: lo que dispara el
// stepper interactivo de Editar Grupo (clic en el nodo inmediato siguiente).
// Traduce la fase elegida a estatus_curso/estatus_cierre reales (ver
// src/grupo-fase.js) y loguea el cambio en GrupoFaseHistorial — todo en una
// transacción. Solo permite avanzar a la fase INMEDIATA siguiente (nunca
// saltar ni retroceder desde aquí) — el front ya solo deja clicar ese nodo,
// pero se valida también aquí, nunca se confía en lo que mande el cliente.
const { getPool, sql } = require("../src/backoffice-db");
const { FASES, derivarFase, estatusDeFase, registrarCambioFase } = require("../src/grupo-fase");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const grupoId = Number(body.grupoId);
  const faseNueva = (body.faseNueva || "").trim();

  if (!grupoId || !FASES.includes(faseNueva)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el grupo o la fase no es válida." } };
    return;
  }

  try {
    const pool = await getPool();
    const actual = await pool.request().input("id", sql.Int, grupoId).query("SELECT estatus_curso, estatus_cierre, fecha_cierre FROM Grupo WHERE id = @id");
    if (!actual.recordset.length) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese grupo ya no existe." } };
      return;
    }
    const fila = actual.recordset[0];
    const faseAnterior = derivarFase(fila.estatus_curso, fila.estatus_cierre);

    if (FASES.indexOf(faseNueva) !== FASES.indexOf(faseAnterior) + 1) {
      context.res = {
        status: 400,
        headers: JSON_HEADERS,
        body: { error: "Solo puedes avanzar a la fase inmediata siguiente — usa el formulario de Editar para saltar o retroceder." },
      };
      return;
    }

    const { estatusCurso, estatusCierre } = estatusDeFase(faseNueva);
    // Al cerrar, si no hay fecha_cierre capturada todavía, se llena sola con
    // hoy — el stepper es justo el atajo para no tener que abrir el
    // formulario completo solo para poner esa fecha.
    const fechaCierre = faseNueva === "Cerrado" && !fila.fecha_cierre ? new Date() : fila.fecha_cierre;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input("id", sql.Int, grupoId)
        .input("estatusCurso", sql.NVarChar, estatusCurso)
        .input("estatusCierre", sql.NVarChar, estatusCierre)
        .input("fechaCierre", sql.Date, fechaCierre)
        .query("UPDATE Grupo SET estatus_curso = @estatusCurso, estatus_cierre = @estatusCierre, fecha_cierre = @fechaCierre WHERE id = @id");
      await registrarCambioFase(transaction, grupoId, faseNueva, faseAnterior);
      await transaction.commit();
      context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, fase: faseNueva } };
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        context.log.error("Error haciendo rollback:", rollbackErr.message);
      }
      throw err;
    }
  } catch (err) {
    context.log.error("Error avanzando la fase del grupo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo avanzar la fase." } };
  }
};
