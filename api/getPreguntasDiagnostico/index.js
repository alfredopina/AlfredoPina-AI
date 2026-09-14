// getPreguntasDiagnostico/index.js
// Function pública: preguntas activas de una herramienta, ordenadas por nivel
// y orden, para pintar diagnostico.html. Nunca manda opcion_correcta — quien
// contesta no debe poder verla ni en la respuesta cruda de la red.
//
// Vive en Table Storage, no en SQL (2026-09-13) — así cargar el diagnóstico
// nunca depende de que la base SQL serverless esté despierta. Ver
// CLAUDE.md → Diagnóstico, "banco de preguntas en Table Storage".
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
      .filter((e) => !!e.activa)
      .map((e) => entidadAPregunta(e, { conCorrecta: false }))
      .sort((a, b) => a.nivel - b.nivel || a.orden - b.orden);
    context.res = { status: 200, headers: JSON_HEADERS, body: preguntas };
  } catch (err) {
    context.log.error("Error obteniendo preguntas del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar las preguntas en este momento." } };
  }
};
