// eliminarRespuestaDiagnostico/index.js
// Function protegida (rol "admin"): borra un envío completo de Diagnóstico
// (cabecera + detalle) — borrado real, no un archivar/cambiar-estatus como
// el resto del proyecto. Es la 2da excepción explícita a "nunca borrar de
// verdad" (la 1ra es eliminarGrupo) — pedida por Alfredo directo desde
// Resultados, para limpiar envíos de prueba o duplicados mientras carga el
// banco real. El front pide confirmación explícita antes de llamar esto,
// mismo patrón que eliminarGrupo.
const { getPool, sql } = require("../src/backoffice-db");
const { getDiagnosticoContadorTable, ajustarContadorDiagnostico } = require("../src/diagnostico-contador");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const id = Number((req.body || {}).id);
  if (!Number.isInteger(id) || id <= 0) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id de la respuesta." } };
    return;
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    // herramienta de la respuesta, para restarla del contador en vivo después
    const previa = await new sql.Request(transaction)
      .input("id", sql.Int, id)
      .query("SELECT herramienta FROM DiagnosticoRespuesta WHERE id = @id");
    const herramienta = previa.recordset[0] ? previa.recordset[0].herramienta : null;
    await new sql.Request(transaction)
      .input("id", sql.Int, id)
      .query("DELETE FROM DiagnosticoRespuestaDetalle WHERE respuesta_id = @id");
    const result = await new sql.Request(transaction)
      .input("id", sql.Int, id)
      .query("DELETE FROM DiagnosticoRespuesta WHERE id = @id");
    await transaction.commit();

    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa respuesta ya no existe." } };
      return;
    }
    // contador en vivo (Table Storage) — best-effort, la respuesta ya se borró
    try {
      await ajustarContadorDiagnostico(getDiagnosticoContadorTable(), herramienta, -1);
    } catch (errContador) {
      context.log.error("No se pudo restar del contador de diagnósticos:", errContador.message);
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      context.log.error("Error haciendo rollback:", rollbackErr.message);
    }
    context.log.error("Error eliminando la respuesta del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar: " + err.message } };
  }
};
