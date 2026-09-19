// Cálculo puro (sin red ni SQL) del snapshot de un Reporte de Encuestas —
// separado para poder probarlo con `npm test` (api/test-encuesta-reporte.js).
//
// Entrada: las respuestas que ya devuelve leerRespuestasFiltradas (cada una con
// sus `filas`: pregunta_id/texto/categoria/tipo/orden/valor), las 2 preguntas
// de Globales con su nombre y la escala de textos. Salida: un objeto JSON
// plano que se guarda tal cual y que reporte-encuesta.html solo pinta — la
// página pública nunca recalcula nada.
//
// Decisiones (ver CLAUDE_DETALLE.md → Encuestas Fase 3):
// - TODAS las respuestas entran, incluidas las marcadas "fuera de sesión" (se
//   ven en Resultados pero no se excluyen del reporte).
// - Todos los comentarios entran: si uno es ofensivo, Alfredo borra esa
//   respuesta en Resultados ANTES de generar (el reporte es un snapshot).
// - Sin comparativos ni mínimo de muestra: son datos duros de lo filtrado.
// - Promedios agrupados (todas las calificaciones de una categoría juntas),
//   no promedio de promedios. Como cada respuesta contesta las mismas
//   preguntas, da lo mismo, pero es la definición más simple de explicar.
const { CATEGORIAS, COMENTARIO_ID } = require("./encuesta-tables");

const DIMENSIONES = ["Curso y Materiales", "Instructor", "Aprendizaje y Aplicación"];
const UMBRAL_BIEN = 4;

const redondear1 = (n) => Math.round(n * 10) / 10;
const redondear2 = (n) => Math.round(n * 100) / 100;
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

function fechaISO(f) {
  if (!f) return null;
  return f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10);
}

function calcularSnapshot({ respuestas, globales, escala, filtros, etiqueta, ahora }) {
  const preguntas = new Map(); // id → acumulador
  const comentarios = [];
  const grupos = new Set();
  let sinGrupo = 0;
  const fechas = [];

  for (const r of respuestas) {
    if (r.grupo_id != null) grupos.add(r.grupo_id);
    else sinGrupo++;
    const f = fechaISO(r.fecha);
    if (f) fechas.push(f);

    for (const fila of r.filas) {
      if (fila.tipo === "texto") {
        const texto = String(fila.valor || "").trim();
        if (texto) comentarios.push({ texto, fecha: f });
        continue;
      }
      const v = Number(fila.valor);
      if (!Number.isInteger(v) || v < 1 || v > 5) continue;
      if (!preguntas.has(fila.pregunta_id)) {
        preguntas.set(fila.pregunta_id, { id: fila.pregunta_id, texto: fila.texto, categoria: fila.categoria, orden: fila.orden, conteos: [0, 0, 0, 0, 0], valores: [] });
      }
      const p = preguntas.get(fila.pregunta_id);
      p.conteos[v - 1]++;
      p.valores.push(v);
    }
  }

  const nombreGlobal = new Map((globales || []).map((g) => [g.id, g.nombreCorto]));
  const todos = [];
  const categorias = [];
  for (const nombre of CATEGORIAS) {
    const lista = Array.from(preguntas.values())
      .filter((p) => p.categoria === nombre && p.id !== COMENTARIO_ID)
      .sort((a, b) => a.orden - b.orden);
    if (!lista.length) continue;
    const valoresCat = lista.flatMap((p) => p.valores);
    todos.push(...valoresCat);
    categorias.push({
      nombre,
      promedio: DIMENSIONES.includes(nombre) ? redondear2(media(valoresCat)) : null,
      preguntas: lista.map((p) => {
        const item = { id: p.id, texto: p.texto, categoria: nombre, promedio: redondear2(media(p.valores)), n: p.valores.length, conteos: p.conteos };
        if (nombre === "Globales") item.nombre = nombreGlobal.get(p.id) || null;
        return item;
      }),
    });
  }

  const planas = categorias.flatMap((c) => c.preguntas);
  const porPromedio = planas.slice().sort((a, b) => b.promedio - a.promedio || a.texto.localeCompare(b.texto));
  const resumen = (p) => ({ id: p.id, texto: p.texto, categoria: p.categoria, promedio: p.promedio });
  // "debajo de 4" con el mismo redondeo a 1 decimal que el semáforo (3.96 se ve
  // como 4.0 → bien, no se lista)
  const bajoCuatro = planas
    .filter((p) => redondear1(p.promedio) < UMBRAL_BIEN)
    .sort((a, b) => a.promedio - b.promedio || a.texto.localeCompare(b.texto))
    .map(resumen);

  fechas.sort();
  return {
    version: 1,
    generadoEn: (ahora || new Date()).toISOString(),
    etiqueta: etiqueta || "",
    filtros: filtros || {},
    n: respuestas.length,
    nGrupos: grupos.size,
    nSinGrupo: sinGrupo,
    rango: { desde: fechas[0] || null, hasta: fechas[fechas.length - 1] || null },
    promedioGeneral: todos.length ? redondear2(media(todos)) : null,
    escala: escala || [],
    categorias,
    mejores: porPromedio.slice(0, 3).map(resumen),
    bajoCuatro,
    comentarios, // ya vienen del más reciente al más antiguo (ORDER BY fecha_envio DESC)
  };
}

module.exports = { calcularSnapshot, UMBRAL_BIEN, redondear1 };
