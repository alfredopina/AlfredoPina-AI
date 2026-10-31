// api/src/dashboard-dinero.js
// Dashboard → Resumen (v2, 2026-10-31): el dinero del negocio en tres vistas — Flujo de Venta y Cobranza · Por vender y por cobrar ·
// Oportunidades no cerradas. TODO son SUBTOTALES SIN IVA. Lógica PURA (sin SQL ni red): dashboard-resumen-db.js carga las filas.
//
// Por qué se reutiliza dashboard-resumen.js: las cuentas por cobrar se reconstruyen a cualquier fecha (filasEn) y se pasan por la MISMA
// cobranza.resumir que usa el Tracking; solo se les cambia la base de total a subtotal (cada pago se escala por subtotal/total), así
// "Por cobrar", "Vencido" y "Cobrado" cuadran con Cobranza pero sin IVA ni retenciones.
//
// Clases de cifra:
//   flujo  → lo ocurrido DENTRO del mes: Cotizado, Ganado, Facturado, Cobrado, Perdido
//   stock  → cómo estaba todo AL FINAL del mes (reconstruido por fechas): Pipeline, Por facturar, Por cobrar, Vencido
// Para el mes en curso TODO se corta en el mismo día de hoy y cada mes anterior se mide al mismo corte (comparación justa); la serie de
// 12 meses y la meta (promedio de esos meses) usan ese mismo corte.
const C = require("./cobranza");
const { representantes } = require("./cotizacion-alternativas");
const D = require("./dashboard-resumen");
const { filasAhora, filasEn, pasa, mesIdx, inicioMes, claveMes, etiquetaMes, fechaMty, enVentana, redondea, MES_CORTO, diaMs, TZ } = D;

const CLAVES = ["cot", "gan", "fac", "cob", "pip", "gpf", "pxc", "plz", "ven", "per"];
const NO_ENVIADAS = ["Borrador", "Reemplazada"]; // un Borrador nunca salió; una Reemplazada la sustituye otra versión que sí cuenta
const ABIERTAS = ["Enviada", "En negociación"];
const suma = (a) => redondea(a.reduce((x, c) => x + (Number(c.precio) || 0), 0), 2);

// cuentas con base subtotal: el total pasa a ser el subtotal y cada pago se escala por la misma razón (subtotal / total)
function enSubtotal(cuentas) {
  return cuentas.map((c) => {
    const k = c.total > 0 && c.subtotal >= 0 ? c.subtotal / c.total : 1;
    return { ...c, total: c.subtotal >= 0 ? c.subtotal : c.total, pagos: c.pagos.map((p) => ({ ...p, monto: Number(p.monto) * k })) };
  });
}

// ── Cotizaciones ──
const filtraCot = (datos, f) => datos.cotizaciones.filter((c) => pasa(f, { tipo: c.tipo, herr: c.herr }, { tipo: true, herr: true }));
// una oportunidad con alternativas cuenta UNA vez, con su monto más alto (misma regla que el Pipeline)
const unaPorGrupo = (rows) => representantes(rows.map((c) => ({ id: c.id, alternativa_grupo: c.alt, precio_final: c.precio }))).reduce((a, c) => a + Number(c.precio_final || 0), 0);
function cotizado(rows, v) {
  return redondea(unaPorGrupo(rows.filter((c) => !NO_ENVIADAS.includes(c.estatus) && enVentana(c.enviada, v))), 2);
}
// abierta en el instante T: ya había salido y todavía no se cerraba (Enviada/En negociación nunca se han cerrado)
function pipelineEn(rows, T) {
  const abiertas = rows.filter((c) => {
    if (NO_ENVIADAS.includes(c.estatus) || c.enviada == null || c.enviada >= T) return false;
    if (ABIERTAS.includes(c.estatus)) return true;
    return c.cierre != null && c.cierre >= T;
  });
  return redondea(unaPorGrupo(abiertas), 2);
}
const cerradas = (rows, estatus, v) => rows.filter((c) => c.estatus === estatus && enVentana(c.cierre, v));

// ── Cuentas ──
function facturado(cuentas, v) {
  let t = 0;
  for (const c of cuentas) {
    if (c.estatus === "Cancelada" || !C.cuentaEnMetricas({ tipo_factura: c.tipo_factura })) continue;
    const em = c.emision ? diaMs(c.emision) : c.estatus === "Por facturar" ? null : c.creada; // facturada sin fecha: cuenta desde que se creó
    if (enVentana(em, v)) t += c.total;
  }
  return redondea(t, 2);
}
function calcCuentas(cuentas, v, ahora, umbral) {
  const filas = ahora ? filasAhora(cuentas, (v.ref != null ? v.ref : v.hasta) - 1 - TZ, umbral) : filasEn(cuentas, v.hasta, umbral);
  const rango = { desde: v.desde == null ? null : new Date(v.desde).toISOString(), hasta: v.hasta == null ? null : new Date(v.hasta).toISOString() };
  return C.resumir(filas, rango);
}

// ── Un periodo completo (las 10 cifras) ──
function valoresDe(datos, f, cuentasSub, v, ahora, umbral) {
  const cuentas = cuentasSub.filter((c) => pasa(f, { tipo: c.tipo, herr: c.herrs, estrategia: c.estrategia }, { tipo: true, herr: true, estrategia: true }));
  const cots = filtraCot(datos, f);
  const r = calcCuentas(cuentas, v, ahora, umbral);
  const corte = v.hasta == null ? v.ref : v.hasta;
  return {
    cot: cotizado(cots, v),
    gan: suma(cerradas(cots, "Ganada", v)),
    fac: facturado(cuentas, v),
    cob: r.cobrado,
    pip: pipelineEn(cots, corte),
    gpf: r.por_facturar,
    pxc: r.por_cobrar,
    plz: redondea(r.por_cobrar - r.vencido, 2),
    ven: r.vencido,
    per: suma(cerradas(cots, "Perdida", v)),
  };
}

function motivosDe(datos, f, v) {
  const rows = cerradas(filtraCot(datos, f), "Perdida", v);
  const por = new Map();
  for (const c of rows) { const m = c.motivo || "Sin motivo"; por.set(m, (por.get(m) || 0) + (Number(c.precio) || 0)); }
  const total = [...por.values()].reduce((a, b) => a + b, 0);
  return [...por.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([motivo, monto]) => ({ motivo, monto: redondea(monto, 2), pct: total ? Math.round((monto / total) * 100) : 0 }));
}

// filtros: { mes: "2026-10" | "todo" | "", estrategia, tipoCliente, herramienta }  ·  opciones: { ahora: Date, umbralPorVencer }
function calcularDinero(datos, filtros, { ahora = new Date(), umbralPorVencer = C.POR_VENCER_DEFAULT } = {}) {
  const f = { estrategia: filtros.estrategia || "", tipoCliente: filtros.tipoCliente || "", herramienta: filtros.herramienta || "" };
  const ahoraMs = ahora.getTime(), kHoy = mesIdx(ahoraMs);
  const hoy = new Date(ahoraMs - TZ), diaHoy = hoy.getUTCDate();
  const todo = filtros.mes === "todo";
  let M = kHoy;
  const m = /^(\d{4})-(\d{2})$/.exec(filtros.mes || "");
  if (m) M = Math.min(kHoy, +m[1] * 12 + (+m[2] - 1));
  const esActual = M === kHoy;
  const finDeHoy = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), diaHoy + 1, 6);
  const cuentasSub = enSubtotal(datos.cuentas);

  // primer mes con datos: antes de él no hay con qué comparar (ni línea ni promedio)
  const fechas = [];
  const pon = (x) => { if (x != null && isFinite(x)) fechas.push(x); };
  datos.cuentas.forEach((c) => { pon(c.emision ? diaMs(c.emision) : c.creada); c.pagos.forEach((p) => pon(p.fecha ? diaMs(p.fecha) : p.creada)); });
  datos.cotizaciones.forEach((c) => { pon(c.enviada); pon(c.cierre); });
  const kPrimero = fechas.length ? Math.min(...fechas.map(mesIdx)) : M;

  // ventana del mes k: completa, salvo el mes en curso (hasta el fin de hoy); los meses que se comparan con él van al mismo corte
  const ventana = (k, corteDia) => {
    const fin = inicioMes(k + 1);
    return { desde: inicioMes(k), hasta: corteDia ? Math.min(fin, Date.UTC(Math.floor(k / 12), k % 12, corteDia + 1, 6)) : fin };
  };
  const corte = esActual && !todo ? diaHoy : 0;
  const punto = (k) => (k < kPrimero ? null : valoresDe(datos, f, cuentasSub, ventana(k, corte), false, umbralPorVencer));

  const filas = {};
  if (todo) {
    const vals = valoresDe(datos, f, cuentasSub, { desde: null, hasta: null, ref: finDeHoy }, true, umbralPorVencer);
    for (const k of CLAVES) filas[k] = { cur: vals[k], ref: { mes: null, p3: null, anio: null }, serie: [], meta: null };
  } else {
    // el mes que se mira: si es el actual, con las filas de hoy (igual que el Tracking); si es pasado, reconstruido a fin de mes
    const cur = valoresDe(datos, f, cuentasSub, ventana(M, corte), esActual, umbralPorVencer);
    const serieVals = [];
    for (let k = M - 11; k <= M; k++) serieVals.push({ k, vals: k === M ? cur : punto(k) });
    const ant = [1, 2, 3].map((i) => serieVals.find((s) => s.k === M - i)).filter((s) => s && s.vals);
    const anioVals = punto(M - 12);
    for (const k of CLAVES) {
      const serie = serieVals.map((s) => ({ mes: claveMes(s.k), v: s.vals ? s.vals[k] : null }));
      const conDato = serie.filter((s) => s.v != null);
      const prevMes = serieVals.find((s) => s.k === M - 1);
      filas[k] = {
        cur: cur[k],
        ref: {
          mes: prevMes && prevMes.vals ? prevMes.vals[k] : null,
          p3: ant.length ? redondea(ant.reduce((a, s) => a + s.vals[k], 0) / ant.length, 2) : null,
          anio: anioVals ? anioVals[k] : null,
        },
        serie,
        meta: conDato.length >= 3 ? redondea(conDato.reduce((a, s) => a + s.v, 0) / conDato.length, 2) : null, // por ahora: promedio de los 12 meses
      };
    }
  }

  const motivos = todo ? motivosDe(datos, f, { desde: null, hasta: null }) : motivosDe(datos, f, ventana(M, corte));
  const sinFiltrar = [];
  const notas = [];
  if (f.estrategia) { sinFiltrar.push("cot", "gan", "pip", "per"); notas.push("Estrategia: solo se registra en Cobranza; Cotizado, Ganado, Pipeline y Perdido no se filtran por ella"); }
  if (f.herramienta) notas.push("Herramienta: las cuentas manuales sin cotización ni grupo no se incluyen");

  const meses = [];
  for (let k = kHoy; k >= Math.min(kPrimero, kHoy); k--) meses.push({ valor: claveMes(k), etiqueta: etiquetaMes(k) });
  return {
    meta: {
      mes: todo ? "todo" : claveMes(M), etiquetaMes: todo ? "Todo el historial" : etiquetaMes(M), esActual: esActual && !todo, todo,
      corteDia: esActual && !todo ? diaHoy : null, hoy: fechaMty(ahoraMs), meses, filtros: f, sinFiltrar, notas,
      refs: { mes: todo ? null : MES_CORTO[(M - 1 + 1200) % 12], p3: todo ? null : "prom. 3 m", anio: todo ? null : MES_CORTO[M % 12] + " " + String(Math.floor(M / 12) - 1).slice(2), mesAnioClave: todo ? null : claveMes(M - 12) },
    },
    filas,
    motivos,
  };
}

module.exports = { calcularDinero, enSubtotal, cotizado, pipelineEn, facturado, motivosDe, CLAVES };
