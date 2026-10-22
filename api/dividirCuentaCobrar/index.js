// dividirCuentaCobrar/index.js
// Function protegida (rol "admin"): divide una cuenta sin pagos en parcialidades (partes = [{ total, concepto? }], suma exacta).
const { enTransaccion, dividirCuenta } = require("../src/cobranza-db");

module.exports = async function (context, req) {
  const b = req.body || {};
  await enTransaccion(context, "No se pudo dividir la cuenta.", (nr) => dividirCuenta(nr, b.id, b.partes));
};
