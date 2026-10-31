// Cotización de consultoría (2026-10-31): contenido de la Solicitud/propuesta cuando el tipo es 'consultoria'.
//   { fases: [{ nombre, descripcion, horas }], entregables: [texto], imagen: url | null }
// Las horas de la cotización son la suma de las fases (se cotiza por horas estimadas × la tarifa 'consultoria').
const MAX_FASES = 12;
const MAX_ENTREGABLES = 20;
// la imagen de referencia vive en el contenedor público "consultoria" del Storage (ver consultoria-storage.js)
const IMAGEN_RE = /^https:\/\/[a-z0-9]+\.blob\.core\.windows\.net\/consultoria\/[A-Za-z0-9._-]+$/;

function redondeaHoras(n) { return Math.round(Number(n) * 10) / 10; }

function normalizarEntregables(v) {
  const lineas = Array.isArray(v) ? v : String(v == null ? "" : v).split(/\r?\n/);
  return lineas
    .map((l) => String(l).replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, MAX_ENTREGABLES)
    .map((l) => l.slice(0, 300));
}

// null si no hay al menos una fase con nombre y horas > 0
function normalizarConsultoria(v) {
  if (!v || typeof v !== "object") return null;
  const fases = (Array.isArray(v.fases) ? v.fases : [])
    .filter((f) => f && String(f.nombre || "").trim() && Number(f.horas) > 0)
    .slice(0, MAX_FASES)
    .map((f) => ({ nombre: String(f.nombre).trim().slice(0, 200), descripcion: String(f.descripcion || "").trim().slice(0, 800), horas: redondeaHoras(f.horas) }));
  if (!fases.length) return null;
  const imagen = typeof v.imagen === "string" && IMAGEN_RE.test(v.imagen) ? v.imagen : null;
  return { fases, entregables: normalizarEntregables(v.entregables), imagen };
}

function horasDeFases(fases) {
  return redondeaHoras((fases || []).reduce((a, f) => a + (Number(f.horas) || 0), 0));
}

module.exports = { MAX_FASES, MAX_ENTREGABLES, IMAGEN_RE, normalizarConsultoria, normalizarEntregables, horasDeFases };
