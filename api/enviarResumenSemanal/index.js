// enviarResumenSemanal/index.js
// Function pública protegida por secreto (header x-backup-secret), disparada por el cron de GitHub Actions
// "Notificaciones programadas" los lunes 7:00 (hora de Monterrey). Arma el resumen de la semana y lo manda por correo a
// los destinatarios de Configuración → Notificaciones (o a NOTIFICACIONES_DESTINO si ese campo está vacío).
//
// Necesita SQL, que suele estar dormida: si no despierta en ~35 s responde 503 {despertando:true} (las Functions
// administradas cortan a los 45 s) y el workflow vuelve a llamar cada 2 min — la primera llamada ya la despertó.
// Anti-duplicado: si ya salió un resumen hace menos de 20 h no manda otro (salvo ?forzar=1, para pruebas manuales).
const { autorizado } = require("../src/cron-secreto");
const { getPool, sql } = require("../src/backoffice-db");
const { getUmbrales } = require("../src/notificaciones-config");
const ajustes = require("../src/notificaciones-ajustes");
const { enviarCorreo } = require("../src/notificaciones-correo");
const { armarResumen, recolectar } = require("../src/notificaciones-resumen");
const { getPropuestasTable, listarEstadisticas: estadisticasPropuestas } = require("../src/propuestas");
const { getCalificacionesReportesTable, listarReportesCalificaciones } = require("../src/calificaciones-reportes");
const { getDiplomasVerifTable, listarEstadisticas: estadisticasDiplomas } = require("../src/diplomas-verif");
const { getColaTable } = require("../src/solicitud-publica-cola");
const { JSON_HEADERS } = require("../src/http");

const ESPERA_SQL_MS = 35000;

async function contarCola() {
  try {
    let n = 0;
    for await (const e of getColaTable().listEntities({ queryOptions: { filter: "PartitionKey eq 'pend'", select: ["rowKey"] } })) { n++; void e; }
    return n;
  } catch (err) {
    return 0; // sin tabla = sin cola
  }
}

module.exports = async function (context, req) {
  if (!autorizado(req)) {
    context.res = { status: 401, headers: JSON_HEADERS, body: { error: "No autorizado." } };
    return;
  }
  const responder = (status, body) => { context.res = { status, headers: JSON_HEADERS, body }; };
  try {
    const a = await ajustes.getAjustes();
    if (a.general === false || a.resumenSemanal === false) return responder(200, { ok: true, omitido: "desactivado" });

    const previo = await ajustes.leerUltimoResumen();
    const forzar = String((req.query && req.query.forzar) || "") === "1";
    if (!forzar && previo && previo.en && Date.now() - Date.parse(previo.en) < 20 * 3600 * 1000) {
      return responder(200, { ok: true, omitido: "ya se envió hace menos de 20 horas" });
    }

    let pool;
    try {
      pool = await Promise.race([getPool(), new Promise((_, rechazar) => setTimeout(() => rechazar(new Error("la base sigue despertando")), ESPERA_SQL_MS))]);
    } catch (err) {
      context.log.warn("Resumen semanal: " + err.message);
      return responder(503, { ok: false, despertando: true });
    }

    const umbrales = await getUmbrales();
    const ahora = new Date();
    const { datos, contadores } = await recolectar({
      pool, sql, umbrales, previo, ahora,
      listarEstadisticasPropuestas: () => estadisticasPropuestas(getPropuestasTable()),
      listarReportesCalificaciones: () => listarReportesCalificaciones(getCalificacionesReportesTable()),
      listarEstadisticasDiplomas: () => estadisticasDiplomas(getDiplomasVerifTable()),
      contarCola,
    });

    let destino = [];
    try { destino = ajustes.parseDestinos(a.destinoResumen); } catch (err) { /* campo mal escrito: se usa el destino de siempre */ }
    const r = await enviarCorreo({ tipo: "resumenSemanal", destino, ...armarResumen(datos) });
    if (!r.enviado) return responder(r.motivo === "desactivado" ? 200 : 502, { ok: false, motivo: r.motivo });

    await ajustes.guardarUltimoResumen({ en: ahora.toISOString(), contadores });
    responder(200, { ok: true, enviado: true });
  } catch (err) {
    context.log.error("Error armando el resumen semanal:", err.message);
    responder(500, { error: "No se pudo armar el resumen." });
  }
};
