// respaldarAhora/index.js
// Function protegida (rol "admin"): dispara un respaldo manual de las 5 tablas
// (botón "Respaldar ahora" en admin → Configuración → Respaldos). Regresa el
// nombre del blob creado para que el admin pueda refrescar la lista.
const { generarRespaldo } = require("../src/backup-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const { nombreBlob, conteos } = await generarRespaldo("manual");
    context.res = { status: 200, headers: JSON_HEADERS, body: { nombreBlob, conteos } };
  } catch (err) {
    context.log.error("Error generando el respaldo manual:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo generar el respaldo. Intenta de nuevo." } };
  }
};
