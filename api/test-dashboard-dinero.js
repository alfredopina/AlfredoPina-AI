// test-dashboard-dinero.js — cálculo del Dashboard → Resumen de dinero (api/src/dashboard-dinero.js): montos SIN IVA, flujo del mes,
// stocks reconstruidos, comparaciones, serie y meta. Datos ficticios; sin SQL ni red.
const assert = require("assert");
const { calcularDinero, enSubtotal } = require("./src/dashboard-dinero");

let fallos = 0;
const check = (n, fn) => { try { fn(); console.log("  OK " + n); } catch (e) { console.log("  FALLA " + n + " → " + e.message); fallos++; } };
const ms = (s) => Date.parse(s + "T06:00:00Z"); // "2026-10-05" = medianoche de Monterrey
const AHORA = new Date("2026-10-28T18:00:00Z");
const cuenta = (o) => ({ estrategia: "empresas", tipo_factura: "Empresa", estatus: "Facturada", subtotal: 1000, total: 1160, emision: null, creada: ms("2026-01-01"), vencimiento: null, tipo: "Directo", herrs: ["excel"], pagos: [], ...o });
const pago = (fecha, monto) => ({ fecha, creada: ms(fecha), monto, anulado: false });
const cot = (o) => ({ id: 0, estatus: "Enviada", precio: 0, alt: null, herr: "excel", creada: ms("2026-01-01"), enviada: ms("2026-01-01"), cierre: null, cierreReal: null, motivo: null, tipo: "Directo", ...o });
const datos = () => ({
  cuentas: [
    cuenta({ subtotal: 1000, total: 1160, emision: "2026-08-20", creada: ms("2026-08-20"), vencimiento: "2026-09-19", pagos: [pago("2026-09-10", 1160)], estatus: "Pagada" }),
    cuenta({ subtotal: 2000, total: 2320, emision: "2026-09-05", creada: ms("2026-09-05"), vencimiento: "2026-10-05", pagos: [pago("2026-10-05", 2320)], estatus: "Pagada" }),
    cuenta({ subtotal: 3000, total: 3480, emision: "2026-09-10", creada: ms("2026-09-10"), vencimiento: "2026-10-10", herrs: ["powerbi"] }),
    cuenta({ subtotal: 500, total: 580, estatus: "Por facturar", emision: null, creada: ms("2026-10-15") }),
    cuenta({ subtotal: 9999, total: 11599, estatus: "Cancelada", emision: "2026-09-01", creada: ms("2026-09-01") }),
    cuenta({ subtotal: 7777, total: 9000, tipo_factura: "Otro", estrategia: null, emision: "2026-09-02", creada: ms("2026-09-02"), vencimiento: "2026-09-30" }),
    cuenta({ subtotal: 400, total: 464, emision: "2026-10-01", creada: ms("2026-10-01"), vencimiento: "2026-10-31", herrs: [] }),
  ],
  cotizaciones: [
    cot({ id: 1, estatus: "Ganada", precio: 10000, enviada: ms("2026-08-25"), cierre: ms("2026-09-12") }),
    cot({ id: 2, estatus: "Perdida", precio: 4000, enviada: ms("2026-09-01"), cierre: ms("2026-09-20"), motivo: "Precio alto" }),
    cot({ id: 3, estatus: "Ganada", precio: 6000, herr: "powerbi", tipo: "Intermediario", enviada: ms("2026-09-25"), cierre: ms("2026-10-08") }),
    cot({ id: 4, precio: 8000, alt: 7, enviada: ms("2026-10-10") }),
    cot({ id: 5, precio: 9000, alt: 7, enviada: ms("2026-10-10") }),
    cot({ id: 6, estatus: "Borrador", precio: 1000, enviada: ms("2026-10-11") }),
    cot({ id: 8, estatus: "Descartada", precio: 5000, enviada: ms("2026-10-12"), cierre: ms("2026-10-20") }),
    cot({ id: 9, estatus: "Reemplazada", precio: 7000, enviada: ms("2026-10-09"), cierre: ms("2026-10-09") }),
  ],
});
const calc = (f) => calcularDinero(datos(), f || {}, { ahora: AHORA });

check("subtotal: el pago se escala por subtotal/total y la cuenta pagada queda sin saldo", () => {
  const c = enSubtotal(datos().cuentas)[0];
  assert.strictEqual(c.total, 1000); assert.strictEqual(Math.round(c.pagos[0].monto * 100) / 100, 1000);
});
const r = calc();
const v = (k) => r.filas[k];
check("octubre (hasta el 28): flujo del mes sin IVA", () => {
  assert.strictEqual(v("cot").cur, 14000); // 9000 (alternativas: una vez, la mayor) + 5000 descartada; sin Borrador ni Reemplazada
  assert.strictEqual(v("gan").cur, 6000); assert.strictEqual(v("per").cur, 0);
  assert.strictEqual(v("fac").cur, 400); assert.strictEqual(v("cob").cur, 2000);
});
check("octubre: lo abierto hoy (pipeline, por facturar, por cobrar, plazo, vencido)", () => {
  assert.strictEqual(v("pip").cur, 9000); assert.strictEqual(v("gpf").cur, 500);
  assert.strictEqual(v("pxc").cur, 3400); assert.strictEqual(v("ven").cur, 3000); assert.strictEqual(v("plz").cur, 400);
  assert.strictEqual(v("plz").cur, v("pxc").cur - v("ven").cur);
});
check("las cuentas canceladas y las de terceros no cuentan", () => { assert.strictEqual(v("fac").cur, 400); assert.strictEqual(v("pxc").cur, 3400); });
check("comparación contra el mes anterior, al mismo corte (sep hasta el 28)", () => {
  assert.strictEqual(v("cot").ref.mes, 10000); assert.strictEqual(v("gan").ref.mes, 10000); assert.strictEqual(v("per").ref.mes, 4000);
  assert.strictEqual(v("fac").ref.mes, 5000); assert.strictEqual(v("cob").ref.mes, 1000);
  assert.strictEqual(v("pxc").ref.mes, 5000); assert.strictEqual(v("ven").ref.mes, 0); assert.strictEqual(v("gpf").ref.mes, 0);
  assert.strictEqual(v("pip").ref.mes, 6000); // la cotización 3 aún estaba abierta el 28 de septiembre
});
check("promedio de 3 meses: usa solo los meses con historia (sep y ago); año pasado sin datos", () => {
  assert.strictEqual(v("cot").ref.p3, 10000);
  assert.strictEqual(v("cot").ref.anio, null); assert.strictEqual(r.meta.refs.mes, "sep");
});
check("serie de 12 meses (vacía antes del primer dato) y meta = promedio de la serie", () => {
  assert.strictEqual(v("cot").serie.length, 12);
  assert.strictEqual(v("cot").serie.filter((s) => s.v != null).length, 3); // ago, sep, oct
  assert.strictEqual(v("cot").serie[11].mes, "2026-10"); assert.strictEqual(v("cot").serie[11].v, 14000);
  assert.strictEqual(v("cot").meta, 11333.33);
});
check("filtro Power BI: solo lo que lleva esa herramienta, y avisa de las cuentas manuales", () => {
  const p = calc({ herramienta: "powerbi" });
  assert.strictEqual(p.filas.cot.cur, 0); assert.strictEqual(p.filas.gan.cur, 6000); assert.strictEqual(p.filas.pxc.cur, 3000); assert.strictEqual(p.filas.ven.cur, 3000); assert.strictEqual(p.filas.fac.cur, 0);
  assert.ok(p.meta.notas.some((n) => /manuales/.test(n)));
});
check("tipo de cliente filtra cotizaciones y cuentas", () => {
  const p = calc({ tipoCliente: "Intermediario" });
  assert.strictEqual(p.filas.gan.cur, 6000); assert.strictEqual(p.filas.cot.cur, 0); assert.strictEqual(p.filas.pxc.cur, 0);
});
check("estrategia: solo filtra Cobranza y avisa qué queda sin filtrar", () => {
  const p = calc({ estrategia: "abiertos" });
  assert.strictEqual(p.filas.cot.cur, 14000); assert.strictEqual(p.filas.fac.cur, 0); assert.strictEqual(p.filas.pxc.cur, 0);
  assert.deepStrictEqual(p.meta.sinFiltrar.slice().sort(), ["cot", "gan", "per", "pip", "sol"]); assert.ok(p.meta.notas.length >= 1);
});
check("mes pasado (septiembre completo): flujo, comparación y motivos de pérdida", () => {
  const p = calc({ mes: "2026-09" });
  assert.strictEqual(p.meta.esActual, false); assert.strictEqual(p.meta.corteDia, null);
  assert.strictEqual(p.filas.cot.cur, 10000); assert.strictEqual(p.filas.per.cur, 4000); assert.strictEqual(p.filas.gan.cur, 10000);
  assert.deepStrictEqual(p.motivos, [{ motivo: "Precio alto", monto: 4000, pct: 100 }]);
  assert.strictEqual(p.filas.cot.ref.mes, 10000); // agosto completo
});
check("«Todo el historial»: acumulado sin serie ni comparación", () => {
  const p = calc({ mes: "todo" });
  assert.strictEqual(p.meta.todo, true); assert.strictEqual(p.filas.cob.cur, 3000); // pagos de 1000 + 2000
  assert.deepStrictEqual(p.filas.cot.serie, []); assert.strictEqual(p.filas.cot.ref.mes, null); assert.strictEqual(p.filas.cot.meta, null);
  assert.strictEqual(p.filas.pxc.cur, 3400);
});
check("lista de meses para el selector, del actual hacia atrás hasta el primer dato", () => {
  assert.strictEqual(r.meta.meses[0].valor, "2026-10"); assert.strictEqual(r.meta.meses[r.meta.meses.length - 1].valor, "2026-08");
});
check("sin datos no truena", () => {
  const p = calcularDinero({ cuentas: [], cotizaciones: [] }, {}, { ahora: AHORA });
  assert.strictEqual(p.filas.cot.cur, 0); assert.strictEqual(p.filas.pxc.cur, 0); assert.deepStrictEqual(p.motivos, []);
});
check("metas propias (Configuración → Metas): reemplazan al promedio solo en Cotizado, Ganado y Cobrado", () => {
  const p = calcularDinero(datos(), {}, { ahora: AHORA, metas: { cot: 20000, gan: null, cob: 0 } });
  assert.strictEqual(p.filas.cot.meta, 20000); assert.strictEqual(p.filas.cot.metaOrigen, "propia");
  assert.strictEqual(p.filas.cob.meta, 0); assert.strictEqual(p.filas.cob.metaOrigen, "propia"); // 0 es una meta válida
  assert.strictEqual(p.filas.gan.metaOrigen, "promedio"); assert.strictEqual(p.filas.gan.meta, r.filas.gan.meta);
  assert.strictEqual(p.filas.fac.metaOrigen, "promedio"); assert.strictEqual(p.filas.fac.meta, r.filas.fac.meta);
  assert.strictEqual(r.filas.cot.metaOrigen, "promedio"); // sin metas todo queda como antes
});
check("meta propia sin 3 meses de historia sí existe; 'todo el historial' no lleva meta", () => {
  const p = calcularDinero({ cuentas: [], cotizaciones: [] }, {}, { ahora: AHORA, metas: { cot: 5000 } });
  assert.strictEqual(p.filas.cot.meta, 5000);
  const t = calcularDinero(datos(), { mes: "todo" }, { ahora: AHORA, metas: { cot: 5000 } });
  assert.strictEqual(t.filas.cot.meta, null);
});
// ── desgloses del embudo (barras apiladas): cada barra se reparte en dónde está hoy ese dinero y la suma da el total ──
const sol = (o) => ({ herr: "excel", canal: "Sitio", estatus: "Nueva", creada: ms("2026-10-02"), tipo: "Directo", ...o });
const datosEmb = () => ({
  cuentas: [
    cuenta({ subtotal: 1000, total: 1160, emision: "2026-10-05", creada: ms("2026-10-05"), vencimiento: "2026-10-20", pagos: [pago("2026-10-10", 580)], cotId: 20 }), // cobró la mitad; el resto ya venció
    cuenta({ subtotal: 2000, total: 2320, emision: "2026-10-06", creada: ms("2026-10-06"), vencimiento: "2026-11-20", cotId: 21 }), // en plazo
    cuenta({ subtotal: 800, total: 928, emision: "2026-09-01", creada: ms("2026-09-01"), vencimiento: "2026-09-30", pagos: [pago("2026-10-12", 928)], estatus: "Pagada" }), // factura de septiembre cobrada en octubre
  ],
  cotizaciones: [
    cot({ id: 20, estatus: "Ganada", precio: 1000, enviada: ms("2026-10-01"), cierre: ms("2026-10-05") }),
    cot({ id: 21, estatus: "Ganada", precio: 2000, enviada: ms("2026-10-01"), cierre: ms("2026-10-06") }),
    cot({ id: 22, estatus: "Ganada", precio: 700, enviada: ms("2026-10-01"), cierre: ms("2026-10-07") }), // sin cuenta: Por facturar
    cot({ id: 23, estatus: "Enviada", precio: 3000, enviada: ms("2026-10-02") }),
    cot({ id: 24, estatus: "Perdida", precio: 500, enviada: ms("2026-10-03"), cierre: ms("2026-10-09"), motivo: "Precio alto" }),
    cot({ id: 25, estatus: "Descartada", precio: 4000, alt: 9, enviada: ms("2026-10-04") }), // alternativas: una sola oportunidad, ganada
    cot({ id: 26, estatus: "Ganada", precio: 3500, alt: 9, enviada: ms("2026-10-04"), cierre: ms("2026-10-12") }),
    cot({ id: 27, estatus: "Expirada", precio: 900, enviada: ms("2026-10-05") }),
  ],
  solicitudes: [sol({}), sol({ estatus: "Cotizada" }), sol({ estatus: "Cotizada", canal: "Manual" }), sol({ creada: ms("2026-09-15"), estatus: "Cotizada" })],
});
const emb = calcularDinero(datosEmb(), {}, { ahora: AHORA });
check("solicitudes: cantidad del mes y cuántas están atendidas (ya no son Nueva)", () => {
  assert.strictEqual(emb.filas.sol.cur, 3); assert.strictEqual(emb.filas.sol.ref.mes, 1);
  assert.deepStrictEqual(emb.desglose.sol, { atendidas: 2, sin: 1 });
});
check("Cotizado se reparte en abierto / ganado / perdido / otro y la suma es el total (alternativas = una oportunidad)", () => {
  assert.deepStrictEqual(emb.desglose.cot, { abierto: 3000, ganado: 7700, perdido: 500, otro: 900 });
  const s = Object.values(emb.desglose.cot).reduce((x, y) => x + y, 0);
  assert.strictEqual(s, emb.filas.cot.cur); assert.strictEqual(s, 12100);
  assert.deepStrictEqual(emb.desglose.motivosPerdido.map((m) => m.motivo), ["Precio alto"]);
});
check("Ganado (cerrado en el mes) = ya facturado + por facturar, según la cuenta ligada a su cotización", () => {
  assert.deepStrictEqual(emb.desglose.gan, { facturado: 3000, porFacturar: 4200 });
  assert.strictEqual(emb.desglose.gan.facturado + emb.desglose.gan.porFacturar, emb.filas.gan.cur);
});
check("Facturado se reparte en cobrado / en plazo / vencido y la suma es el total (sin IVA)", () => {
  assert.deepStrictEqual(emb.desglose.fac, { cobrado: 500, plazo: 2000, vencido: 500 });
  assert.strictEqual(emb.desglose.fac.cobrado + emb.desglose.fac.plazo + emb.desglose.fac.vencido, emb.filas.fac.cur);
});
check("Cobrado = de facturas de este mes + de meses anteriores, y suma el cobrado del periodo", () => {
  assert.strictEqual(emb.filas.cob.cur, 1300); assert.deepStrictEqual(emb.desglose.cob, { delMes: 500, anteriores: 800 });
});
check("meta propia de Solicitudes (cantidad) y «todo el historial» sin desglose de Cobrado", () => {
  const p = calcularDinero(datosEmb(), {}, { ahora: AHORA, metas: { sol: 15 } });
  assert.strictEqual(p.filas.sol.meta, 15); assert.strictEqual(p.filas.sol.metaOrigen, "propia");
  const t = calcularDinero(datosEmb(), { mes: "todo" }, { ahora: AHORA });
  assert.strictEqual(t.desglose.cob, null); assert.strictEqual(t.desglose.sol.atendidas + t.desglose.sol.sin, 4);
});
check("sin solicitudes cargadas no truena (cantidad 0)", () => {
  const p = calcularDinero({ cuentas: [], cotizaciones: [] }, {}, { ahora: AHORA });
  assert.strictEqual(p.filas.sol.cur, 0); assert.deepStrictEqual(p.desglose.sol, { atendidas: 0, sin: 0 });
});
(async () => {
  try {
    const { getMetas, guardarMetas } = require("./src/metas");
    const antes = process.env.RECURSOS_STORAGE_CONNECTION; delete process.env.RECURSOS_STORAGE_CONNECTION;
    try {
      assert.deepStrictEqual(await getMetas(), { sol: null, cot: null, gan: null, cob: null });
      for (const malo of [{ cot: -1 }, { gan: "abc" }, { cob: 1e12 }, { sol: -3 }]) await assert.rejects(() => guardarMetas(malo), /meta/i);
      await assert.rejects(() => guardarMetas({ cot: 100 }), /RECURSOS_STORAGE_CONNECTION/); // valores buenos llegan hasta el Storage
    } finally { if (antes !== undefined) process.env.RECURSOS_STORAGE_CONNECTION = antes; }
    console.log("  OK metas.js: valida montos y sin Storage configurado no truena al leer");
  } catch (e) { console.log("  FALLA metas.js → " + e.message); fallos++; }
  console.log(fallos ? "\n" + fallos + " fallas" : "\nTodo bien.");
  process.exit(fallos ? 1 : 0);
})();
