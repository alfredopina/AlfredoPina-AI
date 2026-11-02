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

const CLAVES = ["sol", "cot", "gan", "fac", "cob", "pip", "gpf", "pxc", "plz", "ven", "per"]; // sol = cantidad de solicitudes; el resto, pesos sin IVA
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

// ── Solicitudes (cantidad) ── "atendida" = ya no está en Nueva (la misma regla del Tracking de Solicitudes)
function solicitudesDe(datos, f, v) {
  const rows = (datos.solicitudes || []).filter((s) => pasa(f, { tipo: s.tipo, herr: s.herr }, { tipo: true, herr: true }) && enVentana(s.creada, v));
  const aten = rows.filter((s) => s.estatus !== "Nueva");
  return { total: rows.length, atendidas: aten.length, sitio: aten.filter((s) => s.canal === "Sitio").length, manual: aten.filter((s) => s.canal === "Manual").length };
}

// ── Cuentas ──
const emisionDe = (c) => (c.emision ? diaMs(c.emision) : c.estatus === "Por facturar" ? null : c.creada); // facturada sin fecha: cuenta desde que se creó
const cuentaFacturable = (c) => c.estatus !== "Cancelada" && C.cuentaEnMetricas({ tipo_factura: c.tipo_factura });
function facturado(cuentas, v) {
  let t = 0;
  for (const c of cuentas) {
    if (!cuentaFacturable(c)) continue;
    if (enVentana(emisionDe(c), v)) t += c.total;
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
    sol: solicitudesDe(datos, f, v).total,
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

// ── Desgloses del embudo (barras apiladas) ──
// Cada barra se reparte en DÓNDE ESTÁ HOY ese dinero (cohorte: lo cotizado/facturado en el mes, según su estado de hoy), así que la suma
// de los segmentos es exactamente el total de la barra. Ganado y Cobrado son lo ocurrido en el mes.
// Cotizado: por TIPO DE SERVICIO (curso estándar · personalizado · consultoría), con cuántas cotizaciones (oportunidades) son y su monto. Un grupo de
// alternativas cuenta UNA vez con su monto más alto (igual que cotizado()) y su tipo es el de esa cotización de monto más alto.
const TIPOS_SERVICIO = ["estandar", "personalizado", "consultoria"];
function cohorteCotizado(rows, v) {
  const grupos = new Map();
  for (const c of rows.filter((x) => !NO_ENVIADAS.includes(x.estatus) && enVentana(x.enviada, v))) {
    const k = c.alt != null ? "a" + c.alt : "i" + c.id;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(c);
  }
  const seg = Object.fromEntries(TIPOS_SERVICIO.map((t) => [t, { monto: 0, n: 0 }]));
  for (const g of grupos.values()) {
    const mejor = g.reduce((a, c) => ((Number(c.precio) || 0) > (Number(a.precio) || 0) ? c : a), g[0]);
    const t = TIPOS_SERVICIO.includes(mejor.tt) ? mejor.tt : "estandar";
    seg[t].monto += Number(mejor.precio) || 0; seg[t].n++;
  }
  for (const t of TIPOS_SERVICIO) seg[t].monto = redondea(seg[t].monto, 2);
  return seg;
}
// Ganado (cerrado en el mes): lo que ya tiene factura vs lo que sigue Por facturar. La cuenta apunta a su cotización (cotizacion_id);
// sin cuenta, o con la cuenta cancelada o aún "Por facturar", cuenta como Por facturar.
function ganadoFacturado(cots, cuentas, v) {
  const facturadas = new Set(cuentas.filter((c) => c.cotId != null && c.estatus !== "Cancelada" && (c.emision || c.estatus !== "Por facturar")).map((c) => c.cotId));
  const ganadas = cerradas(cots, "Ganada", v);
  return { facturado: suma(ganadas.filter((c) => facturadas.has(c.id))), porFacturar: suma(ganadas.filter((c) => !facturadas.has(c.id))) };
}
// Facturado (emitido en el mes): ya cobrado · en plazo · vencido, según el saldo y el semáforo de HOY (misma regla del Tracking)
function desgloseFacturado(cuentas, v, ahoraMs, umbral) {
  const o = { cobrado: 0, plazo: 0, vencido: 0 };
  for (const c of cuentas) {
    if (!cuentaFacturable(c) || !enVentana(emisionDe(c), v)) continue;
    const fila = filasAhora([c], ahoraMs, umbral)[0];
    const saldo = Math.max(0, Math.min(c.total, fila.saldo));
    o.cobrado += c.total - saldo;
    if (fila.semaforo.clave === "vencida") o.vencido += saldo; else o.plazo += saldo;
  }
  return { cobrado: redondea(o.cobrado, 2), plazo: redondea(o.plazo, 2), vencido: redondea(o.vencido, 2) };
}
// Cobrado (pagos del mes): los de facturas emitidas este mismo mes y los de meses anteriores (suman exactamente el cobrado del periodo)
function desgloseCobrado(cuentas, v, cobrado) {
  let t = 0;
  for (const c of cuentas) {
    if (c.estatus === "Cancelada" || !enVentana(emisionDe(c), v)) continue;
    for (const p of c.pagos) if (!p.anulado && enVentana(p.fecha ? diaMs(p.fecha) : p.creada, v)) t += Number(p.monto) || 0;
  }
  const delMes = Math.min(cobrado, redondea(t, 2));
  return { delMes: redondea(delMes, 2), anteriores: redondea(cobrado - delMes, 2) };
}

function motivosDe(datos, f, v) {
  const rows = cerradas(filtraCot(datos, f), "Perdida", v);
  const por = new Map();
  for (const c of rows) { const m = c.motivo || "Sin motivo"; por.set(m, (por.get(m) || 0) + (Number(c.precio) || 0)); }
  const total = [...por.values()].reduce((a, b) => a + b, 0);
  return [...por.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([motivo, monto]) => ({ motivo, monto: redondea(monto, 2), pct: total ? Math.round((monto / total) * 100) : 0 }));
}

// filtros: { mes: "2026-10" | "todo" | "", estrategia, tipoCliente, herramienta }  ·  opciones: { ahora: Date, umbralPorVencer }
// metas: { cot, gan, cob } = metas mensuales de Configuración → Metas (monto del mes completo, sin IVA); una fila sin meta propia usa el promedio
function calcularDinero(datos, filtros, { ahora = new Date(), umbralPorVencer = C.POR_VENCER_DEFAULT, metas = {} } = {}) {
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
  (datos.solicitudes || []).forEach((s) => pon(s.creada));
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
    for (const k of CLAVES) filas[k] = { cur: vals[k], ref: { mes: null, p3: null, anio: null }, serie: [], serieFull: [], meta: null, metaFull: null, metaOrigen: "promedio" };
  } else {
    // el mes que se mira: si es el actual, con las filas de hoy (igual que el Tracking); si es pasado, reconstruido a fin de mes
    const cur = valoresDe(datos, f, cuentasSub, ventana(M, corte), esActual, umbralPorVencer);
    const serieVals = [];
    for (let k = M - 11; k <= M; k++) serieVals.push({ k, vals: k === M ? cur : punto(k) });
    const ant = [1, 2, 3].map((i) => serieVals.find((s) => s.k === M - i)).filter((s) => s && s.vals);
    const anioVals = punto(M - 12);
    // línea de 12 meses (sparkline): meses COMPLETOS y, al final, el mes en curso con lo que lleva. Con el mismo corte para todos los meses la línea se
    // aplasta contra cero en los primeros días del mes; la barra, su meta de promedio y la variación siguen usando el mismo corte (comparación justa).
    const serieFullVals = esActual ? serieVals.map((s) => (s.k === M ? s : { k: s.k, vals: s.k < kPrimero ? null : valoresDe(datos, f, cuentasSub, ventana(s.k, 0), false, umbralPorVencer) })) : serieVals;
    for (const k of CLAVES) {
      const serie = serieVals.map((s) => ({ mes: claveMes(s.k), v: s.vals ? s.vals[k] : null }));
      const conDato = serie.filter((s) => s.v != null);
      const prevMes = serieVals.find((s) => s.k === M - 1);
      const serieFull = serieFullVals.map((s) => ({ mes: claveMes(s.k), v: s.vals ? s.vals[k] : null }));
      const completos = serieFull.slice(0, esActual ? -1 : undefined).filter((s) => s.v != null);
      const promedioDe = (a) => (a.length >= 3 ? redondea(a.reduce((x, s) => x + s.v, 0) / a.length, 2) : null);
      const kMeta = k === "fac" ? "gan" : k; // Facturado comparte la meta de Ganado (lo que ganas es lo que debes facturar)
      const propia = metas && typeof metas[kMeta] === "number" && isFinite(metas[kMeta]) && metas[kMeta] >= 0 ? metas[kMeta] : null;
      filas[k] = {
        cur: cur[k],
        ref: {
          mes: prevMes && prevMes.vals ? prevMes.vals[k] : null,
          p3: ant.length ? redondea(ant.reduce((a, s) => a + s.vals[k], 0) / ant.length, 2) : null,
          anio: anioVals ? anioVals[k] : null,
        },
        serie,
        // la meta propia (Configuración → Metas) es del mes completo; sin ella, el promedio de los 12 meses (mismo corte)
        meta: propia != null ? propia : promedioDe(conDato),
        metaOrigen: propia != null ? "propia" : "promedio",
        // para la línea de 12 meses: la serie de meses completos y su meta (la propia, o el promedio de los meses completos)
        serieFull, metaFull: propia != null ? propia : promedioDe(completos),
      };
    }
  }

  const motivos = todo ? motivosDe(datos, f, { desde: null, hasta: null }) : motivosDe(datos, f, ventana(M, corte));
  // desgloses del embudo para el periodo que se mira (ver cohorteCotizado y compañía)
  const vDes = todo ? { desde: null, hasta: null } : ventana(M, corte);
  const cotsF = filtraCot(datos, f);
  const cuentasF = cuentasSub.filter((c) => pasa(f, { tipo: c.tipo, herr: c.herrs, estrategia: c.estrategia }, { tipo: true, herr: true, estrategia: true }));
  const sl = solicitudesDe(datos, f, vDes), coh = cohorteCotizado(cotsF, vDes);
  const desglose = {
    sol: { atendidas: sl.atendidas, sin: sl.total - sl.atendidas, sitio: sl.sitio, manual: sl.manual },
    cot: coh,
    gan: ganadoFacturado(cotsF, datos.cuentas, vDes),
    fac: desgloseFacturado(cuentasF, vDes, ahoraMs, umbralPorVencer),
    cob: todo ? null : desgloseCobrado(cuentasF, vDes, filas.cob.cur),
  };
  const sinFiltrar = [];
  const notas = [];
  if (f.estrategia) { sinFiltrar.push("sol", "cot", "gan", "pip", "per"); notas.push("Estrategia: solo se registra en Cobranza; Solicitudes, Cotizado, Ganado y Por vender no se filtran por ella"); }
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
    desglose,
  };
}

module.exports = { calcularDinero, enSubtotal, cotizado, pipelineEn, facturado, motivosDe, filtraCot, cuentaFacturable, ABIERTAS, NO_ENVIADAS, CLAVES };
