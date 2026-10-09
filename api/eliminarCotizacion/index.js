// eliminarCotizacion/index.js
// Function protegida (rol "admin"): borrado REAL de una Cotización y de su propuesta web. Reglas en
// api/src/cotizacion-eliminar.js. SQL dentro de una transacción; la propuesta (Table Storage) se borra después,
// y si eso falla no se revierte nada: una propuesta huérfana en Storage es inofensiva.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { eliminarCotizacionDe } = require("../src/cotizacion-eliminar");
const { getPropuestasTable, codigoDePropuesta, eliminarPropuesta } = require("../src/propuestas");

module.exports = async function (context, req) {
  const id = Number((req.body || {}).id);
  let transaction;
  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const r = await eliminarCotizacionDe(() => new sql.Request(transaction), id);
    await transaction.commit();
    const codigo = codigoDePropuesta(r.blobPath);
    if (codigo) await eliminarPropuesta(getPropuestasTable(), codigo);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, folio: r.folio, solicitudReabierta: r.solicitudReabierta } };
  } catch (err) {
    try { if (transaction) await transaction.rollback(); } catch (_) { /* ya cerrada */ }
    if (err.safe) {
      context.res = { status: err.status || 400, headers: JSON_HEADERS, body: { error: err.message } };
      return;
    }
    context.log.error("Error eliminando la cotización:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar la cotización." } };
  }
};
