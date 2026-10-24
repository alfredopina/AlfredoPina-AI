// test-cotizacion-alternativas.js — cotizaciones alternativas (api/src/cotizacion-alternativas.js, alternativasCotizacion y las reglas
// nuevas de actualizarEstatusCotizacion), con una base falsa en memoria. Sin red.
const assert = require("assert");
const Module = require("module");

// ── base falsa: solo las filas de Cotizacion que necesitan estas reglas ──
let cot = [];
const log = [];
function ejecutar(texto, p) {
  log.push({ texto, p });
  const porId = (id) => cot.find((c) => c.id === id);
  if (/^SELECT id, cliente_id, cliente_final_id, estatus, alternativa_grupo FROM Cotizacion WHERE id/.test(texto)) return { recordset: porId(p.id) ? [{ ...porId(p.id) }] : [] };
  if (/^SELECT alternativa_grupo FROM Cotizacion WHERE id/.test(texto)) return { recordset: porId(p.id) ? [{ alternativa_grupo: porId(p.id).alternativa_grupo }] : [] };
  if (/SELECT COUNT\(\*\) AS n FROM Cotizacion h JOIN Cotizacion g/.test(texto)) {
    const g = porId(p.id);
    return { recordset: [{ n: cot.filter((h) => h.id !== p.id && g.alternativa_grupo != null && h.alternativa_grupo === g.alternativa_grupo && ["Borrador", "Enviada", "En negociación"].includes(h.estatus)).length }] };
  }
  if (/^UPDATE h SET estatus = 'Descartada'/.test(texto)) {
    const g = porId(p.id); let n = 0;
    cot.forEach((h) => { if (h.id !== p.id && g.alternativa_grupo != null && h.alternativa_grupo === g.alternativa_grupo && ["Borrador", "Enviada", "En negociación"].includes(h.estatus)) { h.estatus = "Descartada"; n++; } });
    return { recordset: [], rowsAffected: [n] };
  }
  if (/^UPDATE Cotizacion SET alternativa_grupo = NULL WHERE id = @id/.test(texto)) { porId(p.id).alternativa_grupo = null; return { recordset: [], rowsAffected: [1] }; }
  if (/^UPDATE Cotizacion SET alternativa_grupo = NULL WHERE alternativa_grupo = @g AND/.test(texto)) {
    const miembros = cot.filter((c) => c.alternativa_grupo === p.g);
    if (miembros.length === 1) miembros[0].alternativa_grupo = null;
    return { recordset: [], rowsAffected: [1] };
  }
  if (/^UPDATE Cotizacion SET alternativa_grupo = @g WHERE alternativa_grupo = @viejo/.test(texto)) { cot.forEach((c) => { if (c.alternativa_grupo === p.viejo) c.alternativa_grupo = p.g; }); return { recordset: [], rowsAffected: [1] }; }
  if (/^UPDATE Cotizacion SET alternativa_grupo = @g WHERE id IN/.test(texto)) { cot.forEach((c) => { if (c.id === p.a || c.id === p.b) c.alternativa_grupo = p.g; }); return { recordset: [], rowsAffected: [2] }; }
  if (/^UPDATE Cotizacion SET\s+fecha_estatus/.test(texto)) { const c = porId(p.id); if (!c) return { recordset: [], rowsAffected: [0] }; c.estatus = p.estatus; return { recordset: [], rowsAffected: [1] }; }
  return { recordset: [], rowsAffected: [0] };
}
function Req() { this.p = {}; }
Req.prototype.input = function (n, _t, v) { this.p[n] = v; return this; };
Req.prototype.query = async function (t) { return ejecutar(t.trim(), this.p); };
function Tx() {}
Tx.prototype.begin = async function () {}; Tx.prototype.commit = async function () {}; Tx.prototype.rollback = async function () {};
const fakeSql = { Int: 1, NVarChar: 1, Transaction: Tx, Request: Req };
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (/backoffice-db$/.test(req)) return { getPool: async () => ({ request: () => new Req() }), sql: fakeSql };
  if (/cobranza-db$/.test(req)) return { crearCuentaDeCotizacion: async () => ({ id: null }) };
  return origLoad.call(this, req, ...a);
};

const { representantes } = require("./src/cotizacion-alternativas");
const alternativas = require("./alternativasCotizacion");
const estatus = require("./actualizarEstatusCotizacion");
const llamar = async (fn, body) => { const ctx = { log: { error() {} }, res: null }; await fn(ctx, { body }); return ctx.res; };
const fila = (id, extra) => ({ id, cliente_id: 1, cliente_final_id: null, estatus: "Enviada", alternativa_grupo: null, precio_final: 1000, ...extra });

(async () => {
  // ── pipeline: una por grupo, la de monto más alto ──
  const r = representantes([fila(1, { alternativa_grupo: 1, precio_final: 8000 }), fila(2, { alternativa_grupo: 1, precio_final: 15200 }), fila(3, { precio_final: 500 }), fila(4, { alternativa_grupo: 9, precio_final: 300 }), fila(5, { alternativa_grupo: 9, precio_final: 300 })]);
  assert.deepStrictEqual(r.map((x) => x.id).sort(), [2, 3, 4], "una por grupo (monto más alto; empate = la más antigua) y las sueltas intactas");
  assert.strictEqual(r.reduce((a, c) => a + c.precio_final, 0), 15200 + 500 + 300);

  // ── vincular ──
  cot = [fila(10), fila(11)];
  let res = await llamar(alternativas, { accion: "vincular", id: 10, otro_id: 11 });
  assert.strictEqual(res.status, 200); assert.deepStrictEqual(cot.map((c) => c.alternativa_grupo), [10, 10], "el grupo es el id de la primera");
  cot = [fila(10), fila(11, { cliente_id: 2 })];
  assert.strictEqual((await llamar(alternativas, { accion: "vincular", id: 10, otro_id: 11 })).status, 400, "de otro cliente: no");
  cot = [fila(10), fila(11, { estatus: "Ganada" })];
  assert.strictEqual((await llamar(alternativas, { accion: "vincular", id: 10, otro_id: 11 })).status, 400, "cerrada: no");
  cot = [fila(10), fila(11)];
  assert.strictEqual((await llamar(alternativas, { accion: "vincular", id: 10, otro_id: 10 })).status, 400, "consigo misma: no");
  // una tercera se suma al grupo existente
  cot = [fila(10, { alternativa_grupo: 10 }), fila(11, { alternativa_grupo: 10 }), fila(12)];
  await llamar(alternativas, { accion: "vincular", id: 12, otro_id: 10 });
  assert.deepStrictEqual(cot.map((c) => c.alternativa_grupo), [10, 10, 10]);

  // ── desvincular: el grupo de una sola se libera ──
  cot = [fila(10, { alternativa_grupo: 10 }), fila(11, { alternativa_grupo: 10 })];
  await llamar(alternativas, { accion: "desvincular", id: 11 });
  assert.deepStrictEqual(cot.map((c) => c.alternativa_grupo), [null, null]);
  assert.strictEqual((await llamar(alternativas, { accion: "desvincular", id: 10 })).status, 400, "sin alternativas: 400");

  // ── estatus ──
  // ganar una descarta las demás abiertas (y no toca las ya cerradas)
  cot = [fila(10, { alternativa_grupo: 10 }), fila(11, { alternativa_grupo: 10, estatus: "En negociación" }), fila(12, { alternativa_grupo: 10, estatus: "Perdida" })];
  res = await llamar(estatus, { id: 10, estatus: "Ganada" });
  assert.strictEqual(res.status, 200); assert.strictEqual(res.body.descartadas, 1);
  assert.deepStrictEqual(cot.map((c) => c.estatus), ["Ganada", "Descartada", "Perdida"]);
  // Perdida con una alternativa abierta: se rechaza (se descarta)
  cot = [fila(10, { alternativa_grupo: 10 }), fila(11, { alternativa_grupo: 10 })];
  res = await llamar(estatus, { id: 10, estatus: "Perdida", motivo: "Precio alto" });
  assert.strictEqual(res.status, 400); assert.strictEqual(cot[0].estatus, "Enviada");
  // descartar a mano: solo dentro de un grupo
  res = await llamar(estatus, { id: 10, estatus: "Descartada" });
  assert.strictEqual(res.status, 200); assert.strictEqual(cot[0].estatus, "Descartada");
  // ya sin alternativas abiertas, la última sí puede perderse (una sola pérdida para la oportunidad)
  res = await llamar(estatus, { id: 11, estatus: "Perdida", motivo: "Precio alto" });
  assert.strictEqual(res.status, 200); assert.strictEqual(cot[1].estatus, "Perdida");
  cot = [fila(10)];
  assert.strictEqual((await llamar(estatus, { id: 10, estatus: "Descartada" })).status, 400, "sin alternativas no se descarta");
  assert.strictEqual((await llamar(estatus, { id: 10, estatus: "Perdida", motivo: "Precio alto" })).status, 200, "sin alternativas: Perdida normal");

  console.log("test-cotizacion-alternativas: ok");
})().catch((e) => { console.error(e); process.exit(1); });
