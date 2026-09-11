// listActividadAdmin/index.js
// Function protegida (rol "admin"): lista de accesos al panel, para la
// pestaña Actividad de Configuración (reemplaza a "Accesos" — ver CLAUDE.md,
// no había nada real que construir ahí hasta que surgió este conteo).
const { listActividad } = require("../src/actividad-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const lista = await listActividad();
    lista.sort((a, b) => (b.veces || 0) - (a.veces || 0));
    context.res = { status: 200, headers: JSON_HEADERS, body: lista };
  } catch (err) {
    context.log.error("Error listando actividad:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar la actividad: " + err.message } };
  }
};
