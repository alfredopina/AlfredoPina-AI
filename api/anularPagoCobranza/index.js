// anularPagoCobranza/index.js
// Function protegida (rol "admin"): anula un pago (queda en el historial, no se borra) y recalcula el estatus de la cuenta.
const { enTransaccion, anularPago } = require("../src/cobranza-db");

module.exports = async function (context, req) {
  const b = req.body || {};
  await enTransaccion(context, "No se pudo anular el pago.", (nr) => anularPago(nr, b.id));
};
