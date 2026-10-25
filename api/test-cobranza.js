// test-cobranza.js — lógica de Cobranza (api/src/cobranza.js) y sus escrituras (api/src/cobranza-db.js) con una "base" falsa. Datos ficticios.
const assert = require("assert");
const C = require("./src/cobranza");
const DB = require("./src/cobranza-db");

let fallos = 0;
const check = (n, fn) => { try { fn(); console.log("  OK " + n); } catch (e) { console.log("  FALLA " + n + " → " + e.message); fallos++; } };
const checkAsync = async (n, fn) => { try { await fn(); console.log("  OK " + n); } catch (e) { console.log("  FALLA " + n + " → " + e.message); fallos++; } };
const rechaza = async (p, status, re) => {
  try { await p; } catch (e) { assert.ok(e.safe, "error no seguro: " + e.message); assert.strictEqual(e.status, status, e.message); if (re) assert.ok(re.test(e.message), e.message); return; }
  assert.fail("debía fallar");
};

// ── IVA ──
check("la cotización va antes de impuestos: subtotal + 16 % = total", () => {
  assert.deepStrictEqual(C.desglosarDesdeSubtotal(10000), { subtotal: 10000, iva: 1600, total: 11600 });
  assert.deepStrictEqual(C.desglosarDesdeSubtotal(8772.41), { subtotal: 8772.41, iva: 1403.59, total: 10176 });
});
check("captura solo con total: el subtotal sale al revés y suma exacto", () => {
  const m = C.desglosarMonto({ total: 10176 });
  assert.strictEqual(m.total, 10176);
  assert.strictEqual(C.centavos(m.subtotal + m.iva), 10176);
  assert.strictEqual(m.retencion_isr, 0);
});
check("tipo de factura: Empresa, Gobierno, Anterior y Otro calculan sus retenciones", () => {
  assert.deepStrictEqual(C.retencionesDe(10000, "Empresa"), { iva: 1600, retencion_isr: 1000, retencion_iva: 1066.67 });
  assert.deepStrictEqual(C.retencionesDe(9600, "Gobierno"), { iva: 1536, retencion_isr: 960, retencion_iva: 0 });
  assert.deepStrictEqual(C.retencionesDe(40000, "Anterior"), { iva: 6400, retencion_isr: 0, retencion_iva: 0 });
  assert.deepStrictEqual(C.retencionesDe(10000, "Otro"), C.retencionesDe(10000, "Empresa"));
  // con tipo y sin retenciones capturadas salen del tipo; si se capturan, mandan las capturadas
  assert.strictEqual(C.desglosarMonto({ subtotal: 9600, tipo_factura: "Gobierno" }).total, 10176);
  assert.strictEqual(C.desglosarMonto({ subtotal: 9600, tipo_factura: "Gobierno", retencion_isr: 0, retencion_iva: 0 }).total, 11136);
  assert.deepStrictEqual(C.TIPOS_FACTURA, ["Empresa", "Gobierno", "Anterior", "Otro"]);
});
check("las facturas de terceros (Otro) no cuentan en las tarjetas", () => {
  const fila = (o) => ({ estatus: "Facturada", total: 1000, saldo: 1000, pagos: [], semaforo: { clave: "vencida", dias: 5 }, fecha_emision: "2026-09-01", ...o });
  const r = C.resumir([fila({}), fila({ tipo_factura: "Otro" }), fila({ tipo_factura: "Otro", estatus: "Pagada", saldo: 0, pagos: [{ monto: 1000, fecha: "2026-10-01", anulado: false }], semaforo: { clave: "cerrada", dias: null } })]);
  assert.strictEqual(r.por_cobrar, 1000); assert.strictEqual(r.vencido_n, 1); assert.strictEqual(r.cobrado, 0);
});
check("retenciones (persona física): total = subtotal + IVA − ISR − IVA retenido", () => {
  // Gobierno: solo retiene 10 % de ISR → 9,600 + 1,536 − 960 = 10,176
  assert.deepStrictEqual(C.desglosarMonto({ subtotal: 9600, retencion_isr: 960 }), { subtotal: 9600, iva: 1536, retencion_isr: 960, retencion_iva: 0, total: 10176 });
  // ISR 10 % + 2/3 del IVA
  const m = C.desglosarMonto({ subtotal: 10000, retencion_isr: 1000, retencion_iva: 1066.67 });
  assert.strictEqual(m.total, 9533.33);
  assert.throws(() => C.desglosarMonto({ subtotal: 100, retencion_isr: 500 }), /retenciones/);
  assert.strictEqual(C.desglosarMonto({ subtotal: 1000 }).retencion_isr, 0, "sin retenciones por defecto");
});
check("subtotal + iva explícitos se respetan; sin monto o negativo se rechaza", () => {
  assert.deepStrictEqual(C.desglosarMonto({ subtotal: 1000, iva: 0 }), { subtotal: 1000, iva: 0, retencion_isr: 0, retencion_iva: 0, total: 1000 });
  assert.throws(() => C.desglosarMonto({}), /monto/);
  assert.throws(() => C.desglosarMonto({ total: -5 }), /cero/);
});

// ── vencimiento y semáforo ──
const hoy = new Date("2026-10-22T15:00:00Z");
check("vencimiento = inicio de plazo + plazo (30 por defecto)", () => {
  assert.strictEqual(C.vencimientoDe("2026-10-01", 30), "2026-10-31");
  assert.strictEqual(C.vencimientoDe("2026-10-01"), "2026-10-31");
  assert.strictEqual(C.vencimientoDe(null, 30), null);
});
check("semáforo: vencida / por vencer / al corriente / sin plazo / cerrada", () => {
  const s = (o) => C.semaforoDe({ estatus: "Facturada", saldo: 100, ...o }, hoy, 7);
  assert.deepStrictEqual(s({ vencimiento: "2026-10-20" }), { clave: "vencida", dias: 2 });
  assert.deepStrictEqual(s({ vencimiento: "2026-10-22" }), { clave: "por_vencer", dias: 0 });
  assert.deepStrictEqual(s({ vencimiento: "2026-10-29" }), { clave: "por_vencer", dias: 7 });
  assert.deepStrictEqual(s({ vencimiento: "2026-10-30" }), { clave: "al_corriente", dias: 8 });
  assert.strictEqual(s({ vencimiento: null }).clave, "sin_plazo");
  assert.strictEqual(s({ estatus: "Pagada", saldo: 0, vencimiento: "2026-01-01" }).clave, "cerrada");
  assert.strictEqual(s({ estatus: "Cancelada", vencimiento: "2026-01-01" }).clave, "cerrada");
});
check("orden por defecto: lo más urgente primero", () => {
  const f = (clave, dias) => ({ clave, semaforo: { clave, dias } });
  const lista = [f("al_corriente", 20), f("cerrada", null), f("por_vencer", 5), f("vencida", 3), f("sin_plazo", null), f("vencida", 40), f("por_vencer", 1)];
  lista.sort(C.compararUrgencia);
  assert.deepStrictEqual(lista.map((x) => x.clave + ":" + x.semaforo.dias), ["vencida:40", "vencida:3", "por_vencer:1", "por_vencer:5", "sin_plazo:null", "al_corriente:20", "cerrada:null"]);
});

// ── estatus derivado y pagos ──
const pagos = (...m) => m.map((monto, i) => ({ id: i + 1, monto, anulado: false }));
check("Parcial / Pagada salen de los pagos; anular regresa a Facturada", () => {
  const e = (o) => C.estatusDerivado({ estatusActual: "Facturada", total: 1000, tieneFactura: true, ...o });
  assert.strictEqual(e({ pagos: [] }), "Facturada");
  assert.strictEqual(e({ pagos: pagos(400) }), "Parcial");
  assert.strictEqual(e({ pagos: pagos(400, 600) }), "Pagada");
  assert.strictEqual(e({ pagos: [{ monto: 1000, anulado: true }] }), "Facturada");
  assert.strictEqual(e({ estatusActual: "Cancelada", pagos: [] }), "Cancelada");
  assert.strictEqual(C.estatusDerivado({ estatusActual: "Por facturar", total: 1000, pagos: [], tieneFactura: false }), "Por facturar");
});
check("el saldo se calcula y un pago no puede excederlo", () => {
  const cuenta = { total: 1000, pagos: pagos(400), estatus: "Parcial" };
  assert.strictEqual(C.saldoDe(1000, cuenta.pagos), 600);
  assert.strictEqual(C.validarPago(cuenta, { monto: 600 }), 600);
  assert.throws(() => C.validarPago(cuenta, { monto: 600.01 }), /excede/);
  assert.throws(() => C.validarPago(cuenta, { monto: 0 }), /mayor a cero/);
  assert.throws(() => C.validarPago({ ...cuenta, estatus: "Cancelada" }, { monto: 10 }), /cancelada/);
  assert.throws(() => C.validarPago({ ...cuenta, estatus: "Por facturar" }, { monto: 10 }), /Facturada/);
});
check("división: suma exacta, 2 a 12 partes, sin pagos", () => {
  const cuenta = { total: 1000, estatus: "Facturada", pagos: [] };
  assert.strictEqual(C.validarDivision(cuenta, [{ total: 300 }, { total: 700 }]).length, 2);
  assert.throws(() => C.validarDivision(cuenta, [{ total: 300 }, { total: 600 }]), /sumar exactamente/);
  assert.throws(() => C.validarDivision(cuenta, [{ total: 1000 }]), /2 a 12/);
  assert.throws(() => C.validarDivision({ ...cuenta, pagos: pagos(10), estatus: "Parcial" }, [{ total: 500 }, { total: 500 }]), /sin pagos/);
});

// ── tarjetas ──
check("resumen: por cobrar / vencido son vivos; cobrado y días respetan el rango; sin fecha solo cuenta sin rango", () => {
  const fila = (o) => ({ estatus: "Facturada", total: 1000, saldo: 1000, pagos: [], semaforo: { clave: "al_corriente", dias: 20 }, fecha_emision: "2026-09-01", ...o });
  const filas = [
    fila({ semaforo: { clave: "vencida", dias: 5 } }),
    fila({ saldo: 600, estatus: "Parcial", pagos: [{ monto: 400, fecha: "2026-10-10", anulado: false }] }),
    fila({ saldo: 0, estatus: "Pagada", pagos: [{ monto: 1000, fecha: "2026-09-21", anulado: false }], semaforo: { clave: "cerrada", dias: null } }),
    fila({ saldo: 0, estatus: "Pagada", pagos: [{ monto: 1000, fecha: null, anulado: false }], semaforo: { clave: "cerrada", dias: null } }),
    fila({ estatus: "Cancelada", semaforo: { clave: "cerrada", dias: null } }),
    fila({ estatus: "Por facturar" }),
  ];
  const todo = C.resumir(filas);
  assert.strictEqual(todo.por_cobrar, 1600);
  assert.strictEqual(todo.vencido, 1000);
  assert.strictEqual(todo.por_facturar, 1000);
  assert.strictEqual(todo.cobrado, 2400, "400 + 1000 + 1000 sin fecha");
  assert.strictEqual(todo.dias_promedio, 20, "solo la Pagada con fechas: 1 sep → 21 sep");
  const oct = C.resumir(filas, { desde: new Date("2026-10-01T00:00:00-06:00").toISOString(), hasta: new Date("2026-11-01T00:00:00-06:00").toISOString() });
  assert.strictEqual(oct.cobrado, 400, "el pago sin fecha no entra con rango");
  assert.strictEqual(oct.por_cobrar, 1600, "lo vivo no se filtra");
  assert.strictEqual(oct.dias_promedio, null);
});

// ── escrituras con base falsa ──
function fabrica(handler) {
  const llamadas = [];
  const nuevaRequest = () => {
    const params = {};
    const r = {
      input(n, _t, v) { params[n] = v; return r; },
      async query(texto) { llamadas.push({ texto, params: { ...params } }); return { recordset: handler(texto, params) || [], rowsAffected: [1] }; },
    };
    return r;
  };
  return { nuevaRequest, hubo: (frag) => llamadas.filter((c) => c.texto.includes(frag)) };
}

(async () => {
  await checkAsync("Ganada dos veces (o regresar y volver) NO duplica la cuenta", async () => {
    const f = fabrica((t) => (t.includes("SELECT TOP 1 id FROM CuentaPorCobrar") ? [{ id: 9 }] : []));
    const r = await DB.crearCuentaDeCotizacion(f.nuevaRequest, 7);
    assert.deepStrictEqual(r, { creada: false, id: 9 });
    assert.strictEqual(f.hubo("INSERT").length, 0);
  });
  await checkAsync("Ganada la primera vez crea la cuenta Automática con IVA aparte", async () => {
    const f = fabrica((t) => {
      if (t.includes("SELECT TOP 1 id FROM CuentaPorCobrar")) return [];
      if (t.includes("FROM Cotizacion")) return [{ id: 7, folio: "AP26-ACM-EXCEL-01", cliente_id: 3, herramienta: "Excel", precio_final: 10000 }];
      if (t.includes("INSERT INTO CuentaPorCobrar")) return [{ id: 55 }];
      return [];
    });
    const r = await DB.crearCuentaDeCotizacion(f.nuevaRequest, 7);
    assert.deepStrictEqual(r, { creada: true, id: 55 });
    const ins = f.hubo("INSERT INTO CuentaPorCobrar")[0];
    assert.strictEqual(ins.params.subtotal, 10000);
    assert.strictEqual(ins.params.iva, 1600);
    assert.strictEqual(ins.params.total, 11600);
    assert.strictEqual(ins.params.origen, "Automática");
    assert.strictEqual(ins.params.estatus, "Por facturar");
    assert.strictEqual(ins.params.cotizacion_id, 7);
  });
  await checkAsync("registrar un pago que excede el saldo se rechaza sin escribir", async () => {
    const f = fabrica((t) => (t.includes("FROM CuentaPorCobrar WHERE id") ? [{ id: 1, estatus: "Parcial", total: 1000, folio_factura: "F1" }] : t.includes("FROM PagoCobranza") ? [{ id: 1, monto: 700, anulado: false }] : []));
    await rechaza(DB.registrarPago(f.nuevaRequest, { cuenta_id: 1, monto: 400 }), 409, /excede/);
    assert.strictEqual(f.hubo("INSERT INTO PagoCobranza").length, 0);
  });
  await checkAsync("un pago válido se inserta y se recalcula el estatus", async () => {
    const f = fabrica((t) => (t.includes("FROM CuentaPorCobrar WHERE id") ? [{ id: 1, estatus: "Facturada", total: 1000, folio_factura: "F1" }] : t.includes("FROM PagoCobranza") ? [] : []));
    await DB.registrarPago(f.nuevaRequest, { cuenta_id: 1, monto: 1000, fecha: "2026-10-22", metodo: "Transferencia" });
    assert.strictEqual(f.hubo("INSERT INTO PagoCobranza").length, 1);
  });
  await checkAsync("cancelar una cuenta con pagos se rechaza (primero se anulan)", async () => {
    const f = fabrica((t) => (t.includes("FROM CuentaPorCobrar WHERE id") ? [{ id: 1, estatus: "Parcial", total: 1000 }] : t.includes("FROM PagoCobranza") ? [{ id: 1, monto: 100, anulado: false }] : []));
    await rechaza(DB.cambiarEstatus(f.nuevaRequest, 1, "Cancelada"), 409, /anúlalos/);
    await rechaza(DB.cambiarEstatus(f.nuevaRequest, 1, "Pagada"), 400, /a mano/);
  });
  await checkAsync("dividir reparte el desglose proporcional y deja la 1ª parte en la cuenta original", async () => {
    let nuevoId = 100;
    const f = fabrica((t) => {
      if (t.includes("FROM CuentaPorCobrar WHERE id")) return [{ id: 1, cliente_id: 3, cotizacion_id: 7, grupo_id: null, estrategia: "empresas", concepto: "Curso", subtotal: 1000, iva: 160, total: 1160, plazo_dias: 30, estatus: "Por facturar" }];
      if (t.includes("INSERT INTO CuentaPorCobrar")) return [{ id: nuevoId++ }];
      return [];
    });
    const r = await DB.dividirCuenta(f.nuevaRequest, 1, [{ total: 580 }, { total: 580 }]);
    assert.deepStrictEqual(r, { id: 1, nuevas: [100] });
    const upd = f.hubo("UPDATE CuentaPorCobrar SET subtotal")[0];
    assert.strictEqual(upd.params.t, 580);
    assert.strictEqual(C.centavos(upd.params.s + upd.params.i), 580);
    assert.strictEqual(f.hubo("INSERT INTO CuentaPorCobrar")[0].params.total, 580);
  });
  await checkAsync("dividir una cuenta con retenciones reparte todo en proporción y cuadra al centavo", async () => {
    const f = fabrica((t) => (t.includes("FROM CuentaPorCobrar WHERE id") ? [{ id: 1, cliente_id: 3, estrategia: "empresas", concepto: "Curso", subtotal: 9600, iva: 1536, retencion_isr: 960, retencion_iva: 0, total: 10176, plazo_dias: 30, estatus: "Por facturar" }] : t.includes("INSERT INTO CuentaPorCobrar") ? [{ id: 2 }] : []));
    await DB.dividirCuenta(f.nuevaRequest, 1, [{ total: 3392 }, { total: 6784 }]);
    const a = f.hubo("UPDATE CuentaPorCobrar SET subtotal")[0].params, b = f.hubo("INSERT INTO CuentaPorCobrar")[0].params;
    for (const p of [{ s: a.s, i: a.i, r: a.ri, t: a.t }, { s: b.subtotal, i: b.iva, r: b.retencion_isr, t: b.total }]) assert.strictEqual(C.centavos(p.s + p.i - p.r), p.t);
    assert.strictEqual(a.ri, 320);
    assert.strictEqual(b.retencion_isr, 640);
  });
  await checkAsync("editar solo las retenciones parte del subtotal que ya tiene la cuenta", async () => {
    const f = fabrica((t) => (t.includes("FROM CuentaPorCobrar WHERE id") ? [{ id: 1, estatus: "Por facturar", subtotal: 9600, iva: 1536, retencion_isr: 0, retencion_iva: 0, total: 11136 }] : []));
    await DB.editarCuenta(f.nuevaRequest, { id: 1, retencion_isr: "960" });
    const upd = f.hubo("UPDATE CuentaPorCobrar SET")[0];
    assert.strictEqual(upd.params.total, 10176);
    assert.strictEqual(upd.params.retencion_isr, 960);
  });
  await checkAsync("grupo directo (sin cotización): nace una cuenta Por facturar con el monto, o en $0 si queda vacío; no duplica", async () => {
    const f = fabrica((t) => (t.includes("INSERT INTO CuentaPorCobrar") ? [{ id: 77 }] : []));
    const r = await DB.crearCuentaDeGrupo(f.nuevaRequest, { grupoId: 5, clienteId: 3, concepto: "Power BI", monto: "10000" });
    assert.deepStrictEqual(r, { creada: true, id: 77 });
    const ins = f.hubo("INSERT INTO CuentaPorCobrar")[0].params;
    assert.strictEqual(ins.grupo_id, 5); assert.strictEqual(ins.total, 11600); assert.strictEqual(ins.estatus, "Por facturar"); assert.strictEqual(ins.origen, "Automática");
    const f2 = fabrica((t) => (t.includes("INSERT INTO CuentaPorCobrar") ? [{ id: 78 }] : []));
    await DB.crearCuentaDeGrupo(f2.nuevaRequest, { grupoId: 6, clienteId: 3, concepto: "Excel", monto: "" });
    assert.strictEqual(f2.hubo("INSERT INTO CuentaPorCobrar")[0].params.total, 0, "sin monto: $0 por definir");
    const f3 = fabrica((t) => (t.includes("FROM CuentaPorCobrar WHERE grupo_id = @g") ? [{ id: 9, grupo_id: 5 }] : []));
    assert.deepStrictEqual(await DB.crearCuentaDeGrupo(f3.nuevaRequest, { grupoId: 5, clienteId: 3, concepto: "x" }), { creada: false, id: 9 });
    assert.strictEqual(f3.hubo("INSERT").length, 0);
    // un grupo que ya existía con cotización ganada: la cuenta de la cotización se LIGA al grupo, no se crea otra
    const f4 = fabrica((t) => (t.includes("FROM CuentaPorCobrar WHERE grupo_id = @g") ? [{ id: 11, grupo_id: null }] : []));
    assert.deepStrictEqual(await DB.crearCuentaDeGrupo(f4.nuevaRequest, { grupoId: 8, clienteId: 3, concepto: "x", cotizacionId: 4 }), { creada: false, id: 11 });
    assert.strictEqual(f4.hubo("INSERT").length, 0);
    assert.strictEqual(f4.hubo("UPDATE CuentaPorCobrar SET grupo_id")[0].params.g, 8);
    await rechaza(DB.crearCuentaDeGrupo(fabrica(() => []).nuevaRequest, { grupoId: 5, clienteId: 3, concepto: "x", monto: "-5" }), 400, /cero en adelante/);
  });
  await checkAsync("cliente Tercero <-> factura tipo Otro: se pone solo, y no se pueden mezclar", async () => {
    const mk = (tipoCliente) => fabrica((t) => (t.includes("SELECT tipo_cliente FROM Cliente") ? [{ tipo_cliente: tipoCliente }] : t.includes("INSERT INTO CuentaPorCobrar") ? [{ id: 90 }] : t.includes("FROM Cliente") ? [{ id: 5 }] : []));
    const f = mk("Tercero");
    const r = await DB.crearCuentaManual(f.nuevaRequest, { cliente_id: 5, razon_social: "Taller Ejemplo SA", rfc_receptor: "XAXX010101000", concepto: "Mtto", subtotal: 10000 });
    assert.strictEqual(r.id, 90);
    const p = f.hubo("INSERT INTO CuentaPorCobrar")[0].params;
    assert.strictEqual(p.tipo_factura, "Otro", "un cliente Tercero siempre queda como tipo Otro"); assert.strictEqual(p.razon_social, "Taller Ejemplo SA");
    assert.strictEqual(p.retencion_isr, 1000); assert.strictEqual(p.total, 9533.33);
    await rechaza(DB.crearCuentaManual(mk("Tercero").nuevaRequest, { cliente_id: 5, tipo_factura: "Empresa", concepto: "x", subtotal: 100 }), 400, /Tercero/);
    await rechaza(DB.crearCuentaManual(mk("Directo").nuevaRequest, { cliente_id: 3, tipo_factura: "Otro", concepto: "x", subtotal: 100 }), 400, /solo para clientes Tercero/);
    await rechaza(DB.crearCuentaManual(mk("Directo").nuevaRequest, { tipo_factura: "Otro", concepto: "x", subtotal: 100 }), 400, /Elige el cliente/);
    await rechaza(DB.crearCuentaManual(mk("Directo").nuevaRequest, { tipo_factura: "Raro", cliente_id: 3, concepto: "x", total: 100 }), 400, /Tipo de factura/);
    // las cuentas que nacen de un grupo o cotización de un cliente Tercero también quedan como Otro
    const g = mk("Tercero");
    await DB.crearCuentaDeGrupo(g.nuevaRequest, { grupoId: 9, clienteId: 5, concepto: "Curso", monto: "" });
    assert.strictEqual(g.hubo("INSERT INTO CuentaPorCobrar")[0].params.tipo_factura, "Otro");
  });
  await checkAsync("alta manual exige cliente, monto y plazo válido", async () => {
    const f = fabrica((t) => (t.includes("FROM Cliente") ? [{ id: 3 }] : t.includes("INSERT") ? [{ id: 1 }] : []));
    await rechaza(DB.crearCuentaManual(f.nuevaRequest, { concepto: "x", total: 100 }), 400, /cliente/);
    await rechaza(DB.crearCuentaManual(f.nuevaRequest, { cliente_id: 3, total: 100 }), 400, /concepto/);
    await rechaza(DB.crearCuentaManual(f.nuevaRequest, { cliente_id: 3, concepto: "x", total: 100, plazo_dias: 999 }), 400, /plazo/);
    const r = await DB.crearCuentaManual(f.nuevaRequest, { cliente_id: 3, concepto: "Curso abierto", total: 1160, estrategia: "abiertos" });
    assert.strictEqual(r.id, 1);
    const ins = f.hubo("INSERT INTO CuentaPorCobrar")[0];
    assert.strictEqual(ins.params.estrategia, "abiertos");
    assert.strictEqual(ins.params.plazo_dias, 30);
    assert.strictEqual(ins.params.estatus, "Por facturar");
  });

  console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : "\ntest-cobranza: ok");
  process.exit(fallos ? 1 : 0);
})();
