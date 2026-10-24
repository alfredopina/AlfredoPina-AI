// test-alertas-cobranza.js — la Function REAL getNotificacionesActivas con la base y los módulos de alrededor simulados: Cobranza debe
// aparecer (vencidas, por vencer y por facturar sin facturar) y nada más debe romperse. Existe porque una vez la Function regresó 500 al
// desestructurar una señal que nadie le pasaba. Datos ficticios.
const Module = require("module");
const assert = require("assert");

const hoy = Date.now();
const iso = (diasAtras) => new Date(hoy - diasAtras * 86400000).toISOString();
const cuentas = [
  { id: 1, cliente: "Zeta SA", concepto: "Curso A", folio_factura: "201", estatus: "Facturada", semaforo: { clave: "vencida", dias: 12 }, fecha_creacion: iso(40) },
  { id: 2, cliente: "Beta SA", concepto: "Curso B", folio_factura: null, estatus: "Facturada", semaforo: { clave: "por_vencer", dias: 3 }, fecha_creacion: iso(20) },
  { id: 3, cliente: "Gamma SA", concepto: "Grupo C", estatus: "Por facturar", semaforo: { clave: "sin_plazo", dias: null }, fecha_creacion: iso(5) },
  { id: 4, cliente: "Delta SA", concepto: "Grupo D", estatus: "Por facturar", semaforo: { clave: "sin_plazo", dias: null }, fecha_creacion: iso(1) },
  { id: 5, cliente: "Eps SA", concepto: "Curso E", estatus: "Pagada", semaforo: { clave: "cerrada", dias: null }, fecha_creacion: iso(90) },
];
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (/\/backoffice-db$/.test(req)) {
    return { sql: { Int: "int" }, getPool: async () => ({ request: () => { const q = { input() { return q; }, query: async () => ({ recordset: [] }) }; return q; } }) };
  }
  if (/\/notificaciones-config$/.test(req)) return { getUmbrales: async () => ({ solicitudesHoras: 72, cotizacionesDias: 10, gruposDias: 21, clientesDias: 90, cobranzaPorVencerDias: 7, cobranzaPorFacturarDias: 3 }) };
  if (/\/solicitud-publica-cola$/.test(req)) return { drenarConSql: async () => {} };
  if (/\/propuestas$/.test(req)) return { getPropuestasTable: () => ({}), listarEstadisticas: async () => ({}), codigoDePropuesta: () => null };
  if (/\/cobranza-db$/.test(req)) return { listarCuentas: async () => cuentas };
  return origLoad.call(this, req, ...a);
};

(async () => {
  const fn = require("./getNotificacionesActivas/index.js");
  const context = { log: { error: (...x) => console.log("  (log)", ...x) } };
  await fn(context, { query: {} });
  assert.strictEqual(context.res.status, 200, JSON.stringify(context.res.body));
  const cb = context.res.body.grupos.cobranza;
  assert.ok(Array.isArray(cb), "la sección cobranza existe");
  const por = (id) => cb.filter((x) => x.id === id);
  assert.strictEqual(por(1)[0].pastilla, "vencido 12 d");
  assert.strictEqual(por(1)[0].urgente, true);
  assert.strictEqual(por(2)[0].pastilla, "vence en 3 d");
  assert.strictEqual(por(3)[0].pastilla, "sin facturar 5 d", "Por facturar con 5 días (umbral 3) alerta");
  assert.strictEqual(por(4).length, 0, "Por facturar con 1 día no alerta todavía");
  assert.strictEqual(por(5).length, 0, "una cuenta pagada no alerta");
  assert.strictEqual(cb.length, 3);
  assert.strictEqual(context.res.body.total, 3, "el total de la campana incluye Cobranza");
  console.log("test-alertas-cobranza: ok");
})().catch((e) => { console.error("FALLA", e.message); process.exit(1); });
