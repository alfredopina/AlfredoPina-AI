// test-metricas-y-estado.js — "contar desde" (reinicio de métricas), estado del sistema y botones de prueba de correo
// (2026-10-10). Sin red: Table Storage, SQL, blobs y el SDK de correo simulados.
const Module = require("module");
const assert = require("assert");

const tablas = {};
function fakeTable(nombre) {
  const filas = tablas[nombre] || (tablas[nombre] = new Map());
  const k = (p, r) => p + "|" + r;
  const nf = () => { const e = new Error("nf"); e.statusCode = 404; return e; };
  return {
    createTable: async () => {},
    getEntity: async (p, r) => { const e = filas.get(k(p, r)); if (!e) throw nf(); return { ...e }; },
    createEntity: async (e) => { filas.set(k(e.partitionKey, e.rowKey), { ...e }); },
    upsertEntity: async (e, modo) => { const a = filas.get(k(e.partitionKey, e.rowKey)); filas.set(k(e.partitionKey, e.rowKey), modo === "Merge" && a ? { ...a, ...e } : { ...e }); },
    updateEntity: async (e) => { const a = filas.get(k(e.partitionKey, e.rowKey)); if (!a) throw nf(); filas.set(k(e.partitionKey, e.rowKey), { ...a, ...e }); },
    listEntities: () => (async function* () { for (const e of [...filas.values()]) yield { ...e }; })(),
  };
}

const enviados = [];
const consultas = []; // { texto, params }
let resumenStub = null; // si se define, reemplaza a enviarResumen
let respaldos = [];
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "@azure/data-tables") return { TableClient: { fromConnectionString: (c, nombre) => fakeTable(nombre) } };
  if (req === "@azure/communication-email") return { EmailClient: class { beginSend(m) { enviados.push(m); return Promise.resolve({}); } } };
  if (/\/backoffice-db$/.test(req)) {
    return {
      sql: { Int: "int", DateTime2: "dt2" },
      getPool: async () => ({
        request: () => {
          const params = {};
          const q = { input(n, t, v) { params[n] = v; return q; }, query: async (texto) => {
            consultas.push({ texto, params: { ...params } });
            if (/estatus_curso, g\.estatus_cierre/.test(texto) || /GROUP BY estatus/.test(texto)) return { recordset: [] };
            return { recordset: [{}] };
          } };
          return q;
        },
      }),
    };
  }
  if (/\/backup-tables$/.test(req)) return { getRespaldosContainer: async () => ({ listBlobsFlat: () => (async function* () { for (const b of respaldos) yield b; })() }) };
  // el armado y la recolección del resumen ya se prueban en test-notificaciones-programadas.js: aquí se simulan
  if (/\/notificaciones-resumen$/.test(req)) return { armarResumen: () => ({ asunto: "Resumen de la semana — 1 de enero", texto: "t", html: "<p>h</p>" }), recolectar: async () => ({ datos: {}, contadores: { c: 1 } }) };
  if (/\/notificaciones-resumen-envio$/.test(req) && resumenStub) return { enviarResumen: resumenStub };
  return origLoad.call(this, req, ...a);
};

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };
const llamar = async (fn, req = {}) => { const c = { log: { error() {}, warn() {} }, res: null }; await fn(c, req); await new Promise((r) => setTimeout(r, 10)); return c.res; };

(async () => {
  // ── contar desde ──
  delete process.env.RECURSOS_STORAGE_CONNECTION;
  const M = require("./src/metricas-desde");
  let d = await M.getMetricasRango();
  check("sin Storage: cuenta todo (sin desde ni hasta) y no lanza", M.TRACKINGS.every((t) => d[t].desde === null && d[t].hasta === null));
  process.env.RECURSOS_STORAGE_CONNECTION = "x";
  d = await M.getMetricasRango();
  check("con Storage vacío: cuenta todo", M.TRACKINGS.every((t) => d[t].desde === null && d[t].hasta === null));
  d = await M.cambiarMetricasDesde("solicitudes", "reiniciar", { ahora: new Date("2026-10-12T15:00:00Z") });
  check("reiniciar guarda 'desde' solo de ese Tracking, sin fin", d.solicitudes.desde === "2026-10-12T15:00:00.000Z" && d.solicitudes.hasta === null && d.cotizaciones.desde === null && d.grupos.desde === null);
  d = await M.cambiarMetricasDesde("grupos", "reiniciar", { ahora: new Date("2026-10-13T15:00:00Z") });
  check("los demás Trackings no se pisan", d.solicitudes.desde === "2026-10-12T15:00:00.000Z" && d.grupos.desde === "2026-10-13T15:00:00.000Z");
  d = await M.cambiarMetricasDesde("solicitudes", "quitar");
  check("quitar vuelve a contar todo (y no toca los otros)", d.solicitudes.desde === null && d.solicitudes.hasta === null && d.grupos.desde === "2026-10-13T15:00:00.000Z");
  await assert.rejects(() => M.cambiarMetricasDesde("clientes", "reiniciar"), /Tracking/);
  await assert.rejects(() => M.cambiarMetricasDesde("grupos", "borrar"), /Acción/);
  check("Clientes (sin métricas acumuladas) y acciones raras se rechazan", true);

  // rango de fechas (pruebas): el día "hasta" cuenta completo; hora de Monterrey (UTC-6)
  d = await M.cambiarMetricasDesde("cotizaciones", "rango", { desde: "2026-10-12", hasta: "2026-10-15" });
  check("rango: desde = inicio del día en Monterrey y hasta = inicio del día SIGUIENTE (incluye el 15 completo)", d.cotizaciones.desde === "2026-10-12T06:00:00.000Z" && d.cotizaciones.hasta === "2026-10-16T06:00:00.000Z");
  d = await M.cambiarMetricasDesde("cotizaciones", "rango", { desde: "2026-10-12", hasta: "" });
  check("rango con solo 'desde': sin fin (y borra el 'hasta' anterior)", d.cotizaciones.desde === "2026-10-12T06:00:00.000Z" && d.cotizaciones.hasta === null);
  d = await M.cambiarMetricasDesde("cotizaciones", "rango", { desde: "", hasta: "2026-10-15" });
  check("rango con solo 'hasta': sin inicio", d.cotizaciones.desde === null && d.cotizaciones.hasta === "2026-10-16T06:00:00.000Z");
  d = await M.cambiarMetricasDesde("cotizaciones", "rango", { desde: "2026-10-15", hasta: "2026-10-15" });
  check("rango de un solo día es válido", d.cotizaciones.desde === "2026-10-15T06:00:00.000Z" && d.cotizaciones.hasta === "2026-10-16T06:00:00.000Z");
  await assert.rejects(() => M.cambiarMetricasDesde("cotizaciones", "rango", { desde: "2026-10-16", hasta: "2026-10-12" }), /anterior/);
  await assert.rejects(() => M.cambiarMetricasDesde("cotizaciones", "rango", { desde: "", hasta: "" }), /al menos una fecha/);
  await assert.rejects(() => M.cambiarMetricasDesde("cotizaciones", "rango", { desde: "12/10/2026" }), /fecha/);
  check("rango: 'hasta' anterior a 'desde', sin fechas o con formato raro se rechazan", true);
  d = await M.cambiarMetricasDesde("cotizaciones", "reiniciar", { ahora: new Date("2026-10-20T15:00:00Z") });
  check("reiniciar después de un rango borra el 'hasta'", d.cotizaciones.desde === "2026-10-20T15:00:00.000Z" && d.cotizaciones.hasta === null);
  d = await M.getMetricasDesde();
  check("getMetricasDesde (compatibilidad) devuelve solo los 'desde'", d.cotizaciones === "2026-10-20T15:00:00.000Z" && d.solicitudes === null);
  await M.cambiarMetricasDesde("cotizaciones", "quitar");

  const reiniciar = require("./reiniciarMetricas");
  let r = await llamar(reiniciar, { body: { tracking: "cotizaciones", accion: "reiniciar" } });
  check("Function reiniciarMetricas: 200 con el rango", r.status === 200 && !!r.body.cotizaciones.desde);
  r = await llamar(reiniciar, { body: { tracking: "cotizaciones", accion: "rango", desde: "2026-10-12", hasta: "2026-10-15" } });
  check("Function reiniciarMetricas: acción rango guarda desde y hasta", r.status === 200 && r.body.cotizaciones.desde === "2026-10-12T06:00:00.000Z" && r.body.cotizaciones.hasta === "2026-10-16T06:00:00.000Z");
  r = await llamar(reiniciar, { body: { tracking: "cotizaciones", accion: "rango", desde: "2026-10-16", hasta: "2026-10-12" } });
  check("Function reiniciarMetricas: rango al revés → 400 con mensaje", r.status === 400 && /anterior/.test(r.body.error));
  r = await llamar(reiniciar, { body: { tracking: "clientes", accion: "reiniciar" } });
  check("Function reiniciarMetricas: Tracking sin métricas → 400", r.status === 400);
  r = await llamar(require("./getMetricasDesde"));
  check("Function getMetricasDesde devuelve el rango de cada Tracking", r.status === 200 && r.body.cotizaciones.desde === "2026-10-12T06:00:00.000Z" && r.body.grupos.desde === "2026-10-13T15:00:00.000Z" && r.body.solicitudes.hasta === null);

  // ── las tres Functions de resumen respetan "contar desde / hasta" ──
  const corre = async (fn) => { consultas.length = 0; const res = await llamar(fn); return { res, consultas: consultas.slice() }; };
  for (const t of M.TRACKINGS) await M.cambiarMetricasDesde(t, "quitar");
  for (const [nombre, patron, patronHasta] of [["getResumenSolicitudesAdmin", /s\.fecha_creacion >= @desde/, /s\.fecha_creacion < @hasta/], ["getResumenCotizacionesAdmin", /COALESCE\(fecha_cierre, fecha_estatus\) >= @desde/, /COALESCE\(fecha_cierre, fecha_estatus\) < @hasta/], ["getResumenGruposAdmin", /fecha_cierre >= @desde/, /fecha_cierre < @hasta/]]) {
    let x = await corre(require("./" + nombre));
    const con = x.consultas.filter((c) => "desde" in c.params);
    check(nombre + ": sin rango manda @desde y @hasta = NULL y responde contando_* null", x.res.status === 200 && con.length >= 1 && con.every((c) => c.params.desde === null && c.params.hasta === null) && x.res.body.contando_desde === null && x.res.body.contando_hasta === null && con.some((c) => patron.test(c.texto)) && con.some((c) => patronHasta.test(c.texto)));
    const clave = nombre.includes("Solicitudes") ? "solicitudes" : nombre.includes("Cotizaciones") ? "cotizaciones" : "grupos";
    await M.cambiarMetricasDesde(clave, "reiniciar", { ahora: new Date("2026-10-12T15:00:00Z") });
    x = await corre(require("./" + nombre));
    const con2 = x.consultas.filter((c) => "desde" in c.params);
    check(nombre + ": con reinicio manda el desde y deja el hasta en NULL", x.res.status === 200 && con2.length >= 1 && con2.every((c) => c.params.desde instanceof Date && c.params.desde.toISOString() === "2026-10-12T15:00:00.000Z" && c.params.hasta === null) && x.res.body.contando_desde === "2026-10-12T15:00:00.000Z" && x.res.body.contando_hasta === null);
    await M.cambiarMetricasDesde(clave, "rango", { desde: "2026-10-12", hasta: "2026-10-15" });
    x = await corre(require("./" + nombre));
    const con3 = x.consultas.filter((c) => "desde" in c.params);
    check(nombre + ": con rango manda ambas fechas y las devuelve", x.res.status === 200 && con3.length >= 1 && con3.every((c) => c.params.desde.toISOString() === "2026-10-12T06:00:00.000Z" && c.params.hasta.toISOString() === "2026-10-16T06:00:00.000Z") && x.res.body.contando_desde === "2026-10-12T06:00:00.000Z" && x.res.body.contando_hasta === "2026-10-16T06:00:00.000Z");
    await M.cambiarMetricasDesde(clave, "quitar");
  }
  const xc = await corre(require("./getResumenCotizacionesAdmin"));
  check("Cotizaciones: el pipeline (estado vivo) no se filtra por la fecha", !/Enviada', 'En negociación'\)[^)]*@desde/.test(xc.consultas.map((c) => c.texto).join("\n").split("ganado_conteo")[0]));

  // ── estado del sistema ──
  const estado = require("./getEstadoSistema");
  respaldos = [{ name: "a_manual.json", properties: { createdOn: "2026-10-01T06:00:00Z" } }, { name: "b_auto.json", properties: { createdOn: "2026-10-05T06:00:00Z" } }];
  process.env.ACS_EMAIL_CONNECTION = "endpoint=x"; process.env.NOTIFICACIONES_REMITENTE = "notificaciones@alfredopina.ai"; process.env.NOTIFICACIONES_DESTINO = "dueno@x.com";
  const cola = new Map(); tablas.SolicitudesPendientes = cola;
  cola.set("pend|a", { partitionKey: "pend", rowKey: "a", recibidoEn: new Date(Date.now() - 7 * 3600000).toISOString() });
  cola.set("pend|b", { partitionKey: "pend", rowKey: "b", recibidoEn: new Date(Date.now() - 1 * 3600000).toISOString() });
  const A = require("./src/notificaciones-ajustes");
  await A.actualizarAjustes({ solicitudAtorada: false });
  await A.guardarUltimoResumen({ en: "2026-10-12T13:00:00.000Z", contadores: {} });
  consultas.length = 0;
  r = await llamar(estado);
  check("estado: cola de 2 con la más antigua de 7 h", r.status === 200 && r.body.cola.pendientes === 2 && r.body.cola.masAntiguaHoras === 7);
  check("estado: último respaldo es el más reciente y su origen", r.body.respaldo.en === "2026-10-05T06:00:00.000Z" && r.body.respaldo.origen === "auto");
  check("estado: último resumen y correo configurado con 5 de 6 avisos", r.body.resumen.en === "2026-10-12T13:00:00.000Z" && r.body.correo.configurado === true && r.body.correo.avisosActivos === 5 && r.body.correo.avisosTotal === 6 && r.body.correo.remitente === "notificaciones@alfredopina.ai");
  check("estado: nunca consultó SQL (no despierta la base)", consultas.length === 0);
  respaldos = []; cola.clear(); delete process.env.ACS_EMAIL_CONNECTION;
  r = await llamar(estado);
  check("estado: sin respaldos, sin cola y sin correo configurado no truena", r.status === 200 && r.body.cola.pendientes === 0 && r.body.cola.masAntiguaHoras === null && r.body.respaldo.en === null && r.body.correo.configurado === false);

  // ── botones de prueba de correo ──
  const probar = require("./probarNotificacionCorreo");
  r = await llamar(probar, { body: { accion: "prueba" } });
  check("prueba sin configuración de Azure → 400 con el motivo", r.status === 400 && /ACS_EMAIL_CONNECTION/.test(r.body.error));
  process.env.ACS_EMAIL_CONNECTION = "endpoint=x";
  await A.actualizarAjustes({ general: false });
  const n0 = enviados.length;
  r = await llamar(probar, { body: { accion: "prueba" } });
  check("prueba manda UN correo aunque el interruptor general esté apagado", r.status === 200 && enviados.length === n0 + 1 && enviados[n0].recipients.to[0].address === "dueno@x.com" && /prueba/i.test(enviados[n0].content.subject));
  await A.actualizarAjustes({ general: true });
  r = await llamar(probar, { body: { accion: "otra" } });
  check("acción desconocida → 400", r.status === 400);

  // enviarResumen real (armado y recolección simulados): automático vs manual
  const { enviarResumen } = require("./src/notificaciones-resumen-envio");
  await A.actualizarAjustes({ general: true, resumenSemanal: true, destinoResumen: "alfredo@x.com, viri@x.com" });
  await A.guardarUltimoResumen({ en: "2026-01-01T00:00:00.000Z", contadores: {} });
  let n1 = enviados.length;
  let x = await enviarResumen({ manual: false });
  check("resumen automático: sale a los destinatarios de Configuración, sin (prueba), y mueve el punto de comparación", x.status === 200 && x.body.enviado === true && enviados.length === n1 + 1 && enviados[n1].recipients.to.length === 2 && !/prueba/.test(enviados[n1].content.subject) && (await A.leerUltimoResumen()).contadores.c === 1);
  x = await enviarResumen({ manual: false });
  check("resumen automático: no repite dentro de 20 h", x.body.omitido && enviados.length === n1 + 1);
  const puntoAntes = (await A.leerUltimoResumen()).en;
  await A.actualizarAjustes({ resumenSemanal: false });
  x = await enviarResumen({ manual: false });
  check("resumen automático con el aviso apagado: no sale", x.body.omitido === "desactivado" && enviados.length === n1 + 1);
  x = await enviarResumen({ manual: true });
  check("resumen manual: sale aunque esté apagado, solo a NOTIFICACIONES_DESTINO, con (prueba), sin mover el punto de comparación", x.status === 200 && x.body.prueba === true && enviados.length === n1 + 2 && enviados[n1 + 1].recipients.to.length === 1 && enviados[n1 + 1].recipients.to[0].address === "dueno@x.com" && /(prueba)/.test(enviados[n1 + 1].content.subject) && (await A.leerUltimoResumen()).en === puntoAntes);
  await A.actualizarAjustes({ resumenSemanal: true });

  // resumen manual: se prueba la Function con enviarResumen simulado y la lógica real de manual/automático aparte
  resumenStub = async ({ manual }) => (manual ? { status: 503, body: { despertando: true } } : { status: 200, body: {} });
  delete require.cache[require.resolve("./probarNotificacionCorreo")];
  const probar2 = require("./probarNotificacionCorreo");
  r = await llamar(probar2, { body: { accion: "resumen" } });
  check("resumen manual con la base dormida → 503 con mensaje en español", r.status === 503 && /despertando/.test(r.body.error));
  resumenStub = async () => ({ status: 200, body: { ok: true, enviado: true, prueba: true } });
  delete require.cache[require.resolve("./probarNotificacionCorreo")];
  r = await llamar(require("./probarNotificacionCorreo"), { body: { accion: "resumen" } });
  check("resumen manual enviado → 200", r.status === 200 && r.body.ok === true);

  if (fallos) { console.log("\n" + fallos + " prueba(s) fallaron"); process.exit(1); }
  console.log("\ntest-metricas-y-estado: ok");
})().catch((e) => { console.error(e); process.exit(1); });
