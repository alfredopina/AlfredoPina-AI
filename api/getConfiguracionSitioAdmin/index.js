// getConfiguracionSitioAdmin/index.js
// Function protegida (rol "admin"; /api/* es solo admin por defecto): lo guardado en admin → Personalizar CON quién y cuándo lo cambió, sin caché
// (el panel debe mostrar lo que hay de verdad). Solo Table Storage. Ver api/src/sitio-config.js.
const { leerTodo } = require("../src/sitio-config");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    context.res = { status: 200, headers: { ...JSON_HEADERS, "Cache-Control": "no-store" }, body: await leerTodo({ usarCache: false }) };
  } catch (err) {
    context.log.error("Error leyendo la configuración del sitio (admin):", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo leer." } };
  }
};
