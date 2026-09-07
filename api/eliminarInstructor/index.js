// eliminarInstructor/index.js
// Function protegida (rol "admin"): quita un instructor de la lista y borra
// su firma. Los diplomas ya generados con su nombre no cambian — solo deja
// de aparecer en los selectores hacia adelante.
const { eliminarInstructor } = require("../src/plantillas-storage");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const nombre = ((req.body || {}).nombre || "").trim();
  if (!nombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el nombre del instructor." } };
    return;
  }

  try {
    const instructores = await eliminarInstructor(nombre);
    context.res = { status: 200, headers: JSON_HEADERS, body: { instructores } };
  } catch (err) {
    context.log.error("Error eliminando instructor:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar: " + err.message } };
  }
};
