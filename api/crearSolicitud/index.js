// crearSolicitud/index.js
// Function protegida (rol "admin"): alta MANUAL de una Solicitud desde el formulario Crear del admin. Toda la
// lógica (cliente existente o Prospecto nuevo con código único, contacto, programa estándar o personalizado,
// participantes/modalidad, "recibida el") vive en api/src/solicitud-guardar.js; aquí solo se abre la transacción
// para que cliente + contacto + solicitud se guarden juntos o no se guarde nada. canal_origen siempre "Manual".
// temas_json es una FOTO completa del desglose de temas al momento de crear la solicitud (no una referencia
// viva): un cambio futuro al banco de temas no altera solicitudes ya capturadas.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { crearSolicitudManual } = require("../src/solicitud-guardar");

module.exports = async function (context, req) {
  const body = req.body || {};
  let transaction;
  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const resultado = await crearSolicitudManual(() => new sql.Request(transaction), body);
    await transaction.commit();
    context.res = { status: 200, headers: JSON_HEADERS, body: resultado };
  } catch (err) {
    try { if (transaction) await transaction.rollback(); } catch (_) { /* ya cerrada */ }
    if (err.safe) {
      context.res = { status: err.status || 400, headers: JSON_HEADERS, body: { error: err.message } };
      return;
    }
    context.log.error("Error creando la solicitud:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo crear la solicitud." } };
  }
};
