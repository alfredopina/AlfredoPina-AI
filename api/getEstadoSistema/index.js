// getEstadoSistema/index.js
// Function protegida (rol "admin"): una mirada rápida a "¿está todo vivo?" para Configuración → Estado del sistema.
// Lee SOLO Table Storage y blobs, NUNCA SQL: abrir este panel no despierta la base ni gasta vCore-segundos.
//   cola ......... solicitudes del sitio que esperan en la cola (pasan a SQL al abrir el admin) y la más antigua
//   respaldo ..... último respaldo de Table Storage (automático o manual)
//   resumen ...... cuándo salió el último resumen semanal real
//   correo ....... si Azure Communication Services está configurado y cuántos avisos están encendidos
//   base ......... estado de apcweb-backoffice (dormida/despertando/despierta) y cuota gratis del mes: se lo pregunta a Azure Resource
//                  Manager (api/src/estado-base.js), NO a SQL, así que tampoco despierta la base
const { getColaTable } = require("../src/solicitud-publica-cola");
const { getRespaldosContainer } = require("../src/backup-tables");
const ajustes = require("../src/notificaciones-ajustes");
const { configuracion } = require("../src/notificaciones-correo");
const { consultarEstadoBase, resumenCuota } = require("../src/estado-base");
const { JSON_HEADERS } = require("../src/http");

async function leerCola() {
  let n = 0, masAntigua = null;
  try {
    for await (const e of getColaTable().listEntities({ queryOptions: { filter: "PartitionKey eq 'pend'", select: ["rowKey", "recibidoEn"] } })) {
      n++;
      if (e.recibidoEn && (!masAntigua || e.recibidoEn < masAntigua)) masAntigua = e.recibidoEn;
    }
  } catch (err) {
    if (err.statusCode !== 404) throw err; // sin tabla = cola vacía
  }
  return { pendientes: n, masAntiguaHoras: masAntigua ? Math.max(0, Math.floor((Date.now() - Date.parse(masAntigua)) / 3600000)) : null };
}

async function ultimoRespaldo() {
  let mejor = null;
  const container = await getRespaldosContainer();
  for await (const blob of container.listBlobsFlat()) {
    const t = blob.properties && (blob.properties.createdOn || blob.properties.lastModified);
    if (t && (!mejor || new Date(t) > new Date(mejor.en))) {
      const m = /_(auto|manual)\.json$/.exec(blob.name);
      mejor = { en: new Date(t).toISOString(), origen: m ? m[1] : "desconocido" };
    }
  }
  return mejor;
}

// una parte que falle no tumba las demás: cada una responde su propio { error }
async function seccion(fn) {
  try { return await fn(); } catch (err) { return { error: err.message }; }
}

module.exports = async function (context) {
  const [cola, respaldo, previo, a, baseRaw] = await Promise.all([
    seccion(leerCola), seccion(ultimoRespaldo), seccion(() => ajustes.leerUltimoResumen()), seccion(() => ajustes.getAjustes()), seccion(() => consultarEstadoBase()),
  ]);
  const base = baseRaw && !baseRaw.error
    ? { estado: baseRaw.estado, motivo: baseRaw.motivo || null, cuota: resumenCuota(baseRaw.cuotaSegundos), cuotaDiag: baseRaw.cuotaDiag || null }
    : { estado: "desconocido", motivo: "error", cuota: null, cuotaDiag: null };
  const cfg = configuracion();
  const avisos = a && !a.error ? ajustes.TIPOS.filter((t) => a[t] !== false).length : null;
  context.res = {
    status: 200,
    headers: { ...JSON_HEADERS, "Cache-Control": "no-store" },
    body: {
      cola,
      base,
      respaldo: respaldo && !respaldo.error ? respaldo : respaldo === null ? { en: null } : respaldo,
      resumen: previo && !previo.error ? { en: previo.en || null } : { en: null },
      correo: { configurado: Boolean(cfg), remitente: cfg ? cfg.remitente : null, general: a && !a.error ? a.general !== false : null, avisosActivos: avisos, avisosTotal: ajustes.TIPOS.length },
    },
  };
};
