// getContadorRespuestas/index.js
// Function protegida (rol "admin"): contador en vivo de la pestaña QR / Link —
// total global, "hoy" (día en hora de México) y el conteo + estado de cada
// link por grupo.
//
// YA NO toca SQL (2026-09-19): antes hacía COUNT(*) contra apcweb-backoffice
// cada tick del polling, y eso mantenía la base despierta mientras la pestaña
// estuviera abierta (causa raíz del incidente de vCore-seconds del
// 2026-09-17). Ahora enviarRespuesta suma 1 en Table Storage en el momento del
// envío (ver encuesta-links.js) y esto solo lee esos contadores — se puede
// consultar cada 10 s sin costo de base.
const { getEncuestaLinksTable, leerContadores } = require("../src/encuesta-links");
const { getColaTable, resumenPendientes } = require("../src/encuesta-cola");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const data = await leerContadores(getEncuestaLinksTable());
    // envíos que esperan en la cola para pasar a SQL (tarjeta "por importar" del panel) — también Table Storage, no toca SQL
    let pendientes = null;
    try { pendientes = await resumenPendientes(getColaTable()); } catch (errCola) { context.log.warn("No se pudo leer la cola de encuestas:", errCola.message); }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ...data, pendientes } };
  } catch (err) {
    context.log.error("Error leyendo los contadores de encuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo contar: " + err.message } };
  }
};
