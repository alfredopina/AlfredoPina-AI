// descartarEncuestaPendiente/index.js
// Function protegida (rol "admin"): descarta un envío de la Encuesta que quedó atorado en la cola (p. ej. su empresa ya no existe o su
// grupo se eliminó). Borrado real — el front pide confirmación fuerte antes. Resta 1 de los contadores en vivo (del "hoy" solo si
// el envío fue de hoy). No toca SQL.
const { getColaTable, descartar } = require("../src/encuesta-cola");
const { getEncuestaLinksTable, ajustarContadores } = require("../src/encuesta-links");
const { fechaMexico } = require("../src/encuesta-logic");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const id = String((req.body || {}).id || "").trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id del envío." } };
    return;
  }
  try {
    const r = await descartar(getColaTable(), id);
    if (!r) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese envío ya no está en la cola." } };
      return;
    }
    try {
      await ajustarContadores(getEncuestaLinksTable(), { token: r.token, delta: -1, descontarHoy: r.fecha === fechaMexico(new Date()) });
    } catch (errContador) {
      context.log.warn("El envío se descartó pero no se pudo restar del contador en vivo:", errContador.message);
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error descartando el envío pendiente:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo descartar: " + err.message } };
  }
};
