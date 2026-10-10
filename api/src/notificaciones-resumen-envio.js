// api/src/notificaciones-resumen-envio.js
// Junta, arma y manda el resumen semanal. Lo usan la Function del cron (enviarResumenSemanal) y el botón "Enviar resumen
// ahora" de Configuración → Notificaciones (probarNotificacionCorreo). Regresa { status, body }: nunca lanza.
//
//   automático (lunes): respeta los interruptores, no repite si ya salió uno hace < 20 h, va a los destinatarios de
//                       Configuración y guarda el punto de comparación (ultimoResumen) para contar lo NUEVO la próxima vez.
//   manual (prueba):    se manda aunque los interruptores estén apagados, solo a NOTIFICACIONES_DESTINO (Alfredo), con
//                       "(prueba)" en el asunto, y NO mueve el punto de comparación (el resumen del lunes sigue contando
//                       desde el último resumen real).
// Necesita SQL, que suele estar dormida: si no despierta en ~35 s regresa 503 {despertando:true} (las Functions
// administradas cortan a los 45 s); el cron reintenta cada 2 min.
const { getPool, sql } = require("./backoffice-db");
const { getUmbrales } = require("./notificaciones-config");
const ajustes = require("./notificaciones-ajustes");
const { enviarCorreo } = require("./notificaciones-correo");
const { armarResumen, recolectar } = require("./notificaciones-resumen");
const { getPropuestasTable, listarEstadisticas: estadisticasPropuestas } = require("./propuestas");
const { getCalificacionesReportesTable, listarReportesCalificaciones } = require("./calificaciones-reportes");
const { getDiplomasVerifTable, listarEstadisticas: estadisticasDiplomas } = require("./diplomas-verif");
const { getColaTable } = require("./solicitud-publica-cola");

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

async function enviarResumen({ context, manual = false } = {}) {
  const log = (context && context.log) || console;
  try {
    const a = await ajustes.getAjustes();
    if (!manual && (a.general === false || a.resumenSemanal === false)) return { status: 200, body: { ok: true, omitido: "desactivado" } };

    const previo = await ajustes.leerUltimoResumen();
    if (!manual && previo && previo.en && Date.now() - Date.parse(previo.en) < 20 * 3600 * 1000) {
      return { status: 200, body: { ok: true, omitido: "ya se envió hace menos de 20 horas" } };
    }

    let pool;
    try {
      pool = await Promise.race([getPool(), new Promise((_, rechazar) => setTimeout(() => rechazar(new Error("la base sigue despertando")), ESPERA_SQL_MS))]);
    } catch (err) {
      log.warn("Resumen semanal: " + err.message);
      return { status: 503, body: { ok: false, despertando: true } };
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

    const resumen = armarResumen(datos);
    let r;
    if (manual) {
      r = await enviarCorreo({ ...resumen, asunto: resumen.asunto.replace("Resumen de la semana", "Resumen de la semana (prueba)") });
    } else {
      let destino = [];
      try { destino = ajustes.parseDestinos(a.destinoResumen); } catch (err) { /* campo mal escrito: se usa el destino de siempre */ }
      r = await enviarCorreo({ tipo: "resumenSemanal", destino, ...resumen });
    }
    if (!r.enviado) {
      if (r.motivo === "sin configurar") return { status: 400, body: { ok: false, motivo: r.motivo } };
      return { status: r.motivo === "desactivado" ? 200 : 502, body: { ok: false, motivo: r.motivo } };
    }

    if (!manual) await ajustes.guardarUltimoResumen({ en: ahora.toISOString(), contadores });
    return { status: 200, body: { ok: true, enviado: true, prueba: manual } };
  } catch (err) {
    log.error("Error armando el resumen semanal:", err.message);
    return { status: 500, body: { error: "No se pudo armar el resumen." } };
  }
}

module.exports = { enviarResumen, contarCola };
