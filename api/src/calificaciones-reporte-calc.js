// api/src/calificaciones-reporte-calc.js
// Cálculo puro (sin red ni SQL) del snapshot de un Reporte de Resultados —
// separado para poder probarlo con `npm test` (test-calificaciones-reporte.js),
// mismo patrón que encuesta-reporte-calc.js/diagnostico-reporte-calc.js.
//
// Entrada: las filas que devuelve leerCalificacionesFiltradas (una por
// alumno+grupo, con la metadata de su Grupo ya incluida). Salida: un objeto
// JSON plano que se guarda tal cual — reporte-resultados.html solo lo pinta,
// nunca recalcula nada.
//
// El umbral de "Aprobado" (80) se importa de calificaciones-calc.js — es la
// MISMA regla que usan Cargar y Resultados, nunca se reimplementa aquí.
const { UMBRAL_APROBADO } = require("./calificaciones-calc");

const redondear1 = (n) => Math.round(n * 10) / 10;
const topar100 = (n) => (n > 100 ? 100 : n);
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

function fechaISO(f) {
  if (!f) return null;
  return f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10);
}

// Mismo criterio visual que el semáforo del panel: verde >=80 · ámbar <80 ·
// rojo exactamente 0 ("sin evidencia", no solo "reprobó").
function semaforoDe(calificacion) {
  if (calificacion === 0) return "rojo";
  return calificacion >= UMBRAL_APROBADO ? "verde" : "ambar";
}

function calcularSnapshot({ filas, filtros, etiqueta, ahora }) {
  const grupos = new Map(); // grupo_id -> acumulador
  const participantes = [];
  const fechas = [];

  for (const f of filas) {
    if (!grupos.has(f.grupo_id)) {
      grupos.set(f.grupo_id, {
        grupoId: f.grupo_id,
        cliente: f.cliente_final || f.cliente,
        clienteVia: f.cliente_final ? f.cliente : null,
        contacto: f.contacto || null,
        curso: f.nombre_curso,
        herramientas: JSON.parse(f.herramientas || "[]"),
        instructor: f.instructor,
        modalidad: f.modalidad,
        fechaInicio: fechaISO(f.fecha_inicio),
        fechaFin: fechaISO(f.fecha_fin),
        notaGeneral: f.nota_general || null,
        alumnos: 0,
        aprobados: 0,
        participaron: 0,
        noAprobados: 0,
        califs: [],
        asistenciasTotal: 0,
        asistenciasPosibles: 0,
      });
    }
    const g = grupos.get(f.grupo_id);
    g.alumnos++;
    if (f.resultado === "Aprobado") g.aprobados++;
    else if (f.resultado === "Participó") g.participaron++;
    else g.noAprobados++;
    g.califs.push(topar100(Number(f.calificacion)));
    g.asistenciasTotal += f.asistencias;
    g.asistenciasPosibles += f.frecuencias;
    if (g.fechaInicio) fechas.push(g.fechaInicio);

    const asistenciaPct = f.frecuencias ? redondear1((100 * f.asistencias) / f.frecuencias) : null;
    participantes.push({
      id: f.id,
      grupoId: f.grupo_id,
      nombre: f.alumno,
      correo: f.correo || null,
      empresa: f.cliente_final || f.cliente,
      curso: f.nombre_curso,
      herramientas: JSON.parse(f.herramientas || "[]"),
      instructor: f.instructor,
      puntos: Number(f.puntos) || 0,
      asistencias: f.asistencias,
      frecuencias: f.frecuencias,
      asistenciaPct,
      proyecto: Number(f.proyecto),
      calificacion: Number(f.calificacion),
      calificacionTopada: topar100(Number(f.calificacion)),
      excede100: Number(f.calificacion) > 100,
      resultado: f.resultado,
      semaforo: semaforoDe(Number(f.calificacion)),
      notas: f.notas || null,
    });
  }

  const porGrupo = Array.from(grupos.values())
    .map((g) => ({
      grupoId: g.grupoId,
      cliente: g.cliente,
      clienteVia: g.clienteVia,
      contacto: g.contacto,
      curso: g.curso,
      herramientas: g.herramientas,
      instructor: g.instructor,
      modalidad: g.modalidad,
      fechaInicio: g.fechaInicio,
      fechaFin: g.fechaFin,
      notaGeneral: g.notaGeneral,
      alumnos: g.alumnos,
      aprobados: g.aprobados,
      participaron: g.participaron,
      noAprobados: g.noAprobados,
      promCalificacion: redondear1(media(g.califs)),
      asistenciaPct: g.asistenciasPosibles ? redondear1((100 * g.asistenciasTotal) / g.asistenciasPosibles) : null,
    }))
    .sort((a, b) => (b.fechaInicio || "").localeCompare(a.fechaInicio || ""));

  const todasCalifs = participantes.map((p) => p.calificacionTopada);
  const asistTotal = participantes.reduce((a, p) => a + p.asistencias, 0);
  const asistPosible = participantes.reduce((a, p) => a + p.frecuencias, 0);

  const porCalifDesc = participantes.slice().sort((a, b) => b.calificacion - a.calificacion || a.nombre.localeCompare(b.nombre));
  // puntos va en el resumen para poder explicar en "Los mejor calificados" por
  // qué alguien pasa de 100 (si no, varios se ven iguales en "100+" sin poder
  // distinguir quién sacó más puntos extra)
  const resumenPersona = (p) => ({ id: p.id, nombre: p.nombre, empresa: p.empresa, curso: p.curso, puntos: p.puntos, calificacion: p.calificacion, calificacionTopada: p.calificacionTopada, excede100: p.excede100, semaforo: p.semaforo });
  const mejores = porCalifDesc.slice(0, 3).map(resumenPersona);
  const bajoOchenta = participantes
    .filter((p) => p.calificacion < UMBRAL_APROBADO)
    .sort((a, b) => a.calificacion - b.calificacion || a.nombre.localeCompare(b.nombre))
    .map(resumenPersona);

  fechas.sort();
  const aprobados = participantes.filter((p) => p.resultado === "Aprobado").length;
  const participaron = participantes.filter((p) => p.resultado === "Participó").length;
  const noAprobados = participantes.filter((p) => p.resultado === "No Aprobado").length;

  return {
    version: 1,
    generadoEn: (ahora || new Date()).toISOString(),
    etiqueta: etiqueta || "",
    filtros: filtros || {},
    n: participantes.length,
    nGrupos: grupos.size,
    rango: { desde: fechas[0] || null, hasta: fechas[fechas.length - 1] || null },
    aprobados,
    participaron,
    noAprobados,
    promedioCalificacion: todasCalifs.length ? redondear1(media(todasCalifs)) : null,
    asistenciaPct: asistPosible ? redondear1((100 * asistTotal) / asistPosible) : null,
    porGrupo,
    mejores,
    bajoOchenta,
    participantes,
  };
}

module.exports = { calcularSnapshot, semaforoDe, UMBRAL_APROBADO, redondear1 };
