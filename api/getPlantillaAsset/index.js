// getPlantillaAsset/index.js
// Function protegida (rol "admin"): regresa el fondo del diploma o la firma
// de un instructor desde el contenedor privado "plantillas", para
// previsualizarlos en el panel Plantillas.
const { getPlantillasContainer, slugify } = require("../src/plantillas-storage");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const tipo = (req.query.tipo || "").trim();
  const instructor = (req.query.instructor || "").trim();

  if (tipo !== "fondo" && tipo !== "firma") {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Tipo inválido (usa fondo o firma)." } };
    return;
  }
  if (tipo === "firma" && !instructor) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el instructor." } };
    return;
  }

  const blobPath = tipo === "fondo" ? "fondo.png" : `firmas/${slugify(instructor)}.png`;

  try {
    const container = getPlantillasContainer();
    const buffer = await container.getBlockBlobClient(blobPath).downloadToBuffer();
    context.res = { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "no-store" }, body: buffer };
  } catch (err) {
    if (err.statusCode === 404) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Todavía no hay imagen." } };
      return;
    }
    context.log.error("Error obteniendo el asset de plantilla:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar la imagen: " + err.message } };
  }
};
