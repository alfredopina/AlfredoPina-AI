// cambiarEstadoLinkEncuesta/index.js
// Function protegida (rol "admin"): abre/cierra el link de un grupo. Cerrado =
// enviarRespuesta deja de aceptar envíos con ese token (se valida en el
// SERVIDOR, no solo en la pantalla) y la página pública muestra "ya cerró".
// Reversible (Reabrir) — no borra nada.
const { getEncuestaLinksTable, leerLink, cambiarEstadoLink } = require("../src/encuesta-links");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const token = (body.token || "").trim();
  if (!token || typeof body.abierta !== "boolean") {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan el token o el estado." } };
    return;
  }

  try {
    const table = getEncuestaLinksTable();
    const link = await leerLink(table, token);
    if (!link) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese link ya no existe." } };
      return;
    }
    await cambiarEstadoLink(table, token, body.abierta);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, abierta: body.abierta } };
  } catch (err) {
    context.log.error("Error cambiando el estado del link:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cambiar el estado: " + err.message } };
  }
};
