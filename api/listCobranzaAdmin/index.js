// listCobranzaAdmin/index.js
// Function protegida (rol "admin"): todas las cuentas por cobrar con pagos, saldo, vencimiento y semáforo calculados; ya vienen ordenadas
// "lo más urgente primero". Las vistas (Por cobrar, Vencidas, Pagadas…) se filtran en el front.
const { listarCuentas } = require("../src/cobranza-db");
const { getUmbrales } = require("../src/notificaciones-config");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const umbrales = await getUmbrales();
    const clienteId = Number(req.query.clienteId) || null;
    const filas = await listarCuentas({ umbralPorVencer: umbrales.cobranzaPorVencerDias, clienteId });
    context.res = { status: 200, headers: JSON_HEADERS, body: filas };
  } catch (err) {
    context.log.error("Error listando la cobranza:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo listar la cobranza." } };
  }
};
