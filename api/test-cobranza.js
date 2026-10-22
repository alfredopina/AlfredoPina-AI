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
});
check("subtotal + iva explícitos se respetan; sin monto o negativo se rechaza", () => {
  assert.deepStrictEqual(C.desglosarMonto({ subtotal: 1000, iva: 0 }), { subtotal: 1000, iva: 0, total: 1000 });
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
