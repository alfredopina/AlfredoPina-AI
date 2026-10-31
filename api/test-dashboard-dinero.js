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
  assert.deepStrictEqual(p.meta.sinFiltrar.slice().sort(), ["cot", "gan", "per", "pip"]); assert.ok(p.meta.notas.length >= 1);
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
console.log(fallos ? "\n" + fallos + " fallas" : "\nTodo bien.");
process.exit(fallos ? 1 : 0);
