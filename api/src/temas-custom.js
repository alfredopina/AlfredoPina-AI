// Temas a medida de una Solicitud personalizada (2026-10-13): temas que el cliente pidió y que no están en el catálogo.
// Forma: [{ nombre, objetivo }] — sin horas ni nivel (la propuesta trabaja por bloques; las horas totales las fija Alfredo).
const MAX_TEMAS_CUSTOM = 10;

function normalizarTemasCustom(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t) => t && String(t.nombre || "").trim())
    .slice(0, MAX_TEMAS_CUSTOM)
    .map((t) => ({ nombre: String(t.nombre).trim().slice(0, 200), objetivo: String(t.objetivo || "").trim().slice(0, 1000) }));
}

module.exports = { MAX_TEMAS_CUSTOM, normalizarTemasCustom };
