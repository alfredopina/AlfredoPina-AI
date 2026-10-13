// descartarDiagnosticoPendiente/index.js
// Function protegida (rol "admin"): descarta un envío del Diagnóstico que quedó atorado en la cola (p. ej. su empresa
// ya no existe). Borrado real — el front pide confirmación fuerte antes (mismo criterio que eliminarRespuestaDiagnostico).
// Libera la huella de esa persona (para que pueda volver a enviar) y resta 1 del contador en vivo. No toca SQL.
const { getColaTable, getHuellasTable, descartar } = require("../src/diagnostico-cola");
const { getDiagnosticoContadorTable, ajustarContadorDiagnostico } = require("../src/diagnostico-contador");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const id = String((req.body || {}).id || "").trim();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id del envío." } };
    return;
  }
  try {
    const r = await descartar(getColaTable(), getHuellasTable(), id);
    if (!r) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese envío ya no está en la cola." } };
      return;
    }
    try {
      await ajustarContadorDiagnostico(getDiagnosticoContadorTable(), r.herramienta, -1);
    } catch (errContador) {
      context.log.error("No se pudo restar del contador de diagnósticos:", errContador.message);
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error descartando el envío pendiente:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo descartar: " + err.message } };
  }
};
