// test-estado-base.js — estado de la base (dormida/despertando/despierta) vía Azure Resource Manager, sin red:
// fetch simulado. Verifica el mapeo de estados, que nunca lance, el caché del token y que jamás se toque SQL.
const assert = require("assert");
const { consultarEstadoBase, mapearEstado, leerConfiguracion, resumenCuota, resumenCosto, _reiniciarCache } = require("./src/estado-base");

let fallos = 0;
function check(nombre, cond) { if (cond) console.log("  ok  " + nombre); else { fallos++; console.log("  FALLA  " + nombre); } }

const RECURSO = "/subscriptions/56546bd8-e947-4ccc-8956-b2cb29e78859/resourceGroups/GR_AlfredoPina/providers/Microsoft.Sql/servers/apcweb-sql-server/databases/apcweb-backoffice";
const ENV = { ESTADO_BD_TENANT_ID: "t-id", ESTADO_BD_CLIENT_ID: "c-id", ESTADO_BD_CLIENT_SECRET: "secreto-falso", ESTADO_BD_RESOURCE_ID: RECURSO };

function respuesta(status, cuerpo) { return { ok: status >= 200 && status < 300, status, json: async () => cuerpo }; }

// fetch simulado: registra llamadas y responde según la URL
function crearFetch({ status = "Paused", tokenOk = true, bdStatus = 200, metrica = 35143, facturado = [60000, 55000] } = {}) {
  const llamadas = [];
  const f = async (url, opts) => {
    llamadas.push({ url, opts });
    if (url.includes("login.microsoftonline.com")) return tokenOk ? respuesta(200, { access_token: "tok", expires_in: 3599 }) : respuesta(401, {});
    if (url.includes("metricnames=app_cpu_billed")) return respuesta(200, { value: [{ name: { value: "app_cpu_billed" }, timeseries: [{ data: facturado.map((total, i) => ({ timeStamp: "2026-10-0" + (i + 1) + "T00:00:00Z", total })).concat([{ timeStamp: "2026-10-09T00:00:00Z" }]) }] }] });
    if (url.includes("microsoft.insights/metrics")) return respuesta(200, { value: [{ timeseries: [{ data: [{ minimum: metrica + 5 }, { minimum: metrica }, {}] }] }] });
    if (url.includes("/databases/")) return bdStatus === 200 ? respuesta(200, { properties: { status, minCapacity: 0.5, autoPauseDelay: 60 }, sku: { capacity: 2 } }) : respuesta(bdStatus, {});
    throw new Error("url inesperada " + url);
  };
  f.llamadas = llamadas;
  return f;
}

(async () => {
  // mapeo
  check("Paused → dormida", mapearEstado("Paused") === "dormida");
  check("Pausing → dormida", mapearEstado("Pausing") === "dormida");
  check("Resuming → despertando", mapearEstado("Resuming") === "despertando");
  check("Online → despierta", mapearEstado("Online") === "despierta");
  check("valor raro → desconocido", mapearEstado("Quién sabe") === "desconocido" && mapearEstado(null) === "desconocido");

  // configuración
  check("sin settings → null", leerConfiguracion({}) === null);
  check("recurso mal formado → null", leerConfiguracion({ ...ENV, ESTADO_BD_RESOURCE_ID: "/otra/cosa" }) === null);
  check("settings completos → config", leerConfiguracion(ENV) && leerConfiguracion(ENV).cliente === "c-id");
  let r = await consultarEstadoBase({ env: {}, fetchFn: async () => { throw new Error("no debía llamar"); } });
  check("sin configurar → desconocido (sin tocar la red)", r.estado === "desconocido" && r.motivo === "sin-configurar");

  // camino feliz: dormida, token con secret y ámbito de ARM, GET sin tocar SQL
  _reiniciarCache();
  let f = crearFetch({ status: "Paused" });
  r = await consultarEstadoBase({ env: ENV, fetchFn: f, ahora: 1000000 });
  check("dormida", r.estado === "dormida" && r.crudo === "Paused");
  check("cuota gratis leída (última lectura con dato)", r.cuotaSegundos === 35143);
  const tok = f.llamadas[0];
  check("token: client_credentials contra management.azure.com", tok.opts.method === "POST" && tok.opts.body.includes("grant_type=client_credentials") && tok.opts.body.includes(encodeURIComponent("https://management.azure.com/.default")));
  const get = f.llamadas.find((c) => c.url.includes("/databases/") && !c.url.includes("insights"));
  check("GET a ARM con Bearer", get.url.startsWith("https://management.azure.com" + RECURSO) && get.opts.headers.Authorization === "Bearer tok");
  check("nunca se abre SQL (solo login.microsoftonline.com y management.azure.com)", f.llamadas.every((c) => /^https:\/\/(login\.microsoftonline\.com|management\.azure\.com)\//.test(c.url)));

  // caché: segundo sondeo reutiliza token y cuota
  const antes = f.llamadas.length;
  r = await consultarEstadoBase({ env: ENV, fetchFn: f, ahora: 1000000 + 60000 });
  check("2º sondeo: solo 1 llamada nueva (token y cuota en caché)", f.llamadas.length === antes + 1);
  // pasada la vida de la cuota, se vuelve a pedir
  r = await consultarEstadoBase({ env: ENV, fetchFn: f, ahora: 1000000 + 11 * 60000 });
  check("a los 11 min la cuota se vuelve a pedir", f.llamadas.filter((c) => c.url.includes("free_amount_remaining")).length === 2);

  // estados
  _reiniciarCache();
  r = await consultarEstadoBase({ env: ENV, fetchFn: crearFetch({ status: "Resuming" }), ahora: 1 });
  check("Resuming → despertando", r.estado === "despertando");
  _reiniciarCache();
  r = await consultarEstadoBase({ env: ENV, fetchFn: crearFetch({ status: "Online" }), ahora: 1 });
  check("Online → despierta", r.estado === "despierta");

  // fallos: nunca lanza
  _reiniciarCache();
  r = await consultarEstadoBase({ env: ENV, fetchFn: crearFetch({ tokenOk: false }), ahora: 1 });
  check("secreto vencido / mal → desconocido, sin lanzar", r.estado === "desconocido" && r.motivo === "error");
  _reiniciarCache();
  r = await consultarEstadoBase({ env: ENV, fetchFn: crearFetch({ bdStatus: 403 }), ahora: 1 });
  check("sin permiso (403) → desconocido con motivo azure-403", r.estado === "desconocido" && r.motivo === "azure-403");
  _reiniciarCache();
  r = await consultarEstadoBase({ env: ENV, fetchFn: async () => { throw new Error("red caída"); }, ahora: 1 });
  check("red caída → desconocido, sin lanzar", r.estado === "desconocido");
  check("la respuesta nunca incluye el secreto", !JSON.stringify(r).includes("secreto-falso"));

  // falla de la métrica no tumba el estado
  _reiniciarCache();
  const g = crearFetch({ status: "Online" });
  const gm = async (u, o) => (u.includes("insights") ? respuesta(500, {}) : g(u, o));
  r = await consultarEstadoBase({ env: ENV, fetchFn: gm, ahora: 1 });
  check("métrica falla → estado sigue bien, cuota null", r.estado === "despierta" && r.cuotaSegundos === null);

  // diagnóstico de la cuota: el porqué sale en cuotaDiag y la agregación puede ser average
  _reiniciarCache();
  const h = crearFetch({ status: "Online" });
  r = await consultarEstadoBase({ env: ENV, fetchFn: async (u, o) => (u.includes("insights") ? { ok: false, status: 400, json: async () => ({ error: { code: "BadRequest" } }) } : h(u, o)), ahora: 1 });
  check("métrica con 400 → cuotaDiag explica", r.cuotaSegundos === null && /http 400/.test(r.cuotaDiag) && /BadRequest/.test(r.cuotaDiag));
  _reiniciarCache();
  r = await consultarEstadoBase({ env: ENV, fetchFn: async (u, o) => (u.includes("insights") ? { ok: true, status: 200, json: async () => ({ value: [{ name: { value: "free_amount_remaining" }, timeseries: [{ data: [{ average: 5000.4 }] }] }] }) } : h(u, o)), ahora: 1 });
  check("agregación average también sirve", r.cuotaSegundos === 5000 && r.cuotaDiag === undefined);
  _reiniciarCache();
  r = await consultarEstadoBase({ env: ENV, fetchFn: async (u, o) => (u.includes("insights") ? { ok: true, status: 200, json: async () => ({ value: [] }) } : h(u, o)), ahora: 1 });
  check("sin datos → cuotaDiag lo dice", r.cuotaSegundos === null && /sin datos/.test(r.cuotaDiag));

  // configuración real de la base (núcleos y pausa automática), leída de Azure
  _reiniciarCache();
  r = await consultarEstadoBase({ env: ENV, fetchFn: crearFetch({ status: "Online" }), ahora: 1 });
  check("devuelve núcleos mín/máx y minutos de pausa automática", r.config && r.config.nucleosMin === 0.5 && r.config.nucleosMax === 2 && r.config.pausaMin === 60);

  // base DORMIDA: las últimas horas vienen vacías, pero hay una lectura vieja → se usa la última que exista, con su fecha
  const AHORA = Date.parse("2026-10-16T18:00:00Z");
  const conSerie = (data) => async (u, o) => (u.includes("insights") ? respuesta(200, { value: [{ name: { value: "free_amount_remaining" }, timeseries: [{ data }] }] }) : crearFetch({ status: "Paused" })(u, o));
  _reiniciarCache();
  r = await consultarEstadoBase({ env: ENV, fetchFn: conSerie([{ timeStamp: "2026-10-12T05:00:00Z", minimum: 35298 }, { timeStamp: "2026-10-12T06:00:00Z" }, { timeStamp: "2026-10-16T17:00:00Z" }]), ahora: AHORA });
  check("base dormida: usa la ÚLTIMA lectura que exista (no se queda en 'sin datos')", r.estado === "dormida" && r.cuotaSegundos === 35298 && r.cuotaEn === "2026-10-12T05:00:00Z" && r.cuotaRenovada === false && r.cuotaDiag === undefined);
  _reiniciarCache();
  r = await consultarEstadoBase({ env: ENV, fetchFn: conSerie([{ timeStamp: "2026-09-28T05:00:00Z", minimum: 1200 }]), ahora: Date.parse("2026-10-02T09:00:00Z") });
  check("si la última lectura es de un mes anterior, la cuota ya se renovó (100 000)", r.cuotaSegundos === 100000 && r.cuotaRenovada === true);
  _reiniciarCache();
  r = await consultarEstadoBase({ env: ENV, fetchFn: conSerie([{ timeStamp: "2026-10-16T05:00:00Z" }]), ahora: AHORA });
  check("sin ninguna lectura en 31 días: cuota null y el motivo lo dice", r.cuotaSegundos === null && /31 días/.test(r.cuotaDiag));

  // costo estimado por pasarse de la cuota: segundos facturados del mes (app_cpu_billed, Total, desde el día 1 UTC)
  _reiniciarCache();
  f = crearFetch({ status: "Online", facturado: [60000, 55000] });
  r = await consultarEstadoBase({ env: ENV, fetchFn: f, ahora: Date.parse("2026-10-16T18:00:00Z") });
  check("suma los segundos facturados del mes (puntos sin dato cuentan 0)", r.facturadoSegundos === 115000);
  const urlFact = f.llamadas.find((c) => c.url.includes("app_cpu_billed")).url;
  check("pide la métrica con agregación Total desde el día 1 del mes (UTC)", /aggregation=Total/.test(urlFact) && decodeURIComponent(urlFact).includes("timespan=2026-10-01T00:00:00.000Z/"));
  let c = resumenCosto(115000);
  check("115 000 s facturados → 15 000 s de excedente × $0.000174 = $2.61", c.hayExcedente && c.excedenteSegundos === 15000 && c.costoUsd === 2.61 && c.excedenteHoras === 8.3, JSON.stringify(c));
  check("dentro de la cuota (o justo 100 000) → $0 y sin excedente", resumenCosto(35000).costoUsd === 0 && resumenCosto(35000).hayExcedente === false && resumenCosto(100000).hayExcedente === false);
  check("sin dato / basura → null (no inventa un costo)", resumenCosto(null) === null && resumenCosto(-5) === null && resumenCosto("x") === null);
  _reiniciarCache();
  f = crearFetch({ status: "Online" });
  const sinFact = async (u, o) => (u.includes("app_cpu_billed") ? respuesta(400, { error: { code: "BadRequest" } }) : f(u, o));
  r = await consultarEstadoBase({ env: ENV, fetchFn: sinFact, ahora: 1 });
  check("si Azure no devuelve la métrica facturada: facturadoSegundos null y el resto sigue bien", r.facturadoSegundos === null && r.estado === "despierta" && r.cuotaSegundos === 35143);
  _reiniciarCache();
  r = await consultarEstadoBase({ env: ENV, fetchFn: async (u, o) => (u.includes("app_cpu_billed") ? respuesta(200, { value: [{ timeseries: [{ data: [] }] }] }) : crearFetch({ status: "Paused" })(u, o)), ahora: 1 });
  check("mes sin actividad (métrica reconocida, sin puntos) → 0, no null", r.facturadoSegundos === 0);

  // resumen de la cuota gratis (Estado del sistema)
  let q = resumenCuota(35298);
  check("cuota 35 298 s → ok, 35 %, unas 19 h al mínimo, $0.31 por hora despierta", q.nivel === "ok" && q.porcentaje === 35 && q.horasAlMinimo === 19 && q.costoHoraDespiertaUsd === 0.31);
  check("cuota 20 000 s (20 %) → baja", resumenCuota(20000).nivel === "baja" && resumenCuota(20001).nivel === "ok");
  check("cuota 5 000 s (5 %) → crítica", resumenCuota(5000).nivel === "critica" && resumenCuota(5001).nivel === "baja");
  check("cuota 0 → crítica, 0 h", resumenCuota(0).nivel === "critica" && resumenCuota(0).horasAlMinimo === 0);
  check("sin dato / negativo / basura → null", resumenCuota(null) === null && resumenCuota(-1) === null && resumenCuota("x") === null && resumenCuota(NaN) === null);

  // la Function: protegida por ruta y devuelve el cuerpo
  const ctx = {};
  process.env.ESTADO_BD_TENANT_ID = "";
  await require("./getEstadoBase")(ctx);
  check("Function responde 200 con estado", ctx.res.status === 200 && ctx.res.body.estado === "desconocido");

  if (fallos) { console.log("\n" + fallos + " prueba(s) fallaron"); process.exit(1); }
  console.log("\ntest-estado-base: ok");
})().catch((e) => { console.error(e); process.exit(1); });
