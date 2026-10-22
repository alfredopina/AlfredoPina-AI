// editarCuentaCobrar/index.js
// Function protegida (rol "admin"): edita folio/UUID de la factura, fechas, plazo, orden de compra, notas y (solo sin pagos) el monto.
const { enTransaccion, editarCuenta } = require("../src/cobranza-db");

module.exports = async function (context, req) {
  const b = req.body || {};
  await enTransaccion(context, "No se pudo guardar la cuenta por cobrar.", (nr) => editarCuenta(nr, b));
};
