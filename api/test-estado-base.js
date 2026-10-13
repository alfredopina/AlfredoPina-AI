// test-estado-base.js — estado de la base (dormida/despertando/despierta) vía Azure Resource Manager, sin red:
// fetch simulado. Verifica el mapeo de estados, que nunca lance, el caché del token y que jamás se toque SQL.
const assert = require("assert");
const { consultarEstadoBase, mapearEstado, leerConfiguracion, _reiniciarCache } = require("./src/estado-base");

let fallos = 0;
function check(nombre, cond) { if (cond) console.log("  ok  " + nombre); else { fallos++; console.log("  FALLA  " + nombre); } }

const RECURSO = "/subscriptions/56546bd8-e947-4ccc-8956-b2cb29e78859/resourceGroups/GR_AlfredoPina/providers/Microsoft.Sql/servers/apcweb-sql-server/databases/apcweb-backoffice";
const ENV = { ESTADO_BD_TENANT_ID: "t-id", ESTADO_BD_CLIENT_ID: "c-id", ESTADO_BD_CLIENT_SECRET: "secreto-falso", ESTADO_BD_RESOURCE_ID: RECURSO };

function respuesta(status, cuerpo) { return { ok: status >= 200 && status < 300, status, json: async () => cuerpo }; }

// fetch simulado: registra llamadas y responde según la URL
function crearFetch({ status = "Paused", tokenOk = true, bdStatus = 200, metrica = 35143 } = {}) {
  const llamadas = [];
  const f = async (url, opts) => {
    llamadas.push({ url, opts });
    if (url.includes("login.microsoftonline.com")) return tokenOk ? respuesta(200, { access_token: "tok", expires_in: 3599 }) : respuesta(401, {});
    if (url.includes("microsoft.insights/metrics")) return respuesta(200, { value: [{ timeseries: [{ data: [{ minimum: metrica + 5 }, { minimum: metrica }, {}] }] }] });
    if (url.includes("/databases/")) return bdStatus === 200 ? respuesta(200, { properties: { status } }) : respuesta(bdStatus, {});
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
  check("a los 11 min la cuota se vuelve a pedir", f.llamadas.filter((c) => c.url.includes("insights")).length === 2);

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

  // la Function: protegida por ruta y devuelve el cuerpo
  const ctx = {};
  process.env.ESTADO_BD_TENANT_ID = "";
  await require("./getEstadoBase")(ctx);
  check("Function responde 200 con estado", ctx.res.status === 200 && ctx.res.body.estado === "desconocido");

  if (fallos) { console.log("\n" + fallos + " prueba(s) fallaron"); process.exit(1); }
  console.log("\ntest-estado-base: ok");
})().catch((e) => { console.error(e); process.exit(1); });
