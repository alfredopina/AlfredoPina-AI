// eliminarFotoInstructor/index.js
// Function protegida (rol "admin"): quita solo la foto de un instructor (la
// reseña y la firma se quedan).
const { eliminarFotoInstructor, slugify } = require("../src/plantillas-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const nombre = String((req.body || {}).nombre || "").trim();
  if (!nombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el instructor." } };
    return;
  }
  try {
    await eliminarFotoInstructor(slugify(nombre));
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando la foto:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar la foto: " + err.message } };
  }
};
