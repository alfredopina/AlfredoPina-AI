// notificarSolicitudesAtoradas/index.js
// Function pública protegida por secreto (header x-backup-secret), disparada por el cron de GitHub Actions
// "Notificaciones programadas" (cada ~3 h en horario de día). Revisa la cola de solicitudes del formulario público
// (Table Storage, NUNCA SQL: no despierta la base) y manda UN correo con las que llevan más de N horas sin procesarse
// (N = Configuración → Notificaciones, default 4). Cada solicitud se avisa una sola vez (se marca avisadoAtorada).
// Sin timerTrigger a propósito (no soportado en este hosting, ver CLAUDE.md).
const { autorizado } = require("../src/cron-secreto");
const { getColaTable } = require("../src/solicitud-publica-cola");
const ajustes = require("../src/notificaciones-ajustes");
const { enviarCorreo } = require("../src/notificaciones-correo");
const { seleccionarAtoradas, armarAvisoAtoradas } = require("../src/notificaciones-atoradas");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  if (!autorizado(req)) {
    context.res = { status: 401, headers: JSON_HEADERS, body: { error: "No autorizado." } };
    return;
  }
  try {
    const a = await ajustes.getAjustes();
    if (a.general === false || a.solicitudAtorada === false) {
      context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, omitido: "desactivado" } };
      return;
    }
    const tabla = getColaTable();
    const pendientes = [];
    try {
      for await (const e of tabla.listEntities({ queryOptions: { filter: "PartitionKey eq 'pend'" } })) pendientes.push(e);
    } catch (err) {
      if (err.statusCode === 404) { // la tabla se crea con la primera solicitud: sin tabla no hay nada que avisar
        context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, atoradas: 0 } };
        return;
      }
      throw err;
    }
    const lista = seleccionarAtoradas(pendientes, Date.now(), a.horasAtorada);
    if (!lista.length) {
      context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, atoradas: 0 } };
      return;
    }
    const r = await enviarCorreo({ tipo: "solicitudAtorada", ...armarAvisoAtoradas(lista, a.horasAtorada) });
    if (!r.enviado) {
      // sin marcar nada: la próxima revisión lo reintenta
      context.res = { status: r.motivo === "desactivado" ? 200 : 502, headers: JSON_HEADERS, body: { ok: false, atoradas: lista.length, motivo: r.motivo } };
      return;
    }
    const ahora = new Date().toISOString();
    for (const s of lista) {
      try { await tabla.updateEntity({ partitionKey: "pend", rowKey: s.llave, avisadoAtorada: ahora }, "Merge"); }
      catch (err) { context.log.warn("No se pudo marcar como avisada " + s.llave + ": " + err.message); }
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, atoradas: lista.length, avisadas: true } };
  } catch (err) {
    context.log.error("Error revisando solicitudes atoradas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo revisar la cola." } };
  }
};
