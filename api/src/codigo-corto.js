// api/src/codigo-corto.js
// Código corto para links públicos (Diplomas, Reporte de Resultados, Reporte
// de Diagnóstico) — 8 caracteres alfanuméricos en vez de un UUID de 32, para
// que el link se vea de marca (alfredopina.ai/diploma/{codigo}) en lugar de
// un token larguísimo en la URL. Sigue siendo opaco e impráctico de adivinar
// (36^8 ≈ 2.8 billones de combinaciones) — mismo criterio de siempre, solo
// más corto. crypto.randomBytes (no Math.random) para que la distribución
// sea uniforme de verdad.
const crypto = require("crypto");

const ALFABETO = "abcdefghijklmnopqrstuvwxyz0123456789";
const LONGITUD = 8;

const CODIGO_CORTO_RE = /^[a-z0-9]{8}$/;

function generarCodigoCorto() {
  const bytes = crypto.randomBytes(LONGITUD);
  let codigo = "";
  for (let i = 0; i < LONGITUD; i++) codigo += ALFABETO[bytes[i] % ALFABETO.length];
  return codigo;
}

// existeFn(codigo) -> Promise<boolean>. Reintenta unas pocas veces por si
// hay colisión (prácticamente nunca, con 2.8 billones de combinaciones).
async function codigoCortoUnico(existeFn, intentos = 5) {
  for (let i = 0; i < intentos; i++) {
    const codigo = generarCodigoCorto();
    if (!(await existeFn(codigo))) return codigo;
  }
  throw new Error("No se pudo generar un código único, intenta de nuevo.");
}

module.exports = { generarCodigoCorto, codigoCortoUnico, CODIGO_CORTO_RE };
