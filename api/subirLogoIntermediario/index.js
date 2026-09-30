// subirLogoIntermediario/index.js
// Function protegida (rol "admin"): sube/reemplaza el logo de un Cliente
// Intermediario. El front ya redujo la imagen a PNG (transparencia real,
// a diferencia de la foto de instructor que sí puede ser JPEG) antes de
// mandarla en base64 — ver logoReducido() en admin/index.html.
const { subirLogoIntermediario } = require("../src/intermediarios-storage");
const { JSON_HEADERS } = require("../src/http");

const MAX_LOGO_BYTES = 600 * 1024;

module.exports = async function (context, req) {
  const body = req.body || {};
  const clienteId = Number(body.clienteId);
  if (!clienteId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el cliente." } };
    return;
  }
  if (!body.fileBase64) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el archivo." } };
    return;
  }

  try {
    const buffer = Buffer.from(String(body.fileBase64), "base64");
    if (!buffer.length) {
      context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El archivo llegó vacío." } };
      return;
    }
    if (buffer.length > MAX_LOGO_BYTES) {
      context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El logo pesa demasiado (máx. 600 KB)." } };
      return;
    }
    await subirLogoIntermediario(clienteId, buffer);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error subiendo el logo del intermediario:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo subir el logo: " + err.message } };
  }
};
