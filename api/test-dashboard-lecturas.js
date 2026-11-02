// test-dashboard-lecturas.js — biblioteca de reglas de las lecturas del Dashboard → Resumen (api/src/dashboard-lecturas.js): cada regla se prueba con datos
// ficticios que la disparan, el sistema elige las 3 de mayor peso (a lo más 2 de una misma etapa) y una regla rota nunca rompe el Resumen. Sin SQL ni red.
const assert = require("assert");
const { calcularDinero } = require("./src/dashboard-dinero");
const { calcularLecturas, contexto, REGLAS } = require("./src/dashboard-lecturas");

let fallos = 0;
const check = (n, fn) => { try { fn(); console.log("  OK " + n); } catch (e) { console.log("  FALLA " + n + " → " + e.message); fallos++; } };
const ms = (s) => Date.parse(s + "T06:00:00Z");
const AHORA = new Date("2026-10-28T18:00:00Z");
const UMBRALES = { cotizacionesSeguimientoDias: 6, cotizacionesDias: 10, solicitudesSeguimientoHoras: 24, solicitudesHoras: 72, cobranzaPorVencerDias: 7 };
const cuenta = (o) => ({ estrategia: "empresas", tipo_factura: "Empresa", estatus: "Facturada", subtotal: 1000, total: 1160, emision: null, creada: ms("2026-01-01"), vencimiento: null, tipo: "Directo", herrs: ["excel"], pagos: [], cli: "Cliente", concepto: "Curso", ...o });
const pago = (fecha, monto) => ({ fecha, creada: ms(fecha), monto, anulado: false });
const cot = (o) => ({ id: 0, estatus: "Enviada", precio: 0, alt: null, herr: "excel", creada: ms("2026-01-01"), enviada: ms("2026-01-01"), cierre: null, cierreReal: null, motivo: null, tipo: "Directo", tt: "estandar", cli: "Cliente", cliId: 1, folio: null, desc: null, ...o });
const sol = (o) => ({ herr: "excel", canal: "Sitio", estatus: "Nueva", creada: ms("2026-10-03"), tipo: "Directo", cli: "Cliente", ...o });

const datos = () => ({
  cuentas: [
    cuenta({ cli: "Acme", subtotal: 10000, total: 11600, emision: "2026-08-01", creada: ms("2026-08-01"), vencimiento: "2026-09-01" }), // vencida hace 57 días
    cuenta({ cli: "Acme", subtotal: 5000, total: 5800, emision: "2026-09-15", creada: ms("2026-09-15"), vencimiento: "2026-10-15" }), // vencida hace 13 días
    cuenta({ cli: "Beta", subtotal: 4000, total: 4640, emision: "2026-10-20", creada: ms("2026-10-20"), vencimiento: "2026-11-02" }), // vence en 5 días
    cuenta({ cli: "Beta", subtotal: 3000, total: 3480, emision: "2026-10-10", creada: ms("2026-10-10"), vencimiento: "2026-11-20" }), // en plazo
    cuenta({ cli: "Delta", subtotal: 6000, total: 6960, estatus: "Por facturar", creada: ms("2026-10-10"), cotId: 30 }), // vendida sin factura hace 18 días
    // clientes que pagan tarde: 3 facturas pagadas a 50 días con plazo de 30
    ...[["2026-06-15", "2026-07-15", "2026-08-04"], ["2026-07-01", "2026-07-31", "2026-08-20"], ["2026-08-01", "2026-08-31", "2026-09-20"]].map(([e, v, p]) =>
      cuenta({ cli: "Lenta", estatus: "Pagada", emision: e, creada: ms(e), vencimiento: v, pagos: [pago(p, 1160)] })),
  ],
  cotizaciones: [
    cot({ id: 40, cli: "Acme", cliId: 1, folio: "COT-40", precio: 30000, enviada: ms("2026-10-05") }), // 23 días abierta
    cot({ id: 41, cli: "Beta", cliId: 2, folio: "COT-41", estatus: "En negociación", precio: 20000, enviada: ms("2026-10-10") }),
    cot({ id: 42, cli: "Acme", cliId: 1, precio: 10000, enviada: ms("2026-10-12") }),
    cot({ id: 30, cli: "Delta", cliId: 3, estatus: "Ganada", precio: 6000, enviada: ms("2026-09-20"), cierre: ms("2026-10-08") }),
    // consultoría cierra 3 de 4; personalizados 1 de 4 (con descuento de 20 %, perdiendo por precio alto)
    ...[1, 2, 3].map((i) => cot({ id: 50 + i, tt: "consultoria", estatus: "Ganada", precio: 5000, enviada: ms("2026-09-01"), cierre: ms("2026-09-20") })),
    cot({ id: 54, tt: "consultoria", estatus: "Perdida", precio: 5000, motivo: "Otro proveedor", enviada: ms("2026-09-01"), cierre: ms("2026-09-22") }),
    cot({ id: 60, tt: "personalizado", desc: 20, estatus: "Ganada", precio: 9000, enviada: ms("2026-09-02"), cierre: ms("2026-09-25") }),
    ...[1, 2, 3].map((i) => cot({ id: 60 + i, tt: "personalizado", desc: 20, estatus: "Perdida", precio: 9000, motivo: "Precio alto", enviada: ms("2026-09-02"), cierre: ms("2026-09-25") })),
    // un cliente que compró hace meses y no ha vuelto
    cot({ id: 70, cli: "Dormida", cliId: 99, estatus: "Ganada", precio: 8000, enviada: ms("2026-01-10"), cierre: ms("2026-02-01") }),
  ],
  solicitudes: [sol({ cli: "Zeta", creada: ms("2026-10-23") }), sol({ estatus: "Cotizada" })],
});
const calc = (filtros, metas) => calcularDinero(datos(), filtros || {}, { ahora: AHORA, umbralPorVencer: 7, metas: metas || {} });
const METAS = { cot: 200000, gan: 100000, cob: 50000, sol: 10 };
const r = calc({}, METAS);
const x = contexto(datos(), r, { ahora: AHORA, umbrales: UMBRALES });
const regla = (id) => REGLAS.find((g) => g.id === id);
const corre = (id) => regla(id).run(x);

check("la biblioteca tiene reglas de todas las etapas, con id único", () => {
  const ids = REGLAS.map((g) => g.id);
  assert.strictEqual(new Set(ids).size, ids.length); assert.ok(ids.length >= 20, String(ids.length));
  for (const e of ["sol", "cot", "gan", "fac", "cob"]) assert.ok(REGLAS.some((g) => g.etapa === e), e);
});
check("proyección de Cotizado: al ritmo actual no llega y dice cuántas cotizaciones faltan", () => {
  const o = corre("proyeccion-cotizado");
  assert.strictEqual(o.tipo, "alerta"); assert.ok(/Te faltan/.test(o.texto) && /cotizaciones/.test(o.texto) && /ticket promedio/.test(o.texto), o.texto);
});
check("seguimiento de cotizaciones abiertas: nombres, montos y días; urgente por pasar el umbral", () => {
  const o = corre("seguimiento-cotizaciones");
  assert.strictEqual(o.tipo, "urg"); assert.ok(/3 cotizaciones llevan/.test(o.texto) && /\$60,000/.test(o.texto), o.texto);
  assert.ok(/Acme/.test(o.items[0]) && /\$30,000/.test(o.items[0]) && /23 días/.test(o.items[0]) && /COT-40/.test(o.items[0]), o.items[0]);
});
check("cobertura del pipeline contra la meta de Vendido, con la tasa de cierre de 90 días", () => {
  const o = corre("cobertura-pipeline");
  assert.ok(o && /Por vender/.test(o.texto) && /cierre de \*\*\d+ %\*\*/.test(o.texto), o && o.texto);
});
check("cierre por tipo de servicio: consultoría contra personalizados", () => {
  const o = corre("cierre-por-tipo");
  assert.ok(/consultoría\*\* cierra \*\*75 %\*\*/.test(o.texto) && /cursos personalizados\*\* \*\*25 %\*\*/.test(o.texto), o.texto);
});
check("el descuento de 15 % o más no ayuda a cerrar", () => { const o = corre("descuentos-cierre"); assert.ok(o && o.tipo === "alerta" && /15 % o más/.test(o.texto), o && o.texto); });
check("motivo principal de pérdida con su consejo", () => { const o = corre("motivo-perdida"); assert.ok(/precio alto/.test(o.texto) && /tarifas/.test(o.texto), o && o.texto); });
check("clientes dormidos que ya compraron", () => { const o = corre("clientes-dormidos"); assert.ok(/1 cliente que ya te compró/.test(o.texto) && /Dormida/.test(o.items[0]) && /\$8,000/.test(o.items[0]), o && o.texto); });
check("concentración de lo cotizado en un solo cliente", () => { const o = corre("concentracion-cotizado"); assert.ok(/Acme/.test(o.texto) && /67 %/.test(o.texto), o && o.texto); });
check("solicitudes sin atender: urgente pasadas las 72 h, con nombre", () => { const o = corre("solicitudes-sin-atender"); assert.strictEqual(o.tipo, "urg"); assert.ok(/1 solicitud sin atender/.test(o.texto) && /Zeta/.test(o.items[0]), o.texto); });
check("vendido sin factura con edad y nombre (más de 14 días: urgente)", () => { const o = corre("por-facturar-edad"); assert.strictEqual(o.tipo, "urg"); assert.ok(/\$6,000/.test(o.texto) && /Delta/.test(o.items[0]) && /18 días/.test(o.items[0]), o.texto + " " + o.items[0]); });
check("lo vendido del mes que sigue sin factura", () => { const o = corre("vendido-sin-factura"); assert.ok(/\$6,000/.test(o.texto) && /100 %/.test(o.texto), o && o.texto); });
check("vencidos: monto, porcentaje de lo por cobrar y los clientes con más atraso", () => {
  const o = corre("vencidos-top");
  assert.strictEqual(o.tipo, "urg"); assert.ok(/\$15,000/.test(o.texto) && /68 %/.test(o.texto), o.texto);
  assert.ok(/Acme/.test(o.items[0]) && /\$15,000/.test(o.items[0]) && /57 días de atraso/.test(o.items[0]), o.items[0]);
});
check("calendario de cobro: lo que vence en los próximos 7 días", () => { const o = corre("calendario-cobro"); assert.ok(/\$4,000/.test(o.texto) && /Beta/.test(o.items[0]) && /vence en 5 días/.test(o.items[0]), o && o.texto); });
check("proyección de Cobrado: lo que vence y lo vencido contra la meta; avisa cuando no alcanza", () => { const o = corre("proyeccion-cobrado"); assert.strictEqual(o.tipo, "alerta"); assert.ok(/no alcanza/.test(o.texto) && /\$15,000/.test(o.texto), o.texto); });
check("días de cobro: pagan a 50 días con plazo de 30 y nombra al que se atrasa", () => { const o = corre("dias-de-cobro"); assert.ok(/50 días/.test(o.texto) && /plazo de \*\*30\*\*/.test(o.texto) && /Lenta/.test(o.items[0]), o && o.texto); });
check("concentración de la cartera en un cliente", () => { const o = corre("concentracion-cartera"); assert.ok(/Acme/.test(o.texto) && /68 %/.test(o.texto), o && o.texto); });
check("cobrado contra facturado: la cartera crece", () => { const o = corre("cobrado-vs-facturado"); assert.ok(o.tipo === "alerta" && /la cartera crece/.test(o.texto), o.texto); });
check("cartera sana no aparece si hay vencido", () => assert.strictEqual(corre("cartera-sana"), null));

check("el sistema elige 3 lecturas, de la más urgente a la menos, con a lo más 2 por etapa; las urgentes primero", () => {
  const l = calcularLecturas(datos(), r, { ahora: AHORA, umbrales: UMBRALES });
  assert.strictEqual(l.principales.length, 3);
  for (let i = 1; i < 3; i++) assert.ok(l.principales[i - 1].score >= l.principales[i].score);
  const por = {}; l.principales.forEach((p) => { por[p.etapa] = (por[p.etapa] || 0) + 1; }); assert.ok(Object.values(por).every((n) => n <= 2), JSON.stringify(por));
  assert.ok(l.principales[0].tipo === "urg", l.principales[0].id);
  assert.ok(l.principales.every((p) => p.texto && p.panel && p.accion && p.etapa), "campos completos");
  assert.ok(l.otras.length >= 1);
});
check("las lecturas cambian cuando cambia la situación: sin pendientes, mandan otras reglas", () => {
  const limpio = { cuentas: [], cotizaciones: [cot({ id: 1, estatus: "Ganada", precio: 5000, enviada: ms("2026-10-02"), cierre: ms("2026-10-10") })], solicitudes: [] };
  const rr = calcularDinero(limpio, {}, { ahora: AHORA, umbralPorVencer: 7, metas: { cot: 1000, cob: 1000 } });
  const l = calcularLecturas(limpio, rr, { ahora: AHORA, umbrales: UMBRALES });
  assert.ok(l.principales.every((p) => p.tipo !== "urg"), l.principales.map((p) => p.id).join());
  assert.ok(l.principales.some((p) => p.id === "proyeccion-cotizado" && p.tipo === "bien"), l.principales.map((p) => p.id).join());
});
check("un mes cerrado trae el resultado de cada meta (Cotizado, Vendido, Cobrado)", () => {
  const rp = calc({ mes: "2026-09" }, METAS);
  const l = calcularLecturas(datos(), rp, { ahora: AHORA, umbrales: UMBRALES });
  assert.ok(l.principales.length >= 1 && l.principales.every((p) => /^resultado-|^concentracion|^vendido|^cobrado/.test(p.id)), l.principales.map((p) => p.id).join());
  assert.ok(/septiembre|sep/i.test(l.principales.map((p) => p.texto).join(" ")));
});
check("«todo el historial» da un resumen acumulado", () => {
  const rt = calc({ mes: "todo" }, METAS);
  const l = calcularLecturas(datos(), rt, { ahora: AHORA, umbrales: UMBRALES });
  assert.strictEqual(l.principales.length, 1); assert.strictEqual(l.principales[0].id, "acumulado");
});
check("una regla que falla se omite y el Resumen sigue", () => {
  REGLAS.push({ id: "rota", etapa: "cot", cuando: ["actual"], run() { throw new Error("datos raros"); } });
  try { const l = calcularLecturas(datos(), r, { ahora: AHORA, umbrales: UMBRALES }); assert.strictEqual(l.principales.length, 3); assert.ok(!l.principales.some((p) => p.id === "rota")); }
  finally { REGLAS.pop(); }
});
check("con los filtros de herramienta las reglas siguen la misma población que las barras", () => {
  const rp = calc({ herramienta: "powerbi" }, {});
  const l = calcularLecturas(datos(), rp, { ahora: AHORA, umbrales: UMBRALES });
  assert.ok(Array.isArray(l.principales) && !l.principales.some((p) => /Acme/.test(p.texto + p.items.join())));
});
console.log(fallos ? "\n" + fallos + " fallas" : "\nTodo bien.");
process.exit(fallos ? 1 : 0);
