// subirImagenConsultoria/index.js
// Function protegida (rol "admin", cerrada por defecto): sube la imagen de referencia de una cotización de consultoría. El navegador ya la
// comprimió a JPEG (≈1600 px) y la manda como base64 en un JSON normal. Regresa su URL pública; el admin la guarda dentro de
// Solicitud.consultoria_json. Una imagen que se quita o reemplaza deja su blob huérfano a propósito (inofensivo, nunca se borra nada).
const { JSON_HEADERS } = require("../src/http");
const { esJpeg, subirImagenConsultoria } = require("../src/consultoria-storage");

const MAX_BYTES = 1500 * 1024;

module.exports = async function (context, req) {
  const buf = Buffer.from((req.body && req.body.base64) || "", "base64");
  if (!esJpeg(buf)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "La imagen debe llegar como JPEG." } };
    return;
  }
  if (buf.length > MAX_BYTES) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "La imagen es demasiado pesada (máx. 1.5 MB)." } };
    return;
  }
  try {
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, url: await subirImagenConsultoria(buf) } };
  } catch (err) {
    context.log.error("Error subiendo la imagen de consultoría:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo subir la imagen." } };
  }
};
