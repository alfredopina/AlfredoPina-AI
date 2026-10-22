// getResumenCobranzaAdmin/index.js
// Function protegida (rol "admin"): tarjetas del Tracking de Cobranza. Por cobrar / Vencido / Por facturar son estado vivo; Cobrado y Días
// promedio de cobro son acumulados y respetan Configuración → Métricas ("contar desde / hasta"). Ver resumir() en api/src/cobranza.js.
const { listarCuentas } = require("../src/cobranza-db");
const { getUmbrales } = require("../src/notificaciones-config");
const { getMetricasRango } = require("../src/metricas-desde");
const { resumir } = require("../src/cobranza");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    const umbrales = await getUmbrales();
    const { desde, hasta } = (await getMetricasRango()).cobranza;
    const filas = await listarCuentas({ umbralPorVencer: umbrales.cobranzaPorVencerDias });
    context.res = { status: 200, headers: JSON_HEADERS, body: { ...resumir(filas, { desde, hasta }), contando_desde: desde, contando_hasta: hasta } };
  } catch (err) {
    context.log.error("Error calculando el resumen de cobranza:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo calcular el resumen." } };
  }
};
