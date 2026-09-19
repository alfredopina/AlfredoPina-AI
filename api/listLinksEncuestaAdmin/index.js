// listLinksEncuestaAdmin/index.js
// Function protegida (rol "admin"): los links por grupo ya generados, para la
// tabla de la pestaña QR / Link. Table Storage puro — no toca SQL.
const { getEncuestaLinksTable, listarLinks } = require("../src/encuesta-links");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const links = await listarLinks(getEncuestaLinksTable());
    links.sort((a, b) => new Date(b.generadoEn) - new Date(a.generadoEn));
    context.res = { status: 200, headers: JSON_HEADERS, body: links };
  } catch (err) {
    context.log.error("Error listando los links de encuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los links: " + err.message } };
  }
};
