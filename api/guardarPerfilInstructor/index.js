// guardarPerfilInstructor/index.js
// Function protegida (rol "admin"): guarda la reseña (texto público, breve)
// y, si mandan una, la foto de un instructor. La reseña se copia al registro
// de verificación de cada diploma cuando se genera/actualiza su grupo; la
// foto es en vivo.
const { guardarPerfilInstructor, uploadFotoInstructor, slugify } = require("../src/plantillas-storage");
const { JSON_HEADERS } = require("../src/http");

const MAX_RESENA = 500;
const MAX_FOTO_BYTES = 600 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

module.exports = async function (context, req) {
  const body = req.body || {};
  const nombre = String(body.nombre || "").trim();
  const resena = String(body.resena || "").trim();
  if (!nombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el instructor." } };
    return;
  }
  if (resena.length > MAX_RESENA) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: `La reseña no puede pasar de ${MAX_RESENA} caracteres.` } };
    return;
  }

  try {
    let foto;
    if (body.fotoBase64) {
      const tipo = String(body.contentType || "");
      const buffer = Buffer.from(String(body.fotoBase64), "base64");
      if (!TIPOS.includes(tipo) || !buffer.length) {
        context.res = { status: 400, headers: JSON_HEADERS, body: { error: "La foto debe ser JPG, PNG o WebP." } };
        return;
      }
      if (buffer.length > MAX_FOTO_BYTES) {
        context.res = { status: 400, headers: JSON_HEADERS, body: { error: "La foto pesa demasiado (máx. 600 KB)." } };
        return;
      }
      await uploadFotoInstructor(slugify(nombre), buffer, tipo);
      foto = true;
    }
    const perfiles = await guardarPerfilInstructor(nombre, { resena, foto });
    context.res = { status: 200, headers: JSON_HEADERS, body: { perfiles } };
  } catch (err) {
    context.log.error("Error guardando el perfil del instructor:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar: " + err.message } };
  }
};
