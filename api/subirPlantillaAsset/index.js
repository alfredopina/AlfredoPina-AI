// subirPlantillaAsset/index.js
// Function protegida (rol "admin"): sube la firma de un instructor a Blob
// Storage (base64 en JSON, mismo patrón que uploadRecurso — más confiable
// que binario crudo en managed functions).
const { uploadFirma, slugify } = require("../src/plantillas-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const instructor = (body.instructor || "").trim();
  const fileBase64 = body.fileBase64 || "";
  const contentType = body.contentType || "image/png";

  if (!instructor) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el instructor." } };
    return;
  }
  if (!fileBase64) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No llegó ningún archivo." } };
    return;
  }

  try {
    await uploadFirma(slugify(instructor), Buffer.from(fileBase64, "base64"), contentType);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error subiendo la firma:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo subir: " + err.message } };
  }
};
