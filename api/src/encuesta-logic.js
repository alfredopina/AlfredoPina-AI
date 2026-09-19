// Lógica pura de Encuestas (sin red ni SQL) — separada para poder probarla
// con `npm test` (ver api/test-encuesta.js), mismo patrón que
// availability-logic.js / cliente-actividad.js.
const { TOPE_ESCALA, COMENTARIO_ID } = require("./encuesta-tables");

// EncuestaRespuestaDetalle.valor es NVARCHAR(500) (sql/003) — el comentario no
// puede pasar de ahí o el INSERT truena por truncamiento.
const COMENTARIO_MAX = 500;

// Errores "seguros": mensaje pensado para mostrarse tal cual al usuario (nunca
// texto crudo de mssql/Azure).
function errorSeguro(mensaje, status) {
  const err = new Error(mensaje);
  err.safe = true;
  err.status = status || 400;
  return err;
}

// Fecha (YYYY-MM-DD) en hora de México — CDMX/Monterrey están en UTC-6 fijo
// desde que se eliminó el horario de verano (2022). Mismo criterio que
// backup-tables.js: offset fijo, sin librería de zonas horarias.
function fechaMexico(date) {
  const d = date instanceof Date ? date : new Date();
  return new Date(d.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 10);
}

// Valida las respuestas del público contra el banco REAL (Table Storage) —
// nunca se confía en lo que manda el navegador: cada pregunta de escala del
// banco debe venir contestada con un entero 1-5, no puede venir un id que no
// exista en el banco, y el texto/categoría/tipo que se guarda como copia
// congelada sale del banco, no del cliente. La pregunta de comentarios es la
// única opcional.
function validarRespuestas(bancoEntidades, respuestas) {
  const banco = new Map();
  for (const e of bancoEntidades) banco.set(e.rowKey, e);

  const escalas = bancoEntidades.filter((e) => (e.tipo || "escala") === "escala");
  if (!escalas.length) throw errorSeguro("La encuesta todavía no tiene preguntas.", 409);

  const recibidas = new Map();
  for (const r of Array.isArray(respuestas) ? respuestas : []) {
    const id = (r && r.preguntaId != null ? String(r.preguntaId) : "").trim();
    if (!id) continue;
    if (!banco.has(id)) throw errorSeguro("La encuesta cambió mientras la contestabas — recarga la página e inténtalo de nuevo.", 409);
    recibidas.set(id, r.valor);
  }

  const detalle = [];
  for (const e of escalas) {
    const bruto = recibidas.get(e.rowKey);
    const valor = Number(bruto);
    if (bruto == null || bruto === "" || !Number.isInteger(valor) || valor < 1 || valor > 5) {
      throw errorSeguro("Falta calificar una pregunta (o su valor no es válido).");
    }
    detalle.push({ preguntaId: e.rowKey, valor: String(valor), texto: e.texto || "", categoria: e.partitionKey, tipo: "escala" });
  }

  const comentario = banco.get(COMENTARIO_ID);
  if (comentario && recibidas.has(COMENTARIO_ID)) {
    const texto = String(recibidas.get(COMENTARIO_ID) || "").trim().slice(0, COMENTARIO_MAX);
    if (texto) detalle.push({ preguntaId: COMENTARIO_ID, valor: texto, texto: comentario.texto || "", categoria: comentario.partitionKey, tipo: "texto" });
  }
  return detalle;
}

// ¿Cabe una pregunta de escala más en esa categoría? `excluirId` = la que se
// está editando (no cuenta contra sí misma).
function cabeOtraEscala(categoria, existentes, excluirId) {
  const tope = TOPE_ESCALA[categoria];
  if (!tope) return false;
  const n = existentes.filter((e) => e.partitionKey === categoria && (e.tipo || "escala") === "escala" && e.rowKey !== excluirId).length;
  return n < tope;
}

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = { errorSeguro, fechaMexico, validarRespuestas, cabeOtraEscala, CORREO_RE, COMENTARIO_MAX };
