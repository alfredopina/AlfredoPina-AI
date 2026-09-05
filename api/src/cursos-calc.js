// Lógica compartida entre las Functions del módulo Cursos (Temarios): resolver
// un Temario Estándar contra su banco de temas, y decidir si un Proyecto está
// cubierto por un conjunto de temas seleccionados/incluidos.
const NIVEL_LABEL = ["", "Básico", "Intermedio", "Avanzado"];

function parseTemaIds(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

// temasPorId: mapa { temaId -> entidad de Temas } de TODOS los temas de la
// herramienta (publicados o no) — un Temario Estándar empaqueta contenido fijo
// aunque un tema individual ya no esté publicado sueltamente para el constructor.
function resolverTemario(temarioEntity, temasPorId) {
  const temaIds = parseTemaIds(temarioEntity.temaIds);
  const temas = temaIds
    .map((id) => temasPorId[id])
    .filter(Boolean)
    .map((t) => ({ id: t.rowKey, nombre: t.nombre || "", descripcion: t.descripcion || "", horas: Number(t.horas) || 0, nivel: Number(t.nivel) || 0 }));

  const horas = temas.reduce((sum, t) => sum + t.horas, 0);
  const niveles = temas.map((t) => t.nivel).filter((n) => n > 0);
  let nivelLabel = "";
  if (niveles.length) {
    const nivelMin = Math.min(...niveles);
    const nivelMax = Math.max(...niveles);
    nivelLabel = nivelMin === nivelMax ? NIVEL_LABEL[nivelMin] : `${NIVEL_LABEL[nivelMin]} · ${NIVEL_LABEL[nivelMax]}`;
  }

  return { temas, horas, nivelLabel };
}

// true solo si TODOS los temaIds que requiere el proyecto están presentes en
// el conjunto disponible (selección del usuario, o temas de un temario estándar).
function proyectoCubierto(proyectoTemaIds, temaIdsDisponibles) {
  const disponibles = temaIdsDisponibles instanceof Set ? temaIdsDisponibles : new Set(temaIdsDisponibles);
  const requeridos = parseTemaIds(proyectoTemaIds);
  return requeridos.length > 0 && requeridos.every((id) => disponibles.has(id));
}

module.exports = { NIVEL_LABEL, parseTemaIds, resolverTemario, proyectoCubierto };
