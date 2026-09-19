// guardarEscalaEncuesta/index.js
// Function protegida (rol "admin"): guarda los 5 textos de la escala 1-5 —
// los mismos para las 14 preguntas de escala de la encuesta (tabla
// EncuestaConfig, ver encuesta-tables.js). Los valores guardados en cada
// respuesta son siempre el NÚMERO (1-5); estos textos solo se muestran, así
// que cambiarlos no altera el histórico numérico.
const { getEncuestaConfigTable, guardarEscala } = require("../src/encuesta-tables");
const { JSON_HEADERS } = require("../src/http");

const TEXTO_MAX = 20;

module.exports = async function (context, req) {
  const escala = (req.body || {}).escala;
  const textos = Array.isArray(escala) ? escala.map((t) => String(t == null ? "" : t).trim()) : [];

  if (textos.length !== 5 || textos.some((t) => !t)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Escribe los 5 textos de la escala (ninguno puede quedar vacío)." } };
    return;
  }
  if (textos.some((t) => t.length > TEXTO_MAX)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: `Cada texto puede tener máximo ${TEXTO_MAX} caracteres.` } };
    return;
  }

  try {
    await guardarEscala(getEncuestaConfigTable(), textos);
    context.res = { status: 200, headers: JSON_HEADERS, body: { escala: textos } };
  } catch (err) {
    context.log.error("Error guardando la escala:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar: " + err.message } };
  }
};
