// api/src/calificaciones-calc.js
// Validación pura (sin red ni SQL) de las filas que llegan del grid de
// Calificaciones — la usa cargarCalificaciones y la prueba local. El front
// hace una validación parecida solo para dar feedback rápido; esta es la
// que manda, nunca se confía en lo que mande el cliente.

const RESULTADOS_VALIDOS = ["Aprobado", "Participó", "No Aprobado"];
const FASES_CALIFICABLES = ["En curso", "Proyecto", "Calificaciones", "Diplomas"];

function limpiarNombre(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

// Acepta "85", "85%", "85,5" → 85 (entero, redondeado). Devuelve
// { valor } o { error }. Una fracción sin "%" (0.85) se rechaza: el Excel
// "General" guarda 85% como 0.85 y redondearlo a 1 sería un error silencioso.
function parsearPorcentaje(v) {
  const texto = String(v ?? "").trim();
  if (!texto) return { error: "falta" };
  const tienePorcentaje = texto.endsWith("%");
  const n = Number(texto.replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n)) return { error: "no es un número" };
  if (n < 0 || n > 100) return { error: "fuera de 0-100" };
  if (!tienePorcentaje && n > 0 && n < 1) return { error: "parece fracción (usa 85 u 85%)" };
  return { valor: Math.round(n) };
}

// Devuelve { filas, errores }: filas ya limpias y numéricas, errores con el
// número de fila (1-based, contando solo las filas con contenido, en el orden
// en que llegaron) para poder señalarlas. Nombres repetidos (sin acentos ni
// mayúsculas) también son error — el mismo alumno dos veces en un grupo.
function validarFilas(alumnos) {
  const filas = [];
  const errores = [];
  const vistos = new Map();
  let n = 0;

  for (const a of Array.isArray(alumnos) ? alumnos : []) {
    const nombre = limpiarNombre(a.nombreCompleto);
    if (!nombre && !String(a.resultado || "").trim()) continue; // fila vacía del grid
    n += 1;
    const etiqueta = nombre || "(sin nombre)";

    if (!nombre) { errores.push(`Fila ${n}: falta el nombre.`); continue; }

    const resultado = String(a.resultado || "").trim();
    if (!RESULTADOS_VALIDOS.includes(resultado)) {
      errores.push(`Fila ${n} (${etiqueta}): resultado inválido "${resultado}".`);
      continue;
    }

    const pcts = {};
    let filaOk = true;
    for (const [campo, rotulo] of [["participacion", "participación"], ["asistencia", "asistencia"], ["proyecto", "proyecto"]]) {
      const r = parsearPorcentaje(a[campo]);
      if (r.error) { errores.push(`Fila ${n} (${etiqueta}): ${rotulo} ${r.error}.`); filaOk = false; }
      else pcts[campo] = r.valor;
    }
    if (!filaOk) continue;

    const clave = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (vistos.has(clave)) {
      errores.push(`Fila ${n} (${etiqueta}): repetida (mismo alumno que la fila ${vistos.get(clave)}).`);
      continue;
    }
    vistos.set(clave, n);

    filas.push({ nombreCompleto: nombre, resultado, ...pcts });
  }

  return { filas, errores };
}

module.exports = { RESULTADOS_VALIDOS, FASES_CALIFICABLES, limpiarNombre, parsearPorcentaje, validarFilas };
