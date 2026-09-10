// subirPlantillaCotizacion/index.js
// Function protegida (rol "admin"): sube el fondo de la plantilla de
// Cotización a Blob Storage (base64 en JSON, mismo patrón que
// subirPlantillaAsset/uploadRecurso). Sin manejo de firmas — a diferencia de
// Diplomas, solo Alfredo firma cotizaciones; si la quiere en el PDF, la dibuja
// ya dentro del PNG de fondo que suba aquí.
const { uploadCotizacionFondo } = require("../src/plantillas-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const fileBase64 = body.fileBase64 || "";
  const contentType = body.contentType || "image/png";

  if (!fileBase64) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No llegó ningún archivo." } };
    return;
  }

  try {
    const buffer = Buffer.from(fileBase64, "base64");
    await uploadCotizacionFondo(buffer, contentType);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error subiendo la plantilla de cotización:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo subir: " + err.message } };
  }
};
