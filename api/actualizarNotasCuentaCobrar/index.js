// actualizarNotasCuentaCobrar/index.js
// Function protegida (rol "admin"): guarda SOLO las notas (seguimiento) de una cuenta por cobrar — el botón de notas de la fila, igual que en Clientes y Grupos.
const { enTransaccion, actualizarNotas } = require("../src/cobranza-db");

module.exports = async function (context, req) {
  const b = req.body || {};
  await enTransaccion(context, "No se pudo guardar la nota.", (nr) => actualizarNotas(nr, b.id, b.notas));
};
