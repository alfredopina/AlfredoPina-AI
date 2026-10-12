// listPresentacionesAdmin/index.js
// Function protegida (rol "admin"): lista las presentaciones subidas (sin el HTML).
const { listarPresentaciones } = require("../src/presentaciones-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    context.res = { status: 200, headers: JSON_HEADERS, body: { items: await listarPresentaciones() } };
  } catch (err) {
    context.log.error("Error listando presentaciones:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar las presentaciones: " + err.message } };
  }
};
