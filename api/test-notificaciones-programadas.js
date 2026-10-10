// test-notificaciones-programadas.js — avisos por correo nuevos (2026-10-10), sin red: Table Storage y el SDK de correo
// simulados. Cubre: ajustes e interruptores, propuesta abierta (solo la primera vez, solo si el cliente de verdad la vio),
// solicitudes atoradas (4 h, un solo aviso por solicitud, apagado) y el armado del resumen semanal.
const Module = require("module");
const assert = require("assert");

const tablas = {}; // nombre → Map
function fakeTable(nombre) {
  const filas = tablas[nombre] || (tablas[nombre] = new Map());
  const k = (p, r) => p + "|" + r;
  const nf = () => { const e = new Error("nf"); e.statusCode = 404; return e; };
  return {
    createTable: async () => {},
    getEntity: async (p, r) => { const e = filas.get(k(p, r)); if (!e) throw nf(); return { ...e, etag: "v" + (e._v || 0) }; },
    createEntity: async (e) => { if (filas.has(k(e.partitionKey, e.rowKey))) { const x = new Error("dup"); x.statusCode = 409; throw x; } filas.set(k(e.partitionKey, e.rowKey), { ...e, _v: 0 }); },
    upsertEntity: async (e, modo) => { const a = filas.get(k(e.partitionKey, e.rowKey)); filas.set(k(e.partitionKey, e.rowKey), modo === "Merge" && a ? { ...a, ...e, _v: (a._v || 0) + 1 } : { ...e, _v: 0 }); },
    updateEntity: async (e, modo, opts) => {
      const actual = filas.get(k(e.partitionKey, e.rowKey));
      if (!actual) throw nf();
      if (opts && opts.etag && opts.etag !== "v" + (actual._v || 0)) { const x = new Error("etag"); x.statusCode = 412; throw x; }
      filas.set(k(e.partitionKey, e.rowKey), { ...actual, ...e, _v: (actual._v || 0) + 1 });
    },
    listEntities: () => (async function* () { for (const e of [...filas.values()]) yield { ...e }; })(),
  };
}
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "@azure/data-tables") return { TableClient: { fromConnectionString: (c, nombre) => fakeTable(nombre) } };
  return origLoad.call(this, req, ...a);
};

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };
const llamar = async (fn, req) => { const c = { log: { error() {}, warn() {} }, res: null }; await fn(c, req); await new Promise((r) => setTimeout(r, 20)); return c.res; };

(async () => {
  // ── sin configuración de Storage: todo encendido y nunca lanza ──
  delete process.env.RECURSOS_STORAGE_CONNECTION;
  const A = require("./src/notificaciones-ajustes");
  check("sin Storage: defaults (todo encendido, 4 h)", (await A.getAjustes()).general === true && (await A.getAjustes()).horasAtorada === 4);
  check("sin Storage: activo() es verdadero", (await A.activo("resumenSemanal")) === true);

  process.env.RECURSOS_STORAGE_CONNECTION = "x";
  check("con Storage vacío: defaults", (await A.getAjustes()).propuestaAbierta === true);
  let r = await A.actualizarAjustes({ propuestaAbierta: false });
  check("apagar un tipo lo guarda y los demás siguen", r.propuestaAbierta === false && r.nuevaSolicitud === true && (await A.activo("propuestaAbierta")) === false && (await A.activo("nuevaSolicitud")) === true);
  await A.actualizarAjustes({ general: false });
  check("interruptor general apagado apaga todos", (await A.activo("nuevaSolicitud")) === false);
  await A.actualizarAjustes({ general: true, propuestaAbierta: true });
  check("se vuelve a encender", (await A.activo("propuestaAbierta")) === true);
  await assert.rejects(() => A.actualizarAjustes({ general: "no" }), /verdadero o falso/);
  await assert.rejects(() => A.actualizarAjustes({ destinoResumen: "esto no es un correo" }), /correo válido/);
  await assert.rejects(() => A.actualizarAjustes({ destinoResumen: "a@x.com,b@x.com,c@x.com,d@x.com,e@x.com,f@x.com" }), /Máximo/);
  await assert.rejects(() => A.actualizarAjustes({}), /nada que guardar/);
  check("validaciones: no booleano, correo malo, más de 5, vacío", true);
  r = await A.actualizarAjustes({ destinoResumen: " alfredo@x.com ,  viri@x.com " });
  check("destinatarios se limpian y guardan", r.destinoResumen === "alfredo@x.com, viri@x.com" && A.parseDestinos(r.destinoResumen).length === 2);
  await A.guardarUltimoResumen({ en: "2026-10-05T13:00:00.000Z", contadores: { reportesCalificaciones: 3 } });
  check("último resumen se guarda y se lee, sin pisar los ajustes", (await A.leerUltimoResumen()).contadores.reportesCalificaciones === 3 && (await A.getAjustes()).destinoResumen.includes("viri"));

  // ── enviarCorreo respeta los interruptores y el destino ──
  const enviados = [];
  Module._load = function (req, ...a) {
    if (req === "@azure/communication-email") return { EmailClient: class { beginSend(m) { enviados.push(m); return Promise.resolve({}); } } };
    if (req === "@azure/data-tables") return { TableClient: { fromConnectionString: (c, nombre) => fakeTable(nombre) } };
    return origLoad.call(this, req, ...a);
  };
  process.env.ACS_EMAIL_CONNECTION = "endpoint=x"; process.env.NOTIFICACIONES_REMITENTE = "notificaciones@alfredopina.ai"; process.env.NOTIFICACIONES_DESTINO = "dueno@x.com";
  const N = require("./src/notificaciones-correo");
  r = await N.enviarCorreo({ asunto: "a", texto: "a", html: "a", tipo: "nuevaSolicitud" });
  check("tipo encendido: sale al destino de siempre", r.enviado === true && enviados.length === 1 && enviados[0].recipients.to[0].address === "dueno@x.com");
  await A.actualizarAjustes({ nuevaSolicitud: false });
  r = await N.enviarCorreo({ asunto: "a", texto: "a", html: "a", tipo: "nuevaSolicitud" });
  check("tipo apagado: no sale (motivo desactivado)", r.enviado === false && r.motivo === "desactivado" && enviados.length === 1);
  await A.actualizarAjustes({ nuevaSolicitud: true });
  r = await N.enviarCorreo({ asunto: "a", texto: "a", html: "a", tipo: "resumenSemanal", destino: ["alfredo@x.com", "viri@x.com"] });
  check("destino propio: llega a los dos del resumen", r.enviado && enviados[1].recipients.to.length === 2 && enviados[1].recipients.to[1].address === "viri@x.com");
  r = await N.enviarCorreo({ asunto: "a", texto: "a", html: "a" });
  check("sin tipo (uso viejo) sigue funcionando", r.enviado === true);

  // ── propuesta abierta ──
  const P = require("./src/propuestas");
  const snap = P.armarSnapshot({ folio: "AP26-X-1", cliente: "KEMET", contacto: "Anwar", herramienta: "excel", programa: "Excel", temas: [], horas: 8, modalidad: "Presencial", participantes: "5", ciudadSede: "Monterrey", objetivo: "o", dirigidoA: "d", proyectos: [], tarifaHora: 1, precioSugerido: 100, precioFinal: 100, emitida: new Date(), vigencia: new Date() });
  await P.guardarPropuesta(P.getPropuestasTable(), { codigo: "ab12cd34", snapshot: snap });
  const confirmar = require("./confirmarVistaPropuesta");
  const principal = (roles) => ({ "x-ms-client-principal": Buffer.from(JSON.stringify({ userRoles: roles })).toString("base64") });
  const antes = enviados.length;
  let res = await llamar(confirmar, { body: { codigo: "zz" }, headers: {} });
  check("propuesta abierta: código inválido 400", res.status === 400);
  await llamar(confirmar, { body: { codigo: "ab12cd34" }, headers: { ...principal(["admin"]), "user-agent": "Mozilla/5.0" } });
  await llamar(confirmar, { body: { codigo: "ab12cd34" }, headers: { "user-agent": "WhatsApp/2.23" } });
  check("el admin y los robots no disparan aviso", enviados.length === antes);
  await llamar(confirmar, { body: { codigo: "ab12cd34" }, headers: { "user-agent": "Mozilla/5.0" } });
  check("el cliente real dispara UN aviso con folio y cliente", enviados.length === antes + 1 && /AP26-X-1/.test(enviados[antes].content.subject) && /KEMET/.test(enviados[antes].content.subject));
  await llamar(confirmar, { body: { codigo: "ab12cd34" }, headers: { "user-agent": "Mozilla/5.0" } });
  check("la segunda confirmación no repite el aviso", enviados.length === antes + 1);
  res = await llamar(confirmar, { body: { codigo: "zz99zz99" }, headers: { "user-agent": "Mozilla/5.0" } });
  check("propuesta inexistente: responde ok sin avisar", res.status === 200 && enviados.length === antes + 1);
  await A.actualizarAjustes({ propuestaAbierta: false });
  await P.guardarPropuesta(P.getPropuestasTable(), { codigo: "cd34ef56", snapshot: snap });
  await llamar(confirmar, { body: { codigo: "cd34ef56" }, headers: { "user-agent": "Mozilla/5.0" } });
  check("con el aviso apagado no sale correo", enviados.length === antes + 1);
  await A.actualizarAjustes({ propuestaAbierta: true });

  // ── solicitudes atoradas ──
  const T = require("./src/notificaciones-atoradas");
  const ahora = Date.parse("2026-10-12T20:00:00Z");
  const fila = (llave, horasAtras, extra = {}) => ({ rowKey: llave, recibidoEn: new Date(ahora - horasAtras * 3600000).toISOString(), datos: JSON.stringify({ temarioNombre: "Excel Intermedio", empresaNombre: "ACME", nombreContacto: "Ana", correo: "ana@acme.com" }), ...extra });
  const sel = T.seleccionarAtoradas([fila("a", 5), fila("b", 3.9), fila("c", 9), fila("d", 30, { avisadoAtorada: "x" }), { rowKey: "e", recibidoEn: "basura", datos: "{}" }], ahora, 4);
  check("atoradas: solo >= 4 h, sin avisar antes, de la más vieja a la más nueva", sel.length === 2 && sel[0].llave === "c" && sel[1].llave === "a" && sel[0].horasEspera === 9);
  const aviso = T.armarAvisoAtoradas(sel, 4);
  check("el aviso dice cuántas y trae programa y empresa", /2 solicitudes atoradas/.test(aviso.asunto) && /Excel Intermedio/.test(aviso.texto) && /ACME/.test(aviso.texto));

  const atoradas = require("./notificarSolicitudesAtoradas");
  process.env.BACKUP_CRON_SECRET = "secreto";
  const cola = new Map(); tablas.SolicitudesPendientes = cola;
  const enCola = (llave, horasAtras) => cola.set("pend|" + llave, { partitionKey: "pend", rowKey: llave, recibidoEn: new Date(Date.now() - horasAtras * 3600000).toISOString(), datos: JSON.stringify({ temarioNombre: "Power BI", empresaNombre: "KEMET", nombreContacto: "Luis" }), _v: 0 });
  enCola("s1", 6); enCola("s2", 1);
  res = await llamar(atoradas, { headers: {} });
  check("atoradas: sin secreto 401", res.status === 401);
  const n0 = enviados.length;
  res = await llamar(atoradas, { headers: { "x-backup-secret": "secreto" } });
  check("atoradas: avisa solo la de 6 h (la de 1 h no) y la marca", res.status === 200 && res.body.atoradas === 1 && enviados.length === n0 + 1 && cola.get("pend|s1").avisadoAtorada && !cola.get("pend|s2").avisadoAtorada);
  res = await llamar(atoradas, { headers: { "x-backup-secret": "secreto" } });
  check("atoradas: la siguiente revisión no repite el aviso", res.body.atoradas === 0 && enviados.length === n0 + 1);
  enCola("s3", 8);
  await A.actualizarAjustes({ solicitudAtorada: false });
  res = await llamar(atoradas, { headers: { "x-backup-secret": "secreto" } });
  check("atoradas: apagado no envía ni marca", res.body.omitido === "desactivado" && enviados.length === n0 + 1 && !cola.get("pend|s3").avisadoAtorada);
  await A.actualizarAjustes({ solicitudAtorada: true });
  res = await llamar(atoradas, { headers: { "x-backup-secret": "secreto" } });
  check("atoradas: al reencender avisa la que quedó pendiente", res.body.atoradas === 1 && enviados.length === n0 + 2);

  // ── resumen semanal (armado) ──
  const R = require("./src/notificaciones-resumen");
  check("nuevos(): diferencia, nunca negativa, null sin punto de comparación", R.nuevos(10, 4) === 6 && R.nuevos(3, 5) === 0 && R.nuevos(3, undefined) === null && R.nuevos(0, 0) === 0);
  const base = { desde: null, solicitudes: { nuevas: 0, sinAtender: 0, rojas: 0, enCola: 0 }, cotizaciones: { n: 0, monto: 0, rojas: 0, diasRojo: 10, porVencer: 0, vencidas: 0, sinAbrir: 0, aceptadas: [] }, grupos: [], encuestas: [], diagnosticos: [], aperturas: { reportes: null, diplomas: null, desdeLinkedin: null } };
  let m = R.armarResumen(base);
  check("resumen vacío: dice que no hay pendientes y no revienta", /Ninguna solicitud sin atender/.test(m.texto) && /Ninguno\./.test(m.texto) && /Encuestas: sin respuestas nuevas/.test(m.texto));
  check("primer resumen: avisa que empieza a contar aperturas", /empiezo a contarlas/.test(m.texto));
  m = R.armarResumen({ ...base, desde: "2026-10-05T13:00:00.000Z", solicitudes: { nuevas: 2, sinAtender: 3, rojas: 1, enCola: 1 }, cotizaciones: { n: 4, monto: 123456, rojas: 1, diasRojo: 10, porVencer: 1, vencidas: 1, sinAbrir: 2, aceptadas: [{ folio: "AP26-1", cliente: "ACME & Cía" }] },
    grupos: [{ codigo: "G1", curso: "Excel", cliente: "ACME", fecha: "2026-10-13" }], encuestas: [{ cliente: "ACME", n: 5 }], diagnosticos: [{ cliente: "ACME", herramienta: "powerbi", n: 3 }], aperturas: { reportes: 4, diplomas: 7, desdeLinkedin: 2 } });
  check("resumen lleno: solicitudes, pipeline, aceptada por confirmar, grupos, encuestas, diagnósticos y aperturas", /3 solicitudes sin atender/.test(m.texto) && /4 cotizaciones en pipeline por \$123,456/.test(m.texto) && /Aceptada por confirmar: AP26-1/.test(m.texto) && /G1 · Excel/.test(m.texto) && /Encuestas: 5 respuestas/.test(m.texto) && /Power BI 3/.test(m.texto) && /Reportes de calificaciones abiertos: 4/.test(m.texto) && /7, 2 desde LinkedIn/.test(m.texto));
  check("resumen: el HTML escapa los nombres", /ACME &amp; Cía/.test(m.html) && !/ACME & Cía/.test(m.html));

  // ── resumen: Function (apagado, secreto, anti-duplicado) ──
  const resumen = require("./enviarResumenSemanal");
  res = await llamar(resumen, { headers: {}, query: {} });
  check("resumen: sin secreto 401", res.status === 401);
  await A.actualizarAjustes({ resumenSemanal: false });
  res = await llamar(resumen, { headers: { "x-backup-secret": "secreto" }, query: {} });
  check("resumen: apagado responde 200 sin hacer nada", res.status === 200 && res.body.omitido === "desactivado");
  await A.actualizarAjustes({ resumenSemanal: true });
  await A.guardarUltimoResumen({ en: new Date().toISOString(), contadores: {} });
  res = await llamar(resumen, { headers: { "x-backup-secret": "secreto" }, query: {} });
  check("resumen: si ya salió uno hace menos de 20 h no manda otro", res.status === 200 && /20 horas/.test(res.body.omitido));

  // ── resumen: recolectar() con una base simulada (que cada consulta se arme y sus campos se lean bien) ──
  const consultas = [];
  const pool = { request: () => { const q = { input() { return q; }, query: async (texto) => {
    consultas.push(texto);
    if (/FROM Solicitud/.test(texto)) return { recordset: [{ sinAtender: 3, rojas: 1, nuevas: 2 }] };
    if (/FROM Cotizacion/.test(texto)) return { recordset: [
      { folio: "C1", cliente: "ACME", precio_final: 1000, dias: 12, dias_vigencia: -1, blob_path: "propuesta/ab12cd34" },
      { folio: "C2", cliente: "KEMET", precio_final: 2000, dias: 2, dias_vigencia: 5, blob_path: "propuesta/cd34ef56" },
      { folio: "C3", cliente: "LINDE", precio_final: 3000, dias: 1, dias_vigencia: 30, blob_path: "viejo.pdf" },
    ] };
    if (/FROM Grupo/.test(texto)) return { recordset: [{ grupo_codigo: "G1", nombre_curso: "Excel", cliente: "ACME", fecha: "2026-10-13" }] };
    if (/EncuestaRespuesta/.test(texto)) return { recordset: [{ cliente: "ACME", n: 4 }] };
    if (/DiagnosticoRespuesta/.test(texto)) return { recordset: [{ cliente: "KEMET", herramienta: "excel", n: 2 }] };
    return { recordset: [] };
  } }; return q; } };
  const out = await R.recolectar({
    pool, sql: { Int: "int", DateTime2: "dt2" }, umbrales: { solicitudesHoras: 72, cotizacionesDias: 10 }, previo: { en: "2026-10-05T13:00:00.000Z", contadores: { reportesCalificaciones: 2, verificacionesDiplomas: 1, desdeLinkedin: 0 } },
    listarEstadisticasPropuestas: async () => ({ ab12cd34: { vistas: 0 }, cd34ef56: { vistas: 3, aceptadaEn: "2026-10-09T10:00:00Z" } }),
    listarReportesCalificaciones: async () => [{ vistas: 3 }, { vistas: 1 }],
    listarEstadisticasDiplomas: async () => ({ porGrupo: { 1: { vistas: 4, desdeLinkedin: 1 }, 2: { vistas: 1, desdeLinkedin: 0 } } }),
    contarCola: async () => 1,
  });
  const d = out.datos;
  check("recolectar: lanza las 5 consultas de SQL", consultas.length === 5);
  check("recolectar: solicitudes y cola", d.solicitudes.sinAtender === 3 && d.solicitudes.rojas === 1 && d.solicitudes.nuevas === 2 && d.solicitudes.enCola === 1);
  check("recolectar: pipeline suma 6 000, 1 roja, 1 vencida, 1 por vencer", d.cotizaciones.n === 3 && d.cotizaciones.monto === 6000 && d.cotizaciones.rojas === 1 && d.cotizaciones.vencidas === 1 && d.cotizaciones.porVencer === 1);
  check("recolectar: una sin abrir, una aceptada por confirmar, la cotización vieja sin propuesta no cuenta", d.cotizaciones.sinAbrir === 1 && d.cotizaciones.aceptadas.length === 1 && d.cotizaciones.aceptadas[0].folio === "C2");
  check("recolectar: grupos, encuestas y diagnósticos", d.grupos[0].codigo === "G1" && d.encuestas[0].n === 4 && d.diagnosticos[0].herramienta === "excel");
  check("recolectar: aperturas = diferencia contra el resumen anterior", d.aperturas.reportes === 2 && d.aperturas.diplomas === 4 && d.aperturas.desdeLinkedin === 1 && out.contadores.reportesCalificaciones === 4 && out.contadores.verificacionesDiplomas === 5);

  if (fallos) { console.log("\n" + fallos + " prueba(s) fallaron"); process.exit(1); }
  console.log("\ntest-notificaciones-programadas: ok");
})().catch((e) => { console.error(e); process.exit(1); });
