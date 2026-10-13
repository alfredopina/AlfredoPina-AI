// getEstadoBase/index.js
// Function protegida (rol "admin"): estado de apcweb-backoffice (dormida / despertando / despierta) para el ícono del
// botón Despertar del topbar. Pregunta a Azure Resource Manager, NUNCA abre una conexión SQL → no despierta la base
// ni gasta vCore-segundos. Ver api/src/estado-base.js.
const { consultarEstadoBase } = require("../src/estado-base");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  const r = await consultarEstadoBase();
  context.res = { status: 200, headers: JSON_HEADERS, body: r };
};
