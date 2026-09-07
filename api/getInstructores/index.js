// getInstructores/index.js
// Function protegida (rol "admin"): lista de instructores para los
// selectores de Crear Diplomas / Plantilla — vive en un JSON dentro del
// contenedor "plantillas" (ver plantillas-storage.js), con una semilla de
// 2 nombres si todavía no se ha guardado nada.
const { getInstructores } = require("../src/plantillas-storage");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  try {
    const instructores = await getInstructores();
    context.res = { status: 200, headers: JSON_HEADERS, body: { instructores } };
  } catch (err) {
    context.log.error("Error obteniendo instructores:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar la lista: " + err.message } };
  }
};
