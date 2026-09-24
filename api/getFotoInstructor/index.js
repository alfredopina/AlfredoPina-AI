// getFotoInstructor/index.js
// Function PÚBLICA: la foto de un instructor (?i=slug) para la página
// /verificar. Es la misma foto que el instructor eligió mostrar ahí; no
// expone nada más. 404 si no tiene.
const { getFotoInstructor } = require("../src/plantillas-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const slug = String(req.query.i || "").trim();
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el instructor." } };
    return;
  }
  try {
    const foto = await getFotoInstructor(slug);
    if (!foto) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Sin foto." } };
      return;
    }
    context.res = { status: 200, headers: { "Content-Type": foto.contentType, "Cache-Control": "public, max-age=3600" }, body: foto.buffer };
  } catch (err) {
    context.log.error("Error leyendo la foto del instructor:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar la foto." } };
  }
};
