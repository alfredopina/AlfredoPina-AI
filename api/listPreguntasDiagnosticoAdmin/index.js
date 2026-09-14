// listPreguntasDiagnosticoAdmin/index.js
// Function protegida (rol "admin"): TODAS las preguntas de una herramienta
// (activas e inactivas), CON opcion_correcta — a diferencia de
// getPreguntasDiagnostico, que es pública y nunca la incluye.
//
// Vive en Table Storage, no en SQL (2026-09-13) — ver diagnostico-tables.js.
const { getDiagnosticoPreguntasTable, listarPreguntas, entidadAPregunta, HERRAMIENTAS } = require("../src/diagnostico-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const herramienta = (req.query.herramienta || "").trim().toLowerCase();
  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida (usa excel o powerbi)." } };
    return;
  }

  try {
    const table = getDiagnosticoPreguntasTable();
    const entidades = await listarPreguntas(table, herramienta);
    const preguntas = entidades
      .map((e) => entidadAPregunta(e, { conCorrecta: true }))
      .sort((a, b) => a.nivel - b.nivel || a.orden - b.orden);
    context.res = { status: 200, headers: JSON_HEADERS, body: preguntas };
  } catch (err) {
    context.log.error("Error listando preguntas del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las preguntas: " + err.message } };
  }
};
