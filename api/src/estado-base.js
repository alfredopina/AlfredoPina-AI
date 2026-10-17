// estado-base.js — ¿la base apcweb-backoffice está dormida, despertando o despierta?, SIN despertarla.
// Le pregunta a Azure Resource Manager (capa de administración, no SQL): un GET a la base devuelve `properties.status`.
// Las Functions de este hosting no tienen identidad administrada, así que se usa una app de Entra de solo lectura
// (rol Lector sobre el servidor) con client_credentials. Settings (los pega Alfredo en la Static Web App):
//   ESTADO_BD_TENANT_ID, ESTADO_BD_CLIENT_ID, ESTADO_BD_CLIENT_SECRET, ESTADO_BD_RESOURCE_ID
// El secreto caduca (máx. 24 meses): si vence, el ícono cae a "desconocido" y la base sigue funcionando igual.
const ARM = "https://management.azure.com";
const API_BD = "2021-11-01";
const API_METRICAS = "2018-01-01";
const VIDA_METRICA_MS = 10 * 60 * 1000; // la cuota gratis cambia lento: no se pide en cada sondeo

// Estados de ARM → los tres del ícono (+ "desconocido": se queda el rayo de siempre)
const DORMIDA = ["Paused", "Pausing"];
const DESPIERTA = ["Online"];
const DESPERTANDO = ["Resuming", "Creating", "Restoring", "Scaling", "Starting", "Recovering"];

function mapearEstado(status) {
  if (DORMIDA.includes(status)) return "dormida";
  if (DESPIERTA.includes(status)) return "despierta";
  if (DESPERTANDO.includes(status)) return "despertando";
  return "desconocido";
}

function leerConfiguracion(env) {
  const c = {
    tenant: (env.ESTADO_BD_TENANT_ID || "").trim(),
    cliente: (env.ESTADO_BD_CLIENT_ID || "").trim(),
    secreto: (env.ESTADO_BD_CLIENT_SECRET || "").trim(),
    recurso: (env.ESTADO_BD_RESOURCE_ID || "").trim().replace(/\/+$/, ""),
  };
  return c.tenant && c.cliente && c.secreto && /^\/subscriptions\/[^/]+\/resourceGroups\/[^/]+\/providers\/Microsoft\.Sql\/servers\/[^/]+\/databases\/[^/]+$/i.test(c.recurso) ? c : null;
}

const cache = { token: null, venceEn: 0, metrica: null, metricaEn: 0, diag: null, facturado: null, facturadoEn: 0 };

async function obtenerToken(cfg, fetchFn, ahora) {
  if (cache.token && ahora < cache.venceEn - 60000) return cache.token;
  const r = await fetchFn(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: cfg.cliente, client_secret: cfg.secreto, scope: ARM + "/.default" }).toString(),
  });
  if (!r.ok) throw new Error("token " + r.status);
  const j = await r.json();
  cache.token = j.access_token;
  cache.venceEn = ahora + (Number(j.expires_in) || 3000) * 1000;
  return cache.token;
}

// Segundos de núcleo virtual gratis que quedan en el mes (métrica free_amount_remaining). Mejor esfuerzo: si falla, null
// y cache.diag guarda el porqué (sale en la respuesta como cuotaDiag para poder diagnosticarlo sin herramientas).
// Sin "aggregation": Azure usa la agregación propia de la métrica; se toma el primer valor numérico que venga.
// La métrica SOLO se publica mientras la base está despierta: con la base dormida las últimas 24 h vienen vacías. Por eso se mira
// 31 días hacia atrás y se toma la ÚLTIMA lectura que exista (dormida no consume: esa lectura sigue siendo la cuota vigente), con su
// fecha para poder decir "lectura de hace N h". Devuelve { valor, en } o null.
async function leerCuota(cfg, token, fetchFn, ahora) {
  if (cache.metricaEn && ahora - cache.metricaEn < VIDA_METRICA_MS) return cache.metrica;
  cache.metricaEn = ahora; // también tras un fallo: no insistir en cada sondeo
  cache.diag = null;
  try {
    const url = `${ARM}${cfg.recurso}/providers/microsoft.insights/metrics?api-version=${API_METRICAS}&metricnames=free_amount_remaining&interval=PT1H&timespan=${encodeURIComponent(new Date(ahora - 31 * 24 * 3600000).toISOString() + "/" + new Date(ahora).toISOString())}`;
    const r = await fetchFn(url, { headers: { Authorization: "Bearer " + token } });
    if (!r.ok) {
      let cuerpo = "";
      try { cuerpo = JSON.stringify(await r.json()).slice(0, 300); } catch (e) { /* sin cuerpo */ }
      cache.metrica = null; cache.diag = "http " + r.status + " " + cuerpo;
      return null;
    }
    const j = await r.json();
    const serie = ((((j.value || [])[0] || {}).timeseries || [])[0] || {}).data || [];
    const valor = (d) => [d.average, d.minimum, d.maximum, d.total].find((v) => typeof v === "number");
    const ult = serie.filter((d) => valor(d) !== undefined).pop();
    cache.metrica = ult ? { valor: Math.round(valor(ult)), en: ult.timeStamp || null } : null;
    if (!ult) cache.diag = "sin datos en 31 días: " + ((j.value || []).length) + " métrica(s), " + serie.length + " punto(s)" + (j.value && j.value[0] ? ", nombre " + JSON.stringify((j.value[0].name || {}).value) : "");
  } catch (e) { cache.metrica = null; cache.diag = "error " + e.message; }
  return cache.metrica;
}

// Segundos de núcleo virtual FACTURADOS en lo que va del mes (métrica app_cpu_billed, agregación Total). A diferencia de la cuota
// restante, esta sigue sumando cuando la cuota gratis ya se acabó: con ella se estima cuánto se ha pasado (ver resumenCosto). El mes
// de facturación de Azure es UTC, así que se suma desde el día 1 a las 00:00 UTC. Mejor esfuerzo: si Azure no la devuelve (error, o la app
// de Entra no la puede leer) → null y la pantalla dice "sin datos"; un mes sin puntos con la métrica reconocida vale 0.
async function leerFacturado(cfg, token, fetchFn, ahora) {
  if (cache.facturadoEn && ahora - cache.facturadoEn < VIDA_METRICA_MS) return cache.facturado;
  cache.facturadoEn = ahora;
  try {
    const d = new Date(ahora);
    const inicioMes = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const url = `${ARM}${cfg.recurso}/providers/microsoft.insights/metrics?api-version=${API_METRICAS}&metricnames=app_cpu_billed&aggregation=Total&interval=PT1H&timespan=${encodeURIComponent(new Date(inicioMes).toISOString() + "/" + new Date(ahora).toISOString())}`;
    const r = await fetchFn(url, { headers: { Authorization: "Bearer " + token } });
    if (!r.ok) { cache.facturado = null; return null; }
    const j = await r.json();
    if (!(j.value || [])[0]) { cache.facturado = null; return null; }
    const serie = ((((j.value || [])[0] || {}).timeseries || [])[0] || {}).data || [];
    cache.facturado = Math.round(serie.reduce((t, p) => t + (typeof p.total === "number" ? p.total : 0), 0));
  } catch (e) { cache.facturado = null; }
  return cache.facturado;
}

// → { estado: dormida|despertando|despierta|desconocido, crudo, cuotaSegundos, cuotaDiag?, motivo? } — nunca lanza
async function consultarEstadoBase({ env = process.env, fetchFn = fetch, ahora = Date.now() } = {}) {
  const cfg = leerConfiguracion(env);
  if (!cfg) return { estado: "desconocido", crudo: null, cuotaSegundos: null, motivo: "sin-configurar" };
  try {
    let token = await obtenerToken(cfg, fetchFn, ahora);
    let r = await fetchFn(`${ARM}${cfg.recurso}?api-version=${API_BD}`, { headers: { Authorization: "Bearer " + token } });
    if (r.status === 401) { // token revocado antes de vencer: se pide uno nuevo una vez
      cache.token = null;
      token = await obtenerToken(cfg, fetchFn, ahora);
      r = await fetchFn(`${ARM}${cfg.recurso}?api-version=${API_BD}`, { headers: { Authorization: "Bearer " + token } });
    }
    if (!r.ok) return { estado: "desconocido", crudo: null, cuotaSegundos: null, motivo: "azure-" + r.status };
    const j = await r.json();
    const crudo = (j.properties && j.properties.status) || null;
    const lectura = await leerCuota(cfg, token, fetchFn, ahora);
    const facturadoSegundos = await leerFacturado(cfg, token, fetchFn, ahora);
    let cuotaSegundos = lectura ? lectura.valor : null;
    // el día 1 (UTC) la cuota se renueva: si la última lectura es de un mes anterior, desde entonces la base no ha trabajado → vale la cuota completa
    const delMesActual = (iso) => iso && new Date(iso).getUTCFullYear() === new Date(ahora).getUTCFullYear() && new Date(iso).getUTCMonth() === new Date(ahora).getUTCMonth();
    const cuotaRenovada = Boolean(lectura && lectura.en && !delMesActual(lectura.en));
    if (cuotaRenovada) cuotaSegundos = CUOTA_MENSUAL_S;
    // configuración real de la base (lo que el portal muestra en "Proceso y almacenamiento"): núcleos mínimo/máximo y pausa automática
    const p = j.properties || {};
    const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
    const config = { nucleosMin: num(p.minCapacity), nucleosMax: num(j.sku && j.sku.capacity), pausaMin: num(p.autoPauseDelay) };
    const resp = { estado: mapearEstado(crudo), crudo, cuotaSegundos, cuotaEn: lectura ? lectura.en : null, cuotaRenovada, facturadoSegundos, config };
    if (cuotaSegundos === null && cache.diag) resp.cuotaDiag = cache.diag;
    return resp;
  } catch (err) {
    return { estado: "desconocido", crudo: null, cuotaSegundos: null, motivo: "error" };
  }
}

// Cuota gratis mensual de la base (oferta "Free database offer": 100 000 vCore-segundos al mes). Con "Continue using database for
// additional charges" (irreversible), al agotarla la base sigue y se cobra: el portal marca $0.000174 por vCore-segundo. Al mínimo de
// 0.5 núcleos, una hora despierta gasta 1 800 vCore-s ≈ $0.31. Niveles: baja ≤ 20 % (20 000 s) · crítica ≤ 5 % (5 000 s).
const CUOTA_MENSUAL_S = 100000;
const VCORES_MINIMOS = 0.5;
const PRECIO_VCORE_S = 0.000174;
function resumenCuota(restanteSeg) {
  if (typeof restanteSeg !== "number" || !isFinite(restanteSeg) || restanteSeg < 0) return null;
  const nivel = restanteSeg <= CUOTA_MENSUAL_S * 0.05 ? "critica" : restanteSeg <= CUOTA_MENSUAL_S * 0.2 ? "baja" : "ok";
  return {
    restante: Math.round(restanteSeg), total: CUOTA_MENSUAL_S, porcentaje: Math.min(100, Math.round((restanteSeg / CUOTA_MENSUAL_S) * 100)), nivel,
    horasAlMinimo: Math.floor(restanteSeg / (VCORES_MINIMOS * 3600)), costoHoraDespiertaUsd: Math.round(VCORES_MINIMOS * 3600 * PRECIO_VCORE_S * 100) / 100,
  };
}

// Estimación de lo que se lleva pagado en el mes por pasarse de la cuota gratis: (facturado − 100 000 s) × precio por vCore-segundo.
// Es una APROXIMACIÓN del cómputo de la base (sin almacenamiento ni otros servicios, y Azure publica con unos minutos de retraso):
// la cifra real es la de Azure Cost Management. Sin dato de Azure → null (la pantalla dice "sin datos", no inventa un número).
function resumenCosto(facturadoSeg) {
  if (typeof facturadoSeg !== "number" || !isFinite(facturadoSeg) || facturadoSeg < 0) return null;
  const excedente = Math.max(0, facturadoSeg - CUOTA_MENSUAL_S);
  return { facturado: Math.round(facturadoSeg), excedenteSegundos: Math.round(excedente), excedenteHoras: Math.round((excedente / (VCORES_MINIMOS * 3600)) * 10) / 10, costoUsd: Math.round(excedente * PRECIO_VCORE_S * 100) / 100, hayExcedente: excedente > 0 };
}

function _reiniciarCache() { cache.token = null; cache.venceEn = 0; cache.metrica = null; cache.metricaEn = 0; cache.diag = null; cache.facturado = null; cache.facturadoEn = 0; }

module.exports = { consultarEstadoBase, mapearEstado, leerConfiguracion, resumenCuota, resumenCosto, _reiniciarCache };
