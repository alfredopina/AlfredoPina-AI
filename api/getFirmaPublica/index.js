// getFirmaPublica/index.js
// Function PÚBLICA: la firma de un instructor, para incrustarla en el
// diploma que arma diplomas-grupo.html (visitante anónimo, sin sesión de
// admin) — getPlantillaAsset hace lo mismo pero es solo-admin, la usa el
// panel. La firma ya es visible para cualquiera que reciba el diploma en PDF,
// así que no expone nada que el diploma mismo no muestre.
const { getPlantillasContainer, slugify } = require("../src/plantillas-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const instructor = (req.query.instructor || "").trim();
  if (!instructor) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el instructor." } };
    return;
  }

  try {
    const container = getPlantillasContainer();
    const buffer = await container.getBlockBlobClient(`firmas/${slugify(instructor)}.png`).downloadToBuffer();
    context.res = { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" }, body: buffer };
  } catch (err) {
    if (err.statusCode === 404) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Todavía no hay firma." } };
      return;
    }
    context.log.error("Error obteniendo la firma pública:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar la firma." } };
  }
};
