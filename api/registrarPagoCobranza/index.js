// registrarPagoCobranza/index.js
// Function protegida (rol "admin"): registra un pago (fecha, monto, método, UUID/folio del complemento). Rechaza pagos que excedan el saldo.
const { enTransaccion, registrarPago } = require("../src/cobranza-db");

module.exports = async function (context, req) {
  const b = req.body || {};
  await enTransaccion(context, "No se pudo registrar el pago.", (nr) => registrarPago(nr, b));
};
