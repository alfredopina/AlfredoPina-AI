// getCalendarioAbiertos/index.js
// Function PÚBLICA (la lee /cursos-abiertos): la foto del calendario de Cursos Abiertos que el admin publicó, con los lugares reservados al día.
// Solo lee Table Storage, NUNCA SQL (regla: lo público no despierta la base). Sin foto → { grupos: [] } y la página muestra su estado vacío.
// Ver api/src/calendario-abiertos.js y docs/cursos-abiertos.md.
const cal = require("../src/calendario-abiertos");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    const r = await cal.leerFoto(cal.getTable());
    context.res = {
      status: 200,
      headers: { ...JSON_HEADERS, "Cache-Control": "public, max-age=30" },
      body: r ? { ...r.foto, publicado_en: r.publicadoEn } : { version: 1, ajustes: {}, grupos: [] },
    };
  } catch (err) {
    context.log.error("Error leyendo el calendario de Cursos Abiertos:", err.message);
    context.res = { status: 503, headers: JSON_HEADERS, body: { error: "No se pudo cargar el calendario." } };
  }
};
