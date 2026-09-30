// eliminarLogoIntermediario/index.js
// Function protegida (rol "admin"): quita el logo de un Cliente Intermediario.
const { eliminarLogoIntermediario } = require("../src/intermediarios-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const clienteId = Number((req.body || {}).clienteId);
  if (!clienteId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el cliente." } };
    return;
  }
  try {
    await eliminarLogoIntermediario(clienteId);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando el logo del intermediario:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el logo: " + err.message } };
  }
};
