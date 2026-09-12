// api/src/cliente-actividad.js
// Única fuente de verdad para "Días Inactivo"/semáforo y "Completado" de un
// Cliente — usada por listClientesAdmin y getResumenClientesAdmin, nunca
// reimplementada en SQL (mismo criterio que grupo-fase.js#derivarFase).
//
// Días Inactivo — cadena de prioridad (diseñada en sesión de teorización
// 2026-09-12, ver CLAUDE.md):
//   1. Solicitud sin cotizar todavía, o Cotización activa (Enviada/En
//      negociación — Borrador NUNCA cuenta, no hay interacción real hasta que
//      se envía) → cuentan con su fecha REAL, no un "0" fijo. Así una
//      cotización activa pero fría (mandada hace 3 semanas sin respuesta)
//      sigue subiendo de días en vez de leerse siempre como "hoy".
//   2. Grupo activo (estatus_cierre vacío o distinto de 'Cerrado') → cuenta
//      como "hoy" (0 días) — mientras el curso está en curso, Alfredo está
//      interactuando con ese cliente sin importar fechas.
//   Si hay más de uno de los anteriores, se usa el MÁS RECIENTE de todos.
//   3. Si no hay nada de lo anterior, Cotización cerrada (Ganada/Perdida,
//      Reemplazada se ignora — ya existe una versión más nueva que cuenta por
//      su cuenta) → su fecha_cierre real.
//   4. Si tampoco hay cotización cerrada, el último Diploma vigente emitido.
//   5. Si no hay NINGÚN dato → "sin interacción registrada", se trata como
//      el caso más urgente (rojo), no como neutro.
const DIAS_VERDE = 30;
const DIAS_AMARILLO = 90;

function calcularDiasInactivo(
  { solicitudPendienteFecha, cotizacionActivaFecha, grupoActivo, cotizacionCerradaFecha, ultimoDiplomaFecha },
  ahora = new Date()
) {
  const candidatosActivos = [solicitudPendienteFecha, cotizacionActivaFecha].filter(Boolean).map((f) => new Date(f));
  if (grupoActivo) candidatosActivos.push(ahora);

  let fechaRef = null;
  if (candidatosActivos.length) {
    fechaRef = new Date(Math.max(...candidatosActivos.map((d) => d.getTime())));
  } else if (cotizacionCerradaFecha) {
    fechaRef = new Date(cotizacionCerradaFecha);
  } else if (ultimoDiplomaFecha) {
    fechaRef = new Date(ultimoDiplomaFecha);
  }

  if (!fechaRef) return { dias: null, semaforo: "rojo", fechaRef: null };

  const dias = Math.max(0, Math.round((ahora.getTime() - fechaRef.getTime()) / 86400000));
  const semaforo = dias < DIAS_VERDE ? "verde" : dias <= DIAS_AMARILLO ? "amarillo" : "rojo";
  return { dias, semaforo, fechaRef: fechaRef.toISOString().slice(0, 10) };
}

// Completado = código + antigüedad + un Contacto marcado Principal que tenga
// correo Y teléfono. Sin ningún contacto marcado como principal, cuenta como
// incompleto de plano (empuja a Alfredo a marcar uno) — regla confirmada
// explícitamente, no basta con "cualquier contacto que cumpla".
function calcularCompletado({ codigo, clienteDesde, principalCorreo, principalTelefono }) {
  return Boolean(
    codigo &&
      clienteDesde != null &&
      principalCorreo &&
      principalCorreo.trim() &&
      principalTelefono &&
      principalTelefono.trim()
  );
}

module.exports = { calcularDiasInactivo, calcularCompletado, DIAS_VERDE, DIAS_AMARILLO };
