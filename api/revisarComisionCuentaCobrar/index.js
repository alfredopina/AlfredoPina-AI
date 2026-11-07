// revisarComisionCuentaCobrar/index.js
// Function protegida (rol "admin", cerrada por defecto): Viri marca como REVISADA la comisión de intermediario de una cuenta por cobrar
// (quita la insignia "Comisión … · revisar" de Cobranza). No cambia ningún monto.
const { enTransaccion, revisarComision } = require("../src/cobranza-db");

module.exports = async function (context, req) {
  const b = req.body || {};
  await enTransaccion(context, "No se pudo marcar la comisión como revisada.", (nr) => revisarComision(nr, b.id));
};
