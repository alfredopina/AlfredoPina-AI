// listPreguntasAdmin/index.js
// Function protegida (rol "admin"): TODAS las preguntas (activas e inactivas)
// para el panel de edición — a diferencia de getPreguntasEncuesta, que solo
// regresa las activas para el formulario público.
//
// Vive en Table Storage, no en SQL (2026-09-16) — ver encuesta-tables.js.
const { getEncuestaPreguntasTable, listarTodas, entidadAPregunta } = require("../src/encuesta-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const table = getEncuestaPreguntasTable();
    const entidades = await listarTodas(table);
    const preguntas = entidades.map(entidadAPregunta).sort((a, b) => a.orden - b.orden);
    context.res = { status: 200, headers: JSON_HEADERS, body: preguntas };
  } catch (err) {
    context.log.error("Error listando preguntas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las preguntas: " + err.message } };
  }
};
