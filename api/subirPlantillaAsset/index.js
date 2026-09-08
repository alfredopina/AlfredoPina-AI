// subirPlantillaAsset/index.js
// Function protegida (rol "admin"): sube el fondo del diploma o la firma de
// un instructor a Blob Storage (base64 en JSON, mismo patrón que
// uploadRecurso — más confiable que binario crudo en managed functions).
const { uploadFondo, uploadFirma, slugify } = require("../src/plantillas-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const tipo = (body.tipo || "").trim();
  const instructor = (body.instructor || "").trim();
  const fileBase64 = body.fileBase64 || "";
  const contentType = body.contentType || "image/png";

  if (tipo !== "fondo" && tipo !== "firma") {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Tipo inválido (usa fondo o firma)." } };
    return;
  }
  if (tipo === "firma" && !instructor) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el instructor." } };
    return;
  }
  if (!fileBase64) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No llegó ningún archivo." } };
    return;
  }

  const buffer = Buffer.from(fileBase64, "base64");

  try {
    if (tipo === "fondo") await uploadFondo(buffer, contentType);
    else await uploadFirma(slugify(instructor), buffer, contentType);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error subiendo la plantilla:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo subir: " + err.message } };
  }
};
