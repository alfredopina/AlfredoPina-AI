// getPresentacionAdmin/index.js
// Function protegida (rol "admin"): regresa el HTML de una presentación como
// texto dentro de un JSON ({html}). El panel lo abre en una pestaña nueva con un
// blob: local — así se reusa el mismo camino JSON que el resto de las Functions.
const { leerPresentacion } = require("../src/presentaciones-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const id = String((req.query && req.query.id) || "");
  try {
    const buffer = await leerPresentacion(id);
    if (!buffer) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "No existe esa presentación." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { html: buffer.toString("utf8") } };
  } catch (err) {
    context.log.error("Error leyendo la presentación:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo abrir la presentación: " + err.message } };
  }
};
