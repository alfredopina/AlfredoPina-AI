// cambiarEstatusCuentaCobrar/index.js
// Function protegida (rol "admin"): estatus manual (Por facturar | Facturada | Cancelada). Parcial/Pagada salen solo de los pagos. Nunca borra.
const { enTransaccion, cambiarEstatus } = require("../src/cobranza-db");

module.exports = async function (context, req) {
  const b = req.body || {};
  await enTransaccion(context, "No se pudo cambiar el estatus.", (nr) => cambiarEstatus(nr, Number(b.id), String(b.estatus || "")));
};
