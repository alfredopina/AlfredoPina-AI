// getInstructores/index.js
// Lista de instructores — vive en un JSON dentro del contenedor "plantillas"
// (ver plantillas-storage.js), con una semilla de 2 nombres si todavía no se
// ha guardado nada. Nació protegida (rol "admin") para Crear Diplomas /
// Plantilla; se volvió pública en staticwebapp.config.json cuando Encuestas
// la reusó para el dropdown de Instructor en encuesta.html (página sin
// login) — son los mismos nombres que ya aparecen impresos en cada diploma,
// no es información nueva que se esté exponiendo.
const { getInstructores } = require("../src/plantillas-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const instructores = await getInstructores();
    context.res = { status: 200, headers: JSON_HEADERS, body: { instructores } };
  } catch (err) {
    context.log.error("Error obteniendo instructores:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar la lista de instructores en este momento." } };
  }
};
