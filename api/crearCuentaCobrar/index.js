// crearCuentaCobrar/index.js
// Function protegida (rol "admin"): alta MANUAL de una cuenta por cobrar (cobros sin cotización, cursos abiertos). Reglas en api/src/cobranza.js / cobranza-db.js.
const { enTransaccion, crearCuentaManual } = require("../src/cobranza-db");

module.exports = async function (context, req) {
  const b = req.body || {};
  await enTransaccion(context, "No se pudo crear la cuenta por cobrar.", (nr) => crearCuentaManual(nr, b));
};
