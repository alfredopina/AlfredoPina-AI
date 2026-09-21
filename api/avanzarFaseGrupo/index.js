// avanzarFaseGrupo/index.js
// Function protegida (rol "admin"), ligera a propósito: lo que dispara el
// stepper interactivo de "Mover fase" (clic en cualquier nodo) y el flujo de
// Calificaciones (que la llama de una fase a la vez).
// Traduce la fase elegida a estatus_curso/estatus_cierre reales (ver
// src/grupo-fase.js) y loguea el cambio en GrupoFaseHistorial — todo en una
// transacción. Desde 2026-09-21 permite AVANZAR (una o varias fases) y
// REGRESAR a cualquier fase distinta de la actual — antes solo la inmediata
// siguiente. El nombre se queda por compatibilidad con quien ya la llama.
// El historial solo registra la fase de destino con la fecha de AHORA (nunca
// inventa fechas de las fases saltadas, igual que editarGrupo); al regresar,
// "días en fase" vuelve a contar desde hoy. Al SALIR de Cerrado se limpia
// fecha_cierre (el grupo ya no está cerrado; la fecha real queda en el
// historial y se vuelve a llenar sola si se cierra otra vez).
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

    if (faseNueva === faseAnterior) {
      context.res = { status: 400, headers: JSON_HEADERS, body: { error: `El grupo ya está en la fase "${faseAnterior}".` } };
      return;
    }

    const { estatusCurso, estatusCierre } = estatusDeFase(faseNueva);
    // Al cerrar, si no hay fecha_cierre capturada todavía, se llena sola con
    // hoy — el stepper es justo el atajo para no tener que abrir el
    // formulario completo solo para poner esa fecha.
    let fechaCierre = fila.fecha_cierre;
    if (faseNueva === "Cerrado" && !fechaCierre) fechaCierre = new Date();
    else if (faseAnterior === "Cerrado" && faseNueva !== "Cerrado") fechaCierre = null; // reabrir el grupo

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
      context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, fase: faseNueva, faseAnterior } };
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
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo mover la fase." } };
  }
};
