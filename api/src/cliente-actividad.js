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
//   3. Si no hay nada de lo anterior ("respaldo histórico" — ninguno de estos
//      3 significa actividad EN CURSO, así que entre ellos gana el más
//      reciente, no una prioridad fija; ver corrección 2026-09-16 abajo):
//      Cotización cerrada (Ganada/Perdida, Reemplazada se ignora — ya existe
//      una versión más nueva que cuenta por su cuenta), último Diploma
//      vigente emitido, o fecha_cierre del último Grupo Cerrado con ese
//      cliente.
//   4. Si no hay NINGÚN dato → "sin interacción registrada", se trata como
//      el caso más urgente (rojo), no como neutro.
//
// Corrección 2026-09-16: el respaldo histórico (antes solo Cotización
// cerrada → Diploma) ganó un 3er ingrediente (Grupo Cerrado, para el caso de
// un curso cerrado sin diploma emitido ni cotización ligada — antes eso no
// dejaba NINGÚN rastro). Al agregarlo se encontró un hueco real: los 3 se
// evaluaban en orden de prioridad FIJO (Cotización siempre le ganaba a
// Diploma, Diploma siempre a Grupo Cerrado), así que una Cotización cerrada
// de hace 2 años podía ganarle a un Grupo cerrado hace 1 mes — justo lo
// opuesto de lo que "Días Inactivo" quiere medir. Corregido: ahora los 3 se
// tratan igual que los "activos" de arriba — gana la fecha MÁS RECIENTE de
// los que existan, sin importar cuál sea.
const DIAS_VERDE = 30;
const DIAS_AMARILLO = 90;

// diasAmarillo es configurable desde Configuración → Notificaciones
// (api/src/notificaciones-config.js) — el 3er parámetro es opcional y por
// default usa las mismas constantes de siempre, así que listClientesAdmin/
// getResumenClientesAdmin (y cualquier llamada vieja que no lo pase) no
// cambian de comportamiento. diasVerde se deja igual de ajustable por
// simetría, aunque hoy nada lo configura todavía (solo el umbral "urgente"
// es configurable, ver CLAUDE.md → Notificaciones).
function calcularDiasInactivo(
  { solicitudPendienteFecha, cotizacionActivaFecha, grupoActivo, cotizacionCerradaFecha, ultimoDiplomaFecha, ultimoGrupoCerradoFecha },
  ahora = new Date(),
  { diasVerde = DIAS_VERDE, diasAmarillo = DIAS_AMARILLO } = {}
) {
  const candidatosActivos = [solicitudPendienteFecha, cotizacionActivaFecha].filter(Boolean).map((f) => new Date(f));
  if (grupoActivo) candidatosActivos.push(ahora);

  let fechaRef = null;
  if (candidatosActivos.length) {
    fechaRef = new Date(Math.max(...candidatosActivos.map((d) => d.getTime())));
  } else {
    // Respaldo histórico: gana el más reciente de los 3, no una prioridad
    // fija (ver nota arriba) — mismo criterio Math.max que los activos.
    const candidatosHistoricos = [cotizacionCerradaFecha, ultimoDiplomaFecha, ultimoGrupoCerradoFecha]
      .filter(Boolean)
      .map((f) => new Date(f));
    if (candidatosHistoricos.length) {
      fechaRef = new Date(Math.max(...candidatosHistoricos.map((d) => d.getTime())));
    }
  }

  if (!fechaRef) return { dias: null, semaforo: "rojo", fechaRef: null };

  const dias = Math.max(0, Math.round((ahora.getTime() - fechaRef.getTime()) / 86400000));
  const semaforo = dias < diasVerde ? "verde" : dias <= diasAmarillo ? "amarillo" : "rojo";
  return { dias, semaforo, fechaRef: fechaRef.toISOString().slice(0, 10) };
}

// Completado = código + antigüedad + un Contacto marcado Principal que tenga
// correo Y teléfono. Sin ningún contacto marcado como principal, cuenta como
// incompleto de plano (empuja a Alfredo a marcar uno) — regla confirmada
// explícitamente, no basta con "cualquier contacto que cumpla".
//
// Excepción para Tipo=Indirecto (2026-09-13): con ellos Alfredo casi nunca
// tiene una relación lo bastante formal como para tener un contacto
// Principal con teléfono — basta con que ALGÚN contacto tenga correo, sin
// exigir que esté marcado Principal ni que haya teléfono. Directo/
// Intermediario siguen con la regla estricta de siempre.
function calcularCompletado({ codigo, clienteDesde, tipoCliente, principalCorreo, principalTelefono, algunContactoConCorreo }) {
  if (!codigo || clienteDesde == null) return false;
  if (tipoCliente === "Indirecto") return Boolean(algunContactoConCorreo);
  return Boolean(principalCorreo && principalCorreo.trim() && principalTelefono && principalTelefono.trim());
}

module.exports = { calcularDiasInactivo, calcularCompletado, DIAS_VERDE, DIAS_AMARILLO };
