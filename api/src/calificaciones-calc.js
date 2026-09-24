// api/src/calificaciones-calc.js
// Reglas y validación puras (sin red ni SQL) de Calificaciones — las usa
// cargarCalificaciones y la prueba local. El grid del panel repite el cálculo
// en el navegador solo para mostrarlo en vivo (mantener en sincronía a mano:
// ver admin/index.html → PANEL CALIFICACIONES); esta versión es la que manda.
//
//   Calificación = 80% Proyecto + 20% (Asistencias / Frecuencias) + Puntos
//   Aprobado     : Calificación >= 80
//   Participó    : no aprobó pero asistencia >= 80%
//   No Aprobado  : no aprobó y asistencia < 80%
// Un alumno puede aprobar solo con el proyecto (decisión de Alfredo: no hay
// asistencia mínima para aprobar). Los umbrales son inclusivos ("80 o más").

const RESULTADOS_VALIDOS = ["Aprobado", "Participó", "No Aprobado"];
const FASES_CALIFICABLES = ["En curso", "Proyecto", "Calificaciones", "Diplomas"];

const PESO_PROYECTO = 80; // % de la calificación
const PESO_ASISTENCIA = 20;
const UMBRAL_APROBADO = 80; // calificación mínima para Aprobado
const UMBRAL_ASISTENCIA = 80; // % de asistencia mínimo para Participó

function limpiarNombre(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

// Se calcula en DÉCIMAS de punto y se compara ya redondeado a 1 decimal —
// así quien ve "80.0" en pantalla nunca aparece reprobado por un 79.9999
// de coma flotante (mismo criterio que el semáforo de Encuestas).
function calcularEvaluacion({ proyecto, asistencias, frecuencias, puntos }) {
  const asistPct10 = Math.round((1000 * asistencias) / frecuencias);
  const calif10 = Math.round(
    (PESO_PROYECTO * 10 * proyecto) / 100 + (PESO_ASISTENCIA * 10 * asistencias) / frecuencias + 10 * (puntos || 0)
  );
  let resultado;
  if (calif10 >= UMBRAL_APROBADO * 10) resultado = "Aprobado";
  else if (asistPct10 >= UMBRAL_ASISTENCIA * 10) resultado = "Participó";
  else resultado = "No Aprobado";
  return {
    calificacion: calif10 / 10, // sin topar: puede pasar de 100 con puntos extra
    asistenciaPct: asistPct10 / 10,
    resultado,
    excede100: calif10 > 1000,
  };
}

// Devuelve { valor } o { error }. Acepta "85", "85%", "87,6". Con `pct`, una
// fracción sin "%" (0.85) se rechaza: el Excel "General" guarda 85% así y
// redondearlo a 1 sería un error silencioso.
function parsearNumero(v, { entero = false, min = 0, max = Infinity, pct = false } = {}) {
  const texto = String(v ?? "").trim();
  if (!texto) return { error: "falta" };
  const n = Number(texto.replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n)) return { error: "no es un número" };
  if (entero && !Number.isInteger(n)) return { error: "debe ser entero" };
  if (n < min || n > max) return { error: max === Infinity ? `debe ser ${min} o más` : `fuera de ${min}-${max}` };
  if (pct && !texto.endsWith("%") && n > 0 && n < 1) return { error: "parece fracción (usa 85 u 85%)" };
  return { valor: entero ? n : Math.round(n * 10) / 10 };
}

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NOTAS = 500;
const MAX_NOTA_GENERAL = 2000;

// Nota de texto libre del GRUPO (no de un alumno) — se replica igual en cada
// fila de Calificacion al guardar (ver sql/024). Vacía o solo espacios → null.
function validarNotaGeneral(texto) {
  const t = String(texto || "").trim();
  if (t.length > MAX_NOTA_GENERAL) return { error: `no puede pasar de ${MAX_NOTA_GENERAL} caracteres` };
  return { valor: t || null };
}

// "Lo que aprendió" — texto PÚBLICO del grupo para la página de verificar
// diploma, un punto por renglón. Se limpia a máx. 5 renglones de 160
// caracteres; vacío → null (la sección simplemente no aparece).
const MAX_APRENDIZAJE_LINEAS = 5;
const MAX_APRENDIZAJE_LINEA = 160;
function validarAprendizaje(texto) {
  const lineas = String(texto || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lineas.length > MAX_APRENDIZAJE_LINEAS) return { error: `puede tener máximo ${MAX_APRENDIZAJE_LINEAS} renglones` };
  if (lineas.some((l) => l.length > MAX_APRENDIZAJE_LINEA)) return { error: `no puede tener renglones de más de ${MAX_APRENDIZAJE_LINEA} caracteres` };
  return { valor: lineas.length ? lineas.join("\n") : null };
}

// Devuelve { filas, errores }: filas limpias con la evaluación ya calculada,
// y errores con el número de fila (1-based, contando solo filas con
// contenido). Se validan también las reglas entre filas: mismo alumno dos
// veces (sin acentos ni mayúsculas) y Frecuencias iguales en todo el grupo.
function validarFilas(alumnos) {
  const filas = [];
  const errores = [];
  const vistos = new Map();
  let n = 0;

  for (const a of Array.isArray(alumnos) ? alumnos : []) {
    const nombre = limpiarNombre(a.nombreCompleto);
    const vacia = ["correo", "puntos", "asistencias", "frecuencias", "proyecto", "notas"].every((c) => !String(a[c] ?? "").trim());
    if (!nombre && vacia) continue; // fila vacía del grid
    n += 1;
    const etiqueta = nombre || "(sin nombre)";
    const problemas = [];
    if (!nombre) problemas.push("falta el nombre");

    const correo = String(a.correo || "").trim();
    if (correo && !CORREO_RE.test(correo)) problemas.push("correo con formato inválido");

    const notas = String(a.notas || "").trim();
    if (notas.length > MAX_NOTAS) problemas.push(`notas de más de ${MAX_NOTAS} caracteres`);

    // Puntos es opcional: vacío = 0 (la mayoría no tiene puntos extra)
    const puntosTexto = String(a.puntos ?? "").trim();
    const puntos = puntosTexto ? parsearNumero(a.puntos, { min: 0, max: 100 }) : { valor: 0 };
    if (puntos.error) problemas.push(`puntos ${puntos.error}`);

    const asistencias = parsearNumero(a.asistencias, { entero: true, min: 0 });
    if (asistencias.error) problemas.push(`asistencias ${asistencias.error}`);
    const frecuencias = parsearNumero(a.frecuencias, { entero: true, min: 1 });
    if (frecuencias.error) problemas.push(`frecuencias ${frecuencias.error}`);
    const proyecto = parsearNumero(a.proyecto, { min: 0, max: 100, pct: true });
    if (proyecto.error) problemas.push(`proyecto ${proyecto.error}`);

    if (!asistencias.error && !frecuencias.error && asistencias.valor > frecuencias.valor) {
      problemas.push("asistencias no puede ser mayor que frecuencias");
    }

    if (nombre) {
      const clave = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      if (vistos.has(clave)) problemas.push(`repetida (mismo alumno que la fila ${vistos.get(clave)})`);
      else vistos.set(clave, n);
    }

    if (problemas.length) {
      errores.push(`Fila ${n} (${etiqueta}): ${problemas.join(", ")}.`);
      continue;
    }

    const evaluacion = calcularEvaluacion({ proyecto: proyecto.valor, asistencias: asistencias.valor, frecuencias: frecuencias.valor, puntos: puntos.valor });
    filas.push({
      nombreCompleto: nombre,
      correo: correo || null,
      puntos: puntos.valor,
      asistencias: asistencias.valor,
      frecuencias: frecuencias.valor,
      proyecto: proyecto.valor,
      notas: notas || null,
      ...evaluacion,
    });
  }

  const distintas = [...new Set(filas.map((f) => f.frecuencias))];
  if (distintas.length > 1) {
    errores.push(`Frecuencias distintas entre filas (${distintas.sort((x, y) => x - y).join(", ")}) — deben ser iguales para todo el grupo.`);
  }

  return { filas, errores };
}

module.exports = {
  RESULTADOS_VALIDOS,
  FASES_CALIFICABLES,
  PESO_PROYECTO,
  PESO_ASISTENCIA,
  UMBRAL_APROBADO,
  UMBRAL_ASISTENCIA,
  MAX_NOTA_GENERAL,
  limpiarNombre,
  parsearNumero,
  calcularEvaluacion,
  validarFilas,
  validarNotaGeneral,
  validarAprendizaje,
};
