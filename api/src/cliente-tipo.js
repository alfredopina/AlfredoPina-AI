// api/src/cliente-tipo.js
// Ascenso de Prospecto a Cliente: un Prospecto (empresa que solo tiene
// Solicitud/Cotización/Diagnóstico) pasa a Directo (contratante) o Indirecto
// (cliente final) en cuanto se le da de alta un Grupo. Se llama DENTRO de la
// transacción del Grupo — o quedan Grupo y ascenso, o ninguno. Solo toca a los
// que siguen siendo Prospecto: un Intermediario/Indirecto/Directo que Alfredo
// ya clasificó a mano nunca se sobreescribe.
const { sql } = require("./backoffice-db");

async function ascenderProspecto(transaction, clienteId, nuevoTipo) {
  if (!clienteId) return;
  await new sql.Request(transaction)
    .input("id", sql.Int, clienteId)
    .input("tipo", sql.NVarChar, nuevoTipo)
    .query("UPDATE Cliente SET tipo_cliente = @tipo WHERE id = @id AND tipo_cliente = 'Prospecto'");
}

module.exports = { ascenderProspecto };
