// eliminarCuentaCobrar/index.js
// Function protegida (rol "admin"): borrado REAL de una cuenta por cobrar, solo para ERRORES de captura (excepción pedida por Alfredo 2026-10-25).
// Se rechaza si la cuenta ya tiene pagos (aunque estén anulados) o ya trae folio/UUID de factura: ahí se CANCELA, nunca se borra dinero. Reglas en api/src/cobranza-db.js.
const { enTransaccion, eliminarCuenta } = require("../src/cobranza-db");

module.exports = async function (context, req) {
  const b = req.body || {};
  await enTransaccion(context, "No se pudo eliminar la cuenta.", (nr) => eliminarCuenta(nr, b.id));
};
