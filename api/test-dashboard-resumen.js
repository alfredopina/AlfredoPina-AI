// test-dashboard-resumen.js — cálculo del Dashboard → Resumen (api/src/dashboard-resumen.js) y la foto diaria (api/src/dashboard-foto.js).
// Datos ficticios; sin SQL ni red (la tabla de fotos es una falsa en memoria).
const assert = require("assert");
const R = require("./src/dashboard-resumen");
const C = require("./src/cobranza");
const F = require("./src/dashboard-foto");

let fallos = 0;
const check = (n, fn) => { try { fn(); console.log("  OK " + n); } catch (e) { console.log("  FALLA " + n + " → " + e.message); fallos++; } };
const checkAsync = async (n, fn) => { try { await fn(); console.log("  OK " + n); } catch (e) { console.log("  FALLA " + n + " → " + e.message); fallos++; } };

const ms = (s) => Date.parse(s + (s.length === 10 ? "T06:00:00Z" : "")); // "2026-10-05" = medianoche de Monterrey
const AHORA = new Date("2026-10-28T18:00:00Z"); // 28 de octubre, 12:00 en Monterrey
const tarjeta = (r, sec, id) => r.secciones.find((s) => s.id === sec).tarjetas.find((t) => t.id === id);

const cuenta = (o) => ({ estrategia: "empresas", tipo_factura: "Empresa", estatus: "Facturada", total: 1000, emision: null, creada: ms("2026-01-01"), vencimiento: null, tipo: "Directo", herrs: ["excel"], pagos: [], ...o });
const pago = (fecha, monto) => ({ fecha, creada: ms(fecha), monto, anulado: false });
const datosBase = () => ({
  cuentas: [
    // facturada en agosto, pagada el 10 de sep → cobrado en sep
    cuenta({ total: 1000, emision: "2026-08-20", creada: ms("2026-08-20"), vencimiento: "2026-09-19", pagos: [pago("2026-09-10", 1000)], estatus: "Pagada" }),
    // facturada en sep, pagada el 5 de oct (cobrado en oct, dentro del corte del 28)
    cuenta({ total: 2000, emision: "2026-09-05", creada: ms("2026-09-05"), vencimiento: "2026-10-05", pagos: [pago("2026-10-05", 2000)], estatus: "Pagada" }),
    // facturada en sep, vence 10 de oct, sin pagar → vencida hoy; el 30 de sep aún no vencía
    cuenta({ total: 3000, emision: "2026-09-10", creada: ms("2026-09-10"), vencimiento: "2026-10-10", herrs: ["powerbi"] }),
    // por facturar desde el 15 de oct
    cuenta({ total: 500, estatus: "Por facturar", emision: null, creada: ms("2026-10-15") }),
    // cancelada: nunca cuenta
    cuenta({ total: 9999, estatus: "Cancelada", emision: "2026-09-01", creada: ms("2026-09-01") }),
    // de terceros (Otro): fuera de las métricas
    cuenta({ total: 7777, tipo_factura: "Otro", estrategia: null, emision: "2026-09-02", creada: ms("2026-09-02"), vencimiento: "2026-09-30" }),
    // manual sin cotización ni grupo: sin herramienta
    cuenta({ total: 400, emision: "2026-10-01", creada: ms("2026-10-01"), vencimiento: "2026-10-31", herrs: [] }),
  ],
  cotizaciones: [
    { id: 1, estatus: "Ganada", precio: 10000, alt: null, herr: "excel", creada: ms("2026-08-25"), cierre: ms("2026-09-12"), cierreReal: ms("2026-09-12"), tipo: "Directo" },
    { id: 2, estatus: "Perdida", precio: 4000, alt: null, herr: "excel", creada: ms("2026-09-01"), cierre: ms("2026-09-20"), cierreReal: ms("2026-09-20"), tipo: "Directo" },
    { id: 3, estatus: "Ganada", precio: 6000, alt: null, herr: "powerbi", creada: ms("2026-09-25"), cierre: ms("2026-10-08"), cierreReal: ms("2026-10-08"), tipo: "Intermediario" },
    { id: 4, estatus: "Enviada", precio: 8000, alt: 7, herr: "excel", creada: ms("2026-10-10"), cierre: null, cierreReal: null, tipo: "Directo" },
    { id: 5, estatus: "Enviada", precio: 9000, alt: 7, herr: "excel", creada: ms("2026-10-10"), cierre: null, cierreReal: null, tipo: "Directo" },
    { id: 6, estatus: "Borrador", precio: 1000, alt: null, herr: "excel", creada: ms("2026-10-11"), cierre: null, cierreReal: null, tipo: "Directo" },
  ],
  solicitudes: [
    { herr: "excel", canal: "Manual", estatus: "Cotizada", prospecto: false, creada: ms("2026-09-03"), primera: ms("2026-09-03") + 10 * 3600000, tipo: "Directo" },
    { herr: "excel", canal: "Sitio", estatus: "Cotizada", prospecto: true, creada: ms("2026-10-02"), primera: ms("2026-10-02") + 20 * 3600000, tipo: "Prospecto" },
    { herr: "powerbi", canal: "Sitio", estatus: "Nueva", prospecto: false, creada: ms("2026-10-20"), primera: null, tipo: "Directo" },
  ],
  grupos: [
    { herrs: ["excel"], cerrado: true, activo: false, fin: ms("2026-09-01"), cierre: ms("2026-09-06"), existe: ms("2026-08-01"), tipo: "Directo" },
    { herrs: ["excel"], cerrado: false, activo: true, fin: null, cierre: null, existe: ms("2026-10-01"), tipo: "Directo" },
    { herrs: ["powerbi"], cerrado: false, activo: true, fin: null, cierre: null, existe: ms("2026-10-05"), tipo: "Intermediario" },
  ],
  clientes: [
    { tipo: "Directo", creada: ms("2026-08-02"), contactos: 2, completo: true, activo: true },
    { tipo: "Intermediario", creada: ms("2026-09-15"), contactos: 1, completo: false, activo: true },
    { tipo: "Indirecto", creada: null, contactos: 1, completo: true, activo: false },
    { tipo: "Directo", creada: ms("2026-10-12"), contactos: 3, completo: true, activo: false },
    { tipo: "Prospecto", creada: ms("2026-10-12"), contactos: 9, completo: true, activo: true }, // no cuenta (igual que el Tracking)
  ],
});
const calc = (filtros, extra = {}, datos = datosBase()) => R.calcular(datos, filtros, { ahora: AHORA, ...extra });

console.log("Estructura");
check("5 secciones en orden de importancia con las 25 tarjetas de los Trackings", () => {
  const r = calc({});
  assert.deepStrictEqual(r.secciones.map((s) => s.id), ["cobranza", "cotizaciones", "solicitudes", "grupos", "clientes"]);
  assert.deepStrictEqual(r.secciones.map((s) => s.tarjetas.map((t) => t.label)), [
    ["Por cobrar", "Vencido", "Por facturar", "Cobrado", "Días promedio de cobro"],
    ["Pipeline activo", "Ganado", "Perdido", "Tasa de conversión", "Tiempo promedio de cierre"],
    ["Solicitudes manuales", "Solicitudes del sitio", "% Solicitudes atendidas", "Horas promedio de atención", "Prospectos generados"],
    ["Grupos Activos", "Grupos Cerrados", "Total", "Días promedio de cierre", "Grupos de Clientes Directos"],
    ["Clientes", "Completos", "Contactos", "Clientes Activos", "Clientes Directos"],
  ]);
});
check("meta: mes en curso, corte al día 28 y lista de meses de nuevo a viejo", () => {
  const r = calc({});
  assert.strictEqual(r.meta.mes, "2026-10"); assert.strictEqual(r.meta.esActual, true); assert.strictEqual(r.meta.corteDia, 28);
  assert.strictEqual(r.meta.mesAnterior, "sep"); assert.strictEqual(r.meta.meses[0].valor, "2026-10"); assert.strictEqual(r.meta.meses[0].etiqueta, "Octubre 2026");
  assert.strictEqual(r.meta.meses[r.meta.meses.length - 1].valor, "2026-08");
});
check("la serie solo dibuja desde el primer mes con datos (menos de 12 meses)", () => {
  const t = tarjeta(calc({}), "cobranza", "cobrado");
  assert.deepStrictEqual(t.serie.map((p) => p.mes), ["2026-08", "2026-09", "2026-10"]);
});

console.log("Cobranza (misma lógica que el Tracking)");
check("el mes en curso se compara contra el MISMO corte del mes anterior", () => {
  const t = tarjeta(calc({}), "cobranza", "cobrado");
  assert.strictEqual(t.valor, 2000); // pago del 5 de oct
  assert.strictEqual(t.serie[1].v, 1000); // sep completo
  // cobrado sep al día 28 = 1000 → +100 %
  assert.strictEqual(t.cmp.k, "bien"); assert.strictEqual(t.cmp.ic, "sube"); assert.strictEqual(t.cmp.texto, "+100 % vs sep");
});
check("Vencido sube = mal: rojo con la palabra «atención»; Por cobrar es neutral", () => {
  const r = calc({});
  const v = tarjeta(r, "cobranza", "vencido");
  assert.strictEqual(v.valor, 3000); // la cuenta de 3000 venció el 10 de oct; la de 400 vence el 31
  assert.strictEqual(v.cmp.k, "urg"); assert.ok(/atención/.test(v.cmp.texto)); assert.strictEqual(v.urgente, true);
  assert.strictEqual(tarjeta(r, "cobranza", "por_cobrar").cmp.k, "normal");
});
check("reconstruye el pasado: fin de septiembre la cuenta de 3000 aún no estaba vencida", () => {
  const r = calc({ mes: "2026-09" });
  assert.strictEqual(tarjeta(r, "cobranza", "vencido").valor, 0);
  assert.strictEqual(tarjeta(r, "cobranza", "por_cobrar").valor, 5000); // 3000 + 2000 (esta se pagó hasta el 5 de oct)
  assert.strictEqual(r.meta.esActual, false); assert.strictEqual(r.meta.corteDia, null);
});
check("Por facturar: la cuenta de 500 existe desde el 15 de oct y no antes", () => {
  assert.strictEqual(tarjeta(calc({}), "cobranza", "por_facturar").valor, 500);
  assert.strictEqual(tarjeta(calc({ mes: "2026-09" }), "cobranza", "por_facturar").valor, 0);
});
check("canceladas y facturas de terceros nunca cuentan", () => {
  const t = tarjeta(calc({ mes: "todo" }), "cobranza", "por_cobrar");
  assert.strictEqual(t.valor, 3400); // 3000 + 400
});
check("«Todo el historial» = lo que dice el Tracking sin «contar desde» (resumir sobre las filas de hoy)", () => {
  const d = datosBase();
  const filas = R.filasAhora(d.cuentas, AHORA.getTime() - 6 * 3600000, 7);
  const esperado = C.resumir(filas, {});
  const r = calc({ mes: "todo" });
  for (const [id, k] of [["por_cobrar", "por_cobrar"], ["vencido", "vencido"], ["por_facturar", "por_facturar"], ["cobrado", "cobrado"], ["dias_cobro", "dias_promedio"]]) {
    assert.strictEqual(tarjeta(r, "cobranza", id).valor, esperado[k], id);
  }
  assert.strictEqual(tarjeta(r, "cobranza", "cobrado").cmp.k, "acum");
  assert.strictEqual(r.meta.todo, true); assert.strictEqual(r.meta.etiquetaMes, "Todo el historial");
});
check("Días promedio de cobro baja = bien", () => {
  const t = tarjeta(calc({ mes: "2026-10" }), "cobranza", "dias_cobro");
  assert.strictEqual(t.valor, 30); // emisión 5 sep → pago 5 oct
  assert.strictEqual(tarjeta(calc({ mes: "2026-09" }), "cobranza", "dias_cobro").valor, 21); // 20 ago → 10 sep
  assert.strictEqual(t.cmp.k, "mal"); assert.ok(t.cmp.texto.startsWith("+9 días"));
});

console.log("Cotizaciones, Solicitudes, Grupos, Clientes");
check("Ganado/Perdido/Tasa/Tiempo de cierre salen de la fecha de cierre", () => {
  const r = calc({ mes: "2026-09" });
  assert.strictEqual(tarjeta(r, "cotizaciones", "ganado").valor, 10000);
  assert.strictEqual(tarjeta(r, "cotizaciones", "perdido").valor, 4000);
  assert.strictEqual(tarjeta(r, "cotizaciones", "tasa").valor, 50);
  assert.strictEqual(tarjeta(r, "cotizaciones", "tiempo_cierre").valor, 18.5); // (18 + 19) / 2
}) ;
check("Perdido baja = bien; Tasa sube = bien con «pts»", () => {
  const r = calc({});
  const p = tarjeta(r, "cotizaciones", "perdido");
  assert.strictEqual(p.valor, 0); assert.strictEqual(p.cmp.k, "bien"); assert.strictEqual(p.cmp.ic, "baja");
  const t = tarjeta(r, "cotizaciones", "tasa");
  assert.strictEqual(t.valor, 100); assert.strictEqual(t.cmp.k, "bien"); assert.ok(/pts vs sep/.test(t.cmp.texto));
});
check("Pipeline: una alternativa cuenta una vez (la de monto más alto) y el borrador no cuenta", () => {
  assert.strictEqual(tarjeta(calc({}), "cotizaciones", "pipeline").valor, 9000);
});
check("Solicitudes: canal, % atendidas, horas y prospectos del mes", () => {
  const r = calc({ mes: "2026-10" });
  assert.strictEqual(tarjeta(r, "solicitudes", "sol_manuales").valor, 0);
  assert.strictEqual(tarjeta(r, "solicitudes", "sol_sitio").valor, 2);
  assert.strictEqual(tarjeta(r, "solicitudes", "sol_atendidas").valor, 50);
  assert.strictEqual(tarjeta(r, "solicitudes", "sol_horas").valor, 20);
  assert.strictEqual(tarjeta(r, "solicitudes", "sol_prospectos").valor, 1);
});
check("Grupos: cerrados y días de cierre del mes; Total es el acumulado al final del mes", () => {
  const sep = calc({ mes: "2026-09" });
  assert.strictEqual(tarjeta(sep, "grupos", "gru_cerrados").valor, 1);
  assert.strictEqual(tarjeta(sep, "grupos", "gru_dias").valor, 5);
  assert.strictEqual(tarjeta(sep, "grupos", "gru_total").valor, 1);
  assert.strictEqual(tarjeta(calc({}), "grupos", "gru_total").valor, 3);
});
check("Clientes: no cuenta Prospectos; sin fecha de origen = ya estaba antes; Directos = (Directo + Intermediario) / total", () => {
  const r = calc({});
  assert.strictEqual(tarjeta(r, "clientes", "cli_total").valor, 4);
  assert.strictEqual(tarjeta(r, "clientes", "cli_directos").valor, 75);
  assert.strictEqual(tarjeta(calc({ mes: "2026-08" }), "clientes", "cli_total").valor, 2); // el Directo del 2 ago + el sin fecha
});

console.log("Comparaciones");
const T = (fmt, dir, urg) => ({ fmt, dir, urg });
check("«igual» cuando el cambio es menor a 3 %", () => {
  assert.strictEqual(R.comparar(T("dinero", "sube_bien"), 1020, 1000, "sep").k, "igual");
  assert.strictEqual(R.comparar(T("num", "neutral"), 31, 31, "sep").texto, "igual que sep");
});
check("dirección buena o mala por tarjeta (sube_bien, baja_bien, sube_mal, neutral)", () => {
  assert.strictEqual(R.comparar(T("dinero", "sube_bien"), 1200, 1000, "sep").k, "bien");
  assert.strictEqual(R.comparar(T("dinero", "sube_bien"), 800, 1000, "sep").k, "mal");
  assert.strictEqual(R.comparar(T("dias", "baja_bien"), 35, 38, "sep").k, "bien");
  assert.strictEqual(R.comparar(T("dias", "baja_bien"), 45, 38, "sep").k, "mal");
  assert.strictEqual(R.comparar(T("dinero", "sube_mal"), 1500, 1000, "sep").k, "mal");
  assert.strictEqual(R.comparar(T("dinero", "sube_mal"), 500, 1000, "sep").k, "bien");
  assert.strictEqual(R.comparar(T("dinero", "sube_mal", true), 1500, 1000, "sep").k, "urg");
  assert.strictEqual(R.comparar(T("num", "neutral"), 40, 30, "sep").k, "normal");
});
check("textos: porcentaje, puntos, días, horas y signo menos real", () => {
  assert.strictEqual(R.comparar(T("dinero", "sube_bien"), 1180, 1000, "sep").texto, "+18 % vs sep");
  assert.strictEqual(R.comparar(T("pct", "sube_bien"), 75, 64, "sep").texto, "+11 pts vs sep");
  assert.strictEqual(R.comparar(T("dias", "baja_bien"), 38, 41, "sep").texto, "−3 días vs sep");
  assert.strictEqual(R.comparar(T("dias", "baja_bien"), 4, 5, "sep").texto, "−1 día vs sep");
  assert.strictEqual(R.comparar(T("horas", "baja_bien"), 14, 17, "sep").texto, "−3 h vs sep");
  assert.strictEqual(R.comparar(T("num", "sube_bien"), 4, 3, "sep").texto, "+1 vs sep");
  assert.strictEqual(R.comparar(T("dinero", "sube_bien"), 500, 0, "sep").texto, "desde cero vs sep");
  assert.strictEqual(R.comparar(T("dinero", "sube_bien"), null, 10, "sep").k, "na");
});

console.log("Filtros");
check("Herramienta filtra Cobranza, Cotizaciones, Solicitudes y Grupos; Clientes queda «SIN FILTRAR»", () => {
  const r = calc({ herramienta: "powerbi" });
  assert.strictEqual(tarjeta(r, "cobranza", "por_cobrar").valor, 3000);
  assert.strictEqual(tarjeta(r, "cotizaciones", "ganado").valor, 6000);
  assert.strictEqual(tarjeta(r, "grupos", "gru_activos").valor, 1);
  const cli = r.secciones.find((s) => s.id === "clientes");
  assert.strictEqual(cli.sinFiltrar, true); assert.ok(/Herramienta: no aplica a Clientes/.test(cli.nota));
  for (const s of r.secciones.filter((x) => x.id !== "clientes")) assert.strictEqual(s.sinFiltrar, false, s.id);
  assert.strictEqual(tarjeta(r, "clientes", "cli_total").valor, 4); // el valor no se inventa ni se filtra
});
check("la herramienta deja fuera las cuentas manuales sin cotización ni grupo, y lo avisa", () => {
  const r = calc({ herramienta: "excel", mes: "todo" });
  assert.strictEqual(tarjeta(r, "cobranza", "por_cobrar").valor, 0 + 0); // la de 3000 es de powerbi, la de 400 no tiene herramienta
  assert.ok(/sin cotización ni grupo/.test(r.secciones[0].nota));
});
check("Estrategia solo existe en Cobranza: las otras 4 secciones se marcan «SIN FILTRAR»", () => {
  const r = calc({ estrategia: "abiertos" });
  assert.strictEqual(tarjeta(r, "cobranza", "por_cobrar").valor, 0); // ninguna cuenta es de abiertos
  assert.deepStrictEqual(r.secciones.map((s) => s.sinFiltrar), [false, true, true, true, true]);
  assert.strictEqual(calc({}).secciones.some((s) => s.sinFiltrar), false);
});
check("Tipo de cliente filtra todo; Prospecto en Clientes da 0 (el Tracking no los cuenta)", () => {
  const r = calc({ tipoCliente: "Intermediario" });
  assert.strictEqual(tarjeta(r, "cotizaciones", "ganado").valor, 6000);
  assert.strictEqual(tarjeta(r, "clientes", "cli_total").valor, 1);
  assert.strictEqual(tarjeta(calc({ tipoCliente: "Prospecto" }), "clientes", "cli_total").valor, 0);
  assert.strictEqual(r.secciones.some((s) => s.sinFiltrar), false);
});
check("mes futuro o mal escrito cae en el mes en curso (sin lanzar)", () => {
  assert.strictEqual(calc({ mes: "2030-01" }).meta.mes, "2026-10");
  assert.strictEqual(calc({ mes: "xx" }).meta.mes, "2026-10");
});
check("sin datos: todo en nulo o cero, sin lanzar", () => {
  const r = calc({}, {}, { cuentas: [], cotizaciones: [], solicitudes: [], grupos: [], clientes: [] });
  assert.strictEqual(tarjeta(r, "cobranza", "por_cobrar").valor, 0);
  assert.strictEqual(tarjeta(r, "cotizaciones", "tasa").valor, null);
  assert.strictEqual(tarjeta(r, "cotizaciones", "tasa").cmp.k, "na");
});

console.log("Fotos del momento");
check("sin fotos: píldora «estado de hoy» con el valor vivo", () => {
  const t = tarjeta(calc({}), "grupos", "gru_activos");
  assert.strictEqual(t.valor, 2); assert.strictEqual(t.cmp.k, "hoy"); assert.strictEqual(t.cmp.texto, "estado de hoy"); assert.strictEqual(t.cmp.ic, "reloj");
});
check("con la foto del mes anterior ya hay comparación y línea", () => {
  const foto = R.fotoDelDia(datosBase());
  foto[""+"|"].gru_activos = 1; // el 20 de sep había 1 grupo activo
  const r = calc({}, { fotos: [{ fecha: "2026-09-20", datos: foto }] });
  const t = tarjeta(r, "grupos", "gru_activos");
  assert.strictEqual(t.valor, 2); assert.strictEqual(t.cmp.ic, "sube"); assert.strictEqual(t.cmp.texto, "+1 vs sep");
  assert.strictEqual(t.serie.find((p) => p.mes === "2026-09").v, 1);
  assert.strictEqual(t.serie[t.serie.length - 1].v, 2);
});
check("una foto posterior al corte del mes anterior no se usa para comparar", () => {
  const foto = R.fotoDelDia(datosBase());
  const r = calc({}, { fotos: [{ fecha: "2026-09-30", datos: foto }] });
  assert.strictEqual(tarjeta(r, "grupos", "gru_activos").cmp.k, "hoy");
});
check("la foto guarda cada combinación de tipo × herramienta (filtros con historia)", () => {
  const foto = R.fotoDelDia(datosBase());
  assert.strictEqual(Object.keys(foto).length, 5 * 7);
  assert.strictEqual(foto["|powerbi"].gru_activos, 1);
  assert.strictEqual(foto["Intermediario|"].pipeline, 0);
  assert.deepStrictEqual(Object.keys(foto["|"]).sort(), [...R.IDS_FOTO].sort());
});
check("mes pasado sin foto: «sin foto de ese mes», no inventa", () => {
  const t = tarjeta(calc({ mes: "2026-09" }), "grupos", "gru_activos");
  assert.strictEqual(t.valor, null); assert.strictEqual(t.cmp.k, "na");
});

console.log("Foto diaria (Table Storage)");
const tablaFalsa = () => {
  const filas = new Map();
  return {
    filas,
    async createEntity(e) { if (filas.has(e.rowKey)) throw Object.assign(new Error("existe"), { statusCode: 409 }); filas.set(e.rowKey, e); },
    async *listEntities({ queryOptions }) { const m = /RowKey ge '([^']+)'/.exec(queryOptions.filter); for (const e of filas.values()) if (e.rowKey >= m[1]) yield e; },
  };
};
(async () => {
  await checkAsync("idempotente: una por día; la segunda apertura no la sobrescribe", async () => {
    const t = tablaFalsa();
    assert.strictEqual(await F.guardarFotoDelDia("2026-10-28", { a: 1 }, t), true);
    assert.strictEqual(await F.guardarFotoDelDia("2026-10-28", { a: 2 }, t), false);
    assert.strictEqual(JSON.parse(t.filas.get("2026-10-28").datos).a, 1);
  });
  await checkAsync("leerFotos regresa las del rango; una dañada se ignora; nunca lanza", async () => {
    const t = tablaFalsa();
    await F.guardarFotoDelDia("2026-09-01", { a: 1 }, t); await F.guardarFotoDelDia("2026-10-01", { a: 2 }, t);
    t.filas.set("2026-10-02", { rowKey: "2026-10-02", datos: "{roto" });
    const f = await F.leerFotos("2026-09-15", t);
    assert.deepStrictEqual(f, [{ fecha: "2026-10-01", datos: { a: 2 } }]);
    assert.deepStrictEqual(await F.leerFotos("2026-01-01", { listEntities() { throw new Error("caída"); } }), []);
    assert.strictEqual(await F.guardarFotoDelDia("2026-10-28", {}, { createEntity() { throw new Error("caída"); } }), false);
  });
  console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : "\nTodas las pruebas del Dashboard → Resumen pasaron.");
  process.exit(fallos ? 1 : 0);
})();
