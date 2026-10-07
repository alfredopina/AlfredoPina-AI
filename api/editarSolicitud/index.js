// editarSolicitud/index.js
// Function protegida (rol "admin"): MODIFICAR una Solicitud — el mismo formulario que Crear, con los datos
// precargados (api/src/solicitud-guardar.js#editarSolicitudManual). Desde aquí también se corrige un Prospecto
// (nombre, código, contacto) o se cambia la solicitud a otro cliente (Prospecto → Cliente existente, o Cliente →
// Prospecto nuevo). El estatus NO se toca (lo mueven Cotizar/Descartar/Reabrir). Una cotización ya generada
// conserva sus propios datos: editar la solicitud después no la actualiza.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { editarSolicitudManual } = require("../src/solicitud-guardar");

module.exports = async function (context, req) {
  const body = req.body || {};
  let transaction;
  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const resultado = await editarSolicitudManual(() => new sql.Request(transaction), Number(body.id), body);
    await transaction.commit();
    context.res = { status: 200, headers: JSON_HEADERS, body: resultado };
  } catch (err) {
    try { if (transaction) await transaction.rollback(); } catch (_) { /* ya cerrada */ }
    if (err.safe) {
      context.res = { status: err.status || 400, headers: JSON_HEADERS, body: { error: err.message } };
      return;
    }
    context.log.error("Error editando la solicitud:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar la edición." } };
  }
};
