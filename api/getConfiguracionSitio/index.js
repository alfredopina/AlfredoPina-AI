// getConfiguracionSitio/index.js
// Function PÚBLICA (la lee el sitio en cada página): lo que Alfredo configuró en admin → Personalizar — LinkedIn de la portada, contacto, perfiles y
// aviso. Solo lee Table Storage, NUNCA SQL (regla: lo público no despierta la base). Devuelve SOLO las secciones guardadas (sin quién ni cuándo
// las editó); lo no guardado lo resuelve el HTML del sitio con sus valores de siempre. El aviso vencido ya no sale. Ver api/src/sitio-config.js.
const { leerTodo, paraPublico } = require("../src/sitio-config");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    const todo = await leerTodo();
    context.res = { status: 200, headers: { ...JSON_HEADERS, "Cache-Control": "public, max-age=60" }, body: paraPublico(todo) };
  } catch (err) {
    context.log.error("Error leyendo la configuración del sitio:", err.message);
    context.res = { status: 200, headers: { ...JSON_HEADERS, "Cache-Control": "no-store" }, body: {} }; // el sitio sigue con sus valores de siempre
  }
};
