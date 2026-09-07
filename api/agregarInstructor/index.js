// agregarInstructor/index.js
// Function protegida (rol "admin"): da de alta un instructor nuevo en la
// lista (instructores.json) y, si mandan una firma, la sube de una vez —
// evita depender de una entidad Instructor formal (ver roadmap Fase 2.1,
// "atribución simple").
const { agregarInstructor, uploadFirma, slugify } = require("../src/plantillas-storage");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const body = req.body || {};
  const nombre = (body.nombre || "").trim();
  const fileBase64 = body.fileBase64 || "";
  const contentType = body.contentType || "image/png";

  if (!nombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el nombre del instructor." } };
    return;
  }

  try {
    const instructores = await agregarInstructor(nombre);
    if (fileBase64) {
      await uploadFirma(slugify(nombre), Buffer.from(fileBase64, "base64"), contentType);
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { instructores } };
  } catch (err) {
    context.log.error("Error agregando instructor:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo agregar: " + err.message } };
  }
};
