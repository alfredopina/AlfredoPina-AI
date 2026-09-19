// listPreguntasAdmin/index.js
// Function protegida (rol "admin"): el banco de preguntas para el panel de
// edición + los 5 textos de la escala. A diferencia de getPreguntasEncuesta,
// aquí se asegura que exista la pregunta fija de comentarios (para que el
// admin siempre la vea, sin poder crear una segunda).
//
// Vive en Table Storage, no en SQL (2026-09-16) — ver encuesta-tables.js.
const {
  getEncuestaPreguntasTable, getEncuestaConfigTable, asegurarComentario, listarTodas,
  entidadAPregunta, bancoVigente, compararPreguntas, leerEscala,
} = require("../src/encuesta-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const table = getEncuestaPreguntasTable();
    await asegurarComentario(table);
    const entidades = await listarTodas(table);
    const preguntas = bancoVigente(entidades).map(entidadAPregunta).sort(compararPreguntas);
    const escala = await leerEscala(getEncuestaConfigTable());
    context.res = { status: 200, headers: JSON_HEADERS, body: { preguntas, escala } };
  } catch (err) {
    context.log.error("Error listando preguntas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las preguntas: " + err.message } };
  }
};
