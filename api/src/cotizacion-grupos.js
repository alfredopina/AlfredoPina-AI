// Reglas de precio por número de grupos (2026-10-12, definidas por Alfredo). Una sola fuente en el servidor; el formulario del admin
// (admin/index.html, actualizarPrecioSugerido) repite estas mismas dos funciones para sugerir el descuento al capturar.
//   - 2 grupos → 5 % · 3 o más → 10 %.
//   - No se acumula con el 10 % de grupos chicos ("Solo yo" / "5 a 10"): se aplica el MAYOR de los dos.
//   - El descuento sigue siendo editable (y el precio final se puede fijar a mano).
const MAX_GRUPOS = 20;
const GRUPOS_CHICOS = ["Solo yo", "5 a 10"];

function normalizarGrupos(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_GRUPOS) : 1;
}
function descuentoPorGrupos(n) {
  return n >= 3 ? 10 : n === 2 ? 5 : 0;
}
function descuentoSugerido({ participantes, grupos }) {
  return Math.max(GRUPOS_CHICOS.includes(participantes) ? 10 : 0, descuentoPorGrupos(normalizarGrupos(grupos)));
}
// número exacto de participantes por grupo (opcional): entero 1-500 o null
function normalizarParticipantesNum(v) {
  if (v == null || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 500 ? n : null;
}

module.exports = { MAX_GRUPOS, GRUPOS_CHICOS, normalizarGrupos, descuentoPorGrupos, descuentoSugerido, normalizarParticipantesNum };
