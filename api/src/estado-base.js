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

const cache = { token: null, venceEn: 0, metrica: null, metricaEn: 0 };

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

// Segundos de núcleo virtual gratis que quedan en el mes (métrica free_amount_remaining). Mejor esfuerzo: si falla, null.
async function leerCuota(cfg, token, fetchFn, ahora) {
  if (cache.metricaEn && ahora - cache.metricaEn < VIDA_METRICA_MS) return cache.metrica;
  cache.metricaEn = ahora; // también tras un fallo: no insistir en cada sondeo
  try {
    const url = `${ARM}${cfg.recurso}/providers/microsoft.insights/metrics?api-version=${API_METRICAS}&metricnames=free_amount_remaining&aggregation=Minimum&interval=PT1H&timespan=${encodeURIComponent(new Date(ahora - 3 * 3600000).toISOString() + "/" + new Date(ahora).toISOString())}`;
    const r = await fetchFn(url, { headers: { Authorization: "Bearer " + token } });
    if (!r.ok) { cache.metrica = null; return null; }
    const j = await r.json();
    const series = ((((j.value || [])[0] || {}).timeseries || [])[0] || {}).data || [];
    const ult = series.filter((d) => typeof d.minimum === "number").pop();
    cache.metrica = ult ? Math.round(ult.minimum) : null;
  } catch (e) { cache.metrica = null; }
  return cache.metrica;
}

// → { estado: dormida|despertando|despierta|desconocido, crudo, cuotaSegundos, motivo? } — nunca lanza
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
    const cuotaSegundos = await leerCuota(cfg, token, fetchFn, ahora);
    return { estado: mapearEstado(crudo), crudo, cuotaSegundos };
  } catch (err) {
    return { estado: "desconocido", crudo: null, cuotaSegundos: null, motivo: "error" };
  }
}

function _reiniciarCache() { cache.token = null; cache.venceEn = 0; cache.metrica = null; cache.metricaEn = 0; }

module.exports = { consultarEstadoBase, mapearEstado, leerConfiguracion, _reiniciarCache };
