// test-cliente-dependencias.js — el aviso de "no se puede eliminar" dice QUÉ cuelga (folio y estatus de la cotización, etc.),
// no solo cuántos, y avisa cuando la cotización es una versión anterior (oculta en el tablero). Base falsa, sin red.
const assert = require("assert");
const Module = require("module");

let respuestas = {};
const nuevaRequest = () => {
  const r = {
    input() { return r; },
    async query(t) {
      for (const [frag, rows] of Object.entries(respuestas)) if (t.includes(frag)) return { recordset: typeof rows === "function" ? rows(t) : rows };
      return { recordset: [{ n: 0 }] };
    },
  };
  return r;
};
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "../src/backoffice-db") return { getPool: async () => ({ request: nuevaRequest }), sql: { Int: "int", Transaction: function () {}, Request: function () {} } };
  return origLoad.call(this, req, ...a);
};

const eliminar = require("./eliminarCliente");
async function llamar() { const ctx = { log: { error() {} }, res: null }; await eliminar(ctx, { body: { id: 5 } }); return ctx.res; }

(async () => {
  respuestas = {
    "SELECT nombre FROM Cliente": [{ nombre: "Patito sa de cv" }],
    "COUNT(*) AS n FROM Cotizacion": [{ n: 1 }],
    "SELECT TOP 5 folio, estatus FROM Cotizacion": [{ folio: "AP26-PAT-EXCEL-01", estatus: "Reemplazada" }],
  };
  let r = await llamar();
  assert.strictEqual(r.status, 409);
  assert.ok(r.body.error.includes("1 Cotizaciones [AP26-PAT-EXCEL-01 (Reemplazada)]"), r.body.error);
  assert.ok(r.body.error.includes("Versiones anteriores"), "pista para ubicar una versión anterior");
  assert.deepStrictEqual(r.body.bloqueos, { Cotizaciones: 1 });

  // una cotización activa no lleva la pista de versiones
  respuestas["SELECT TOP 5 folio, estatus FROM Cotizacion"] = [{ folio: "AP26-PAT-EXCEL-02", estatus: "Borrador" }];
  r = await llamar();
  assert.ok(r.body.error.includes("AP26-PAT-EXCEL-02 (Borrador)") && !r.body.error.includes("Versiones anteriores"));

  // si el detalle falla, el aviso sigue diciendo cuántos
  respuestas["SELECT TOP 5 folio, estatus FROM Cotizacion"] = () => { throw new Error("falló"); };
  r = await llamar();
  assert.strictEqual(r.status, 409);
  assert.ok(r.body.error.includes("1 Cotizaciones.") || r.body.error.includes("1 Cotizaciones,") || r.body.error.includes("tiene 1 Cotizaciones"), r.body.error);

  console.log("test-cliente-dependencias: ok");
})().catch((e) => { console.error(e); process.exit(1); });
