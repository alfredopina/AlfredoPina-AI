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

// 256 no es múltiplo de 36: usar `byte % 36` favorecería los primeros 4 símbolos (8/256 contra 7/256). Se DESCARTAN los bytes >= 252
// (el mayor múltiplo de 36 que cabe) y se piden más: así los 36 símbolos salen con la misma probabilidad (auditoría A01-008).
const LIMITE_BYTE = 256 - (256 % ALFABETO.length);

function generarCodigoCorto() {
  let codigo = "";
  while (codigo.length < LONGITUD) {
    const bytes = crypto.randomBytes(LONGITUD * 2);
    for (let i = 0; i < bytes.length && codigo.length < LONGITUD; i++) {
      if (bytes[i] >= LIMITE_BYTE) continue;
      codigo += ALFABETO[bytes[i] % ALFABETO.length];
    }
  }
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
