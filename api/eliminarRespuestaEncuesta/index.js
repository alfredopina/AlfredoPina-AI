// eliminarRespuestaEncuesta/index.js
// Function protegida (rol "admin"): borra un envío completo de Encuesta
// (cabecera + detalle) — borrado real, no un archivar. Es la 3ra excepción
// explícita a "nunca borrar de verdad" (las otras: eliminarGrupo y
// eliminarRespuestaDiagnostico), pedida por Alfredo para limpiar pruebas y
// duplicados. El front pide confirmación fuerte antes de llamar esto.
//
// Después del commit se resta 1 de los contadores en vivo (Table Storage, ver
// encuesta-links.js): del total global y del link de su grupo, y del "hoy"
// SOLO si la respuesta borrada fue de hoy (día en hora de México) — borrar una
// de hace días no debe bajar el "hoy". Mejor esfuerzo: si el contador falla,
// la respuesta ya se borró y no se le avisa error a Alfredo.
const { getPool, sql } = require("../src/backoffice-db");
const { getEncuestaLinksTable, buscarLinkPorGrupo, ajustarContadores } = require("../src/encuesta-links");
const { fechaMexico } = require("../src/encuesta-logic");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const id = Number((req.body || {}).id);
  if (!Number.isInteger(id) || id <= 0) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id de la respuesta." } };
    return;
  }

  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    let grupoId = null;
    let fecha = null;
    try {
      await transaction.begin();
      const previa = await new sql.Request(transaction)
        .input("id", sql.Int, id)
        .query("SELECT grupo_id, CONVERT(VARCHAR(10), fecha, 23) AS fecha FROM EncuestaRespuesta WHERE id = @id");
      if (!previa.recordset.length) {
        await transaction.rollback();
        context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa respuesta ya no existe." } };
        return;
      }
      grupoId = previa.recordset[0].grupo_id;
      fecha = previa.recordset[0].fecha;

      await new sql.Request(transaction).input("id", sql.Int, id).query("DELETE FROM EncuestaRespuestaDetalle WHERE respuesta_id = @id");
      await new sql.Request(transaction).input("id", sql.Int, id).query("DELETE FROM EncuestaRespuesta WHERE id = @id");
      await transaction.commit();
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        context.log.error("Error haciendo rollback:", rollbackErr.message);
      }
      throw err;
    }

    try {
      const linksTable = getEncuestaLinksTable();
      const link = grupoId != null ? await buscarLinkPorGrupo(linksTable, grupoId) : null;
      await ajustarContadores(linksTable, { token: link ? link.token : null, delta: -1, descontarHoy: fecha === fechaMexico(new Date()) });
    } catch (err) {
      context.log.warn("La respuesta se borró pero no se pudo restar del contador en vivo:", err.message);
    }

    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando la respuesta de encuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar: " + err.message } };
  }
};
