// getPreguntasEncuesta/index.js
// Function pública: las preguntas de la encuesta (ya en el orden de
// despliegue: Curso y Materiales → Instructor → Aprendizaje y Aplicación →
// Globales) + los 5 textos de la escala, para pintar el formulario en
// encuesta.html.
//
// Vive en Table Storage, no en SQL (2026-09-16) — así cargar la encuesta
// nunca depende de que la base SQL serverless esté despierta. Ver
// CLAUDE.md → Encuestas, "banco de preguntas en Table Storage".
const {
  getEncuestaPreguntasTable, getEncuestaConfigTable, listarTodas, entidadAPregunta,
  bancoVigente, compararPreguntas, leerEscala,
} = require("../src/encuesta-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const table = getEncuestaPreguntasTable();
    const entidades = await listarTodas(table);
    const preguntas = bancoVigente(entidades).map(entidadAPregunta).sort(compararPreguntas);
    const escala = await leerEscala(getEncuestaConfigTable());
    context.res = { status: 200, headers: JSON_HEADERS, body: { preguntas, escala } };
  } catch (err) {
    context.log.error("Error obteniendo preguntas de la encuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar las preguntas en este momento." } };
  }
};
