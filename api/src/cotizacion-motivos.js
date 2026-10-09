// Motivos de pérdida de una cotización (lista cerrada, definida por Alfredo 2026-10-09). La misma lista vive en el
// admin (ventana que se abre al soltar una tarjeta en Perdida); aquí se valida lo que llega.
const MOTIVOS_PERDIDA = ["Precio alto", "Otro proveedor", "Sin presupuesto", "Sin respuesta", "Cambio de prioridad", "Curso interno", "Más adelante"];

const esMotivoValido = (m) => MOTIVOS_PERDIDA.includes(m);

module.exports = { MOTIVOS_PERDIDA, esMotivoValido };
