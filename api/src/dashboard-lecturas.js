// api/src/dashboard-lecturas.js
// Dashboard → Resumen: BIBLIOTECA DE REGLAS de las lecturas (los "insights"). Cada regla mira los datos, decide si APLICA hoy, qué tan urgente es y,
// cuando sirve, cita NOMBRES (clientes, folios, días). El sistema evalúa todas las reglas y muestra las 3 de mayor peso, con a lo más 2 de una misma
// etapa; así las lecturas cambian con la situación del negocio (nada fijo) y siempre dicen algo accionable.
// Lógica PURA (sin SQL ni red): recibe los mismos datos que calcularDinero y su resultado. Una regla que falle NUNCA rompe el Resumen: se omite.
// Texto: **negritas** como marca (la pantalla las convierte después de escapar el HTML).
//
// Cada regla: { id, etapa, cuando: ["actual" | "pasado" | "todo"], run(x) → null | { tipo: "urg" | "alerta" | "info" | "bien", peso, texto, items? } }
//   · actual = se mira el mes en curso (se habla de HOY: pipeline, cartera, proyección) · pasado = un mes ya cerrado · todo = el acumulado
//   · peso = ajuste de 0 a ~30 sobre la base de su tipo (urg 90 · alerta 60 · info 35 · bien 20): mientras más grave o más grande, más peso
const D = require("./dashboard-resumen");
const { filasAhora, diaMs, TZ, pasa } = D;
const { enSubtotal, filtraCot, ABIERTAS, NO_ENVIADAS, cuentaFacturable } = require("./dashboard-dinero");

const DIA = 86400000;
const BASE = { urg: 90, alerta: 60, info: 35, bien: 20 };
const ETAPAS = { sol: "SOLICITUDES", cot: "COTIZADO", gan: "VENDIDO", fac: "FACTURADO", cob: "COBRADO" };
const PANEL = { sol: "tracking-comercial", cot: "tracking-comercial", gan: "tracking-comercial", fac: "cobranza", cob: "cobranza" };
const ACCION = { "tracking-comercial": "Cotizaciones →", cobranza: "Cobranza →" };
const TIP_MOTIVO = { "Precio alto": "Revisa tarifas y ofrece alternativas.", "Sin respuesta": "Más seguimiento en los primeros 7 días.", "Otro proveedor": "Revisa qué ofreció la competencia.", "Sin presupuesto": "Ofrece una versión más corta o por etapas.", "Cambio de prioridad": "Agenda un seguimiento para retomarlo.", "Más adelante": "Agenda un seguimiento para retomarlo.", "Curso interno": "Ofrece apoyo a su equipo interno." };
const TIPO_NOMBRE = { estandar: "cursos estándar", personalizado: "cursos personalizados", consultoria: "consultoría" };

const din = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const pct = (x) => Math.round(x * 100);
const plural = (n, uno, varios) => n + " " + (n === 1 ? uno : varios);
const nombre = (s) => (s && String(s).trim()) || "Sin nombre";
const sumar = (a, f) => a.reduce((t, o) => t + (f(o) || 0), 0);
const top = (a, f, n = 3) => a.slice().sort((x, y) => f(y) - f(x)).slice(0, n);
const diasDe = (desdeMs, hastaMs) => Math.floor((hastaMs - desdeMs) / DIA);
const entreFechas = (a, b) => Math.round((diaMs(b) - diaMs(a)) / DIA); // "YYYY-MM-DD" → días

// ── el contexto que ven todas las reglas ──
function contexto(datos, r, { ahora, umbrales }) {
  const f = r.meta.filtros, ahoraMs = ahora.getTime();
  const hoy = new Date(ahoraMs - TZ);
  const finDeHoy = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + 1, 6);
  const cuentas = enSubtotal(datos.cuentas).filter((c) => pasa(f, { tipo: c.tipo, herr: c.herrs, estrategia: c.estrategia }, { tipo: true, herr: true, estrategia: true }));
  const filas = filasAhora(cuentas, finDeHoy - 1 - TZ, umbrales.cobranzaPorVencerDias);
  // cuentas por cobrar vivas (facturadas, con saldo, sin las canceladas ni las de terceros): cada una con su fila de Cobranza
  const vivas = cuentas.map((c, i) => ({ c, fila: filas[i] })).filter(({ c, fila }) => c.estatus !== "Por facturar" && cuentaFacturable(c) && fila.saldo > 0);
  const [anio, mes] = String(r.meta.mes).split("-").map(Number);
  const diasMes = r.meta.todo ? 30 : new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return {
    r, F: r.filas, D: r.desglose, m: r.meta, ahoraMs, umbrales, datos, f,
    cots: filtraCot(datos, f), cuentas, filas, vivas,
    sols: (datos.solicitudes || []).filter((s) => pasa(f, { tipo: s.tipo, herr: s.herr }, { tipo: true, herr: true })),
    diasMes, diaHoy: r.meta.corteDia || 0, restantes: Math.max(0, diasMes - (r.meta.corteDia || 0)),
    finMes: r.meta.todo ? null : anio + "-" + String(mes).padStart(2, "0") + "-" + String(diasMes).padStart(2, "0"),
  };
}

// tasa de cierre (por cantidad) de lo cerrado en los últimos N días: { g: ganadas, n: cerradas, tasa }
function cierres(x, dias, filtro = () => true) {
  const desde = x.ahoraMs - dias * DIA;
  const cer = x.cots.filter((c) => (c.estatus === "Ganada" || c.estatus === "Perdida") && c.cierre != null && c.cierre >= desde && c.cierre <= x.ahoraMs && filtro(c));
  const g = cer.filter((c) => c.estatus === "Ganada").length;
  return { g, n: cer.length, tasa: cer.length ? g / cer.length : null, cer };
}
const nCot = (x) => x.D.cot.estandar.n + x.D.cot.personalizado.n + x.D.cot.consultoria.n;
const meta = (f) => (f.metaOrigen === "propia" ? "tu meta" : "tu promedio de 12 meses");

// ═══════════════ LA BIBLIOTECA ═══════════════
const REGLAS = [
  // ── COTIZADO ──
  { id: "proyeccion-cotizado", etapa: "cot", cuando: ["actual"], run(x) {
    const f = x.F.cot;
    if (f.meta == null) return null;
    if (f.cur >= f.meta) return { tipo: "bien", peso: 6, texto: `Ya rebasaste tu meta de **Cotizado**: **${din(f.cur)}** contra **${din(f.meta)}** y ${x.restantes ? "todavía quedan " + plural(x.restantes, "día", "días") : "hoy es el último día"}. Lo que cotizas hoy es lo que vendes de aquí a 3 a 6 semanas: no frenes el ritmo.` };
    if (x.diaHoy < 3) return null;
    const proy = f.cur / x.diaHoy * x.diasMes, falta = f.meta - f.cur, n = nCot(x), ticket = n ? f.cur / n : null, k = ticket ? Math.ceil(falta / ticket) : null;
    const llega = proy >= f.meta;
    return { tipo: llega ? "info" : "alerta", peso: llega ? 0 : Math.round(Math.min(30, (f.meta - proy) / f.meta * 60)),
      texto: `Al ritmo actual cierras el mes en **${din(proy)}** contra ${meta(f)} de **${din(f.meta)}**.` + (llega ? " Vas a llegar: mantén el ritmo."
        : ` Te faltan **${din(falta)}** cotizados` + (k ? `, unas **${plural(k, "cotización", "cotizaciones")}** de tu ticket promedio (${din(ticket)})` : "") + (x.restantes ? ` en ${plural(x.restantes, "día", "días")}.` : " y hoy es el último día.")) };
  } },
  { id: "seguimiento-cotizaciones", etapa: "cot", cuando: ["actual"], run(x) {
    const seg = x.umbrales.cotizacionesSeguimientoDias || 6, urg = x.umbrales.cotizacionesDias || 10;
    const ab = x.cots.filter((c) => ABIERTAS.includes(c.estatus) && c.enviada != null).map((c) => ({ c, d: diasDe(c.enviada, x.ahoraMs) })).filter((o) => o.d >= seg);
    if (!ab.length) return null;
    const total = sumar(ab, (o) => o.c.precio), max = Math.max(...ab.map((o) => o.d));
    return { tipo: max >= urg ? "urg" : "alerta", peso: Math.min(18, ab.length * 3),
      texto: `**${plural(ab.length, "cotización lleva", "cotizaciones llevan")}** más de **${seg} días** abiertas (**${din(total)}**); la más antigua lleva **${max} días**. Es donde se te atora la venta: dales seguimiento hoy.`,
      items: top(ab, (o) => o.c.precio).map((o) => `${nombre(o.c.cli)} · ${din(o.c.precio)} · ${o.d} días${o.c.folio ? " · " + o.c.folio : ""}`) };
  } },
  { id: "cobertura-pipeline", etapa: "gan", cuando: ["actual"], run(x) {
    const mg = x.F.gan.meta;
    if (mg == null) return null;
    const falta = mg - x.F.gan.cur;
    if (falta <= 0) return { tipo: "bien", peso: 5, texto: `Ya cumpliste tu meta de **Vendido**: **${din(x.F.gan.cur)}** contra **${din(mg)}**. Lo que siga cerrando este mes es ganancia sobre la meta.` };
    const c = cierres(x, 90);
    if (c.n < 4) return null;
    const esperado = x.F.pip.cur * c.tasa, cob = esperado / falta;
    return { tipo: cob >= 1 ? "bien" : "alerta", peso: cob >= 1 ? 0 : Math.round(Math.min(30, (1 - cob) * 30)),
      texto: `Por vender **${din(x.F.pip.cur)}**. Con tu cierre de **${pct(c.tasa)} %** (${c.g} de ${c.n} en 90 días) traería ≈ **${din(esperado)}**: ${cob >= 1 ? "cubre lo que te falta" : `cubre **${pct(cob)} %** de los **${din(falta)}** que te faltan`} para tu meta de Vendido.` + (cob >= 1 ? "" : " Hace falta más cotización o más cierre.") };
  } },
  { id: "cierre-por-tipo", etapa: "cot", cuando: ["actual"], run(x) {
    const c = cierres(x, 90), por = {};
    for (const o of c.cer) { const t = o.tt || "estandar"; (por[t] = por[t] || { g: 0, n: 0 }).n++; if (o.estatus === "Ganada") por[t].g++; }
    const lista = Object.entries(por).filter(([, v]) => v.n >= 3).map(([t, v]) => ({ t, ...v, tasa: v.g / v.n }));
    if (lista.length < 2) return null;
    lista.sort((a, b) => b.tasa - a.tasa);
    const mejor = lista[0], peor = lista[lista.length - 1];
    if (mejor.tasa - peor.tasa < 0.15) return null;
    return { tipo: "info", peso: Math.round((mejor.tasa - peor.tasa) * 20),
      texto: `En 90 días **${TIPO_NOMBRE[mejor.t]}** cierra **${pct(mejor.tasa)} %** (${mejor.g} de ${mejor.n}) y **${TIPO_NOMBRE[peor.t]}** **${pct(peor.tasa)} %** (${peor.g} de ${peor.n}). Cotiza más de lo que mejor te cierra, o revisa por qué ${TIPO_NOMBRE[peor.t]} se atora.` };
  } },
  { id: "descuentos-cierre", etapa: "cot", cuando: ["actual"], run(x) {
    const c = cierres(x, 180), alto = c.cer.filter((o) => (o.desc || 0) >= 15), bajo = c.cer.filter((o) => (o.desc || 0) < 15);
    if (alto.length < 4 || bajo.length < 4) return null;
    const ta = alto.filter((o) => o.estatus === "Ganada").length / alto.length, tb = bajo.filter((o) => o.estatus === "Ganada").length / bajo.length;
    if (ta > tb + 0.05) return null;
    return { tipo: "alerta", peso: 4, texto: `Las cotizaciones con descuento de **15 % o más** cierran **${pct(ta)} %** (${alto.length}) y las demás **${pct(tb)} %** (${bajo.length}) en 6 meses: ese descuento no te está ayudando a cerrar y sí recorta tu precio.` };
  } },
  { id: "motivo-perdida", etapa: "cot", cuando: ["actual"], run(x) {
    const perd = cierres(x, 90).cer.filter((o) => o.estatus === "Perdida");
    if (perd.length < 3) return null;
    const por = new Map();
    for (const o of perd) { const m = o.motivo || "Sin motivo"; const v = por.get(m) || { n: 0, monto: 0 }; v.n++; v.monto += o.precio; por.set(m, v); }
    const [motivo, v] = [...por.entries()].sort((a, b) => b[1].n - a[1].n)[0];
    if (v.n / perd.length < 0.4 || motivo === "Sin motivo") return null;
    return { tipo: "info", peso: 3, texto: `Pierdes sobre todo por **${motivo.toLowerCase()}** (${v.n} de ${perd.length} en 90 días, **${din(v.monto)}**).` + (TIP_MOTIVO[motivo] ? " " + TIP_MOTIVO[motivo] : "") };
  } },
  { id: "clientes-dormidos", etapa: "cot", cuando: ["actual"], run(x) {
    const por = new Map();
    for (const c of x.cots) {
      if (c.cliId == null || ["Prospecto", "Tercero"].includes(c.tipo)) continue;
      const v = por.get(c.cliId) || { cli: c.cli, ganado: 0, ultima: 0, abierta: false };
      if (c.estatus === "Ganada") v.ganado += c.precio;
      if (!NO_ENVIADAS.includes(c.estatus) && c.enviada != null) v.ultima = Math.max(v.ultima, c.enviada);
      if (ABIERTAS.includes(c.estatus)) v.abierta = true;
      por.set(c.cliId, v);
    }
    const dor = [...por.values()].filter((v) => v.ganado > 0 && !v.abierta && v.ultima && diasDe(v.ultima, x.ahoraMs) >= 180);
    if (!dor.length) return null;
    return { tipo: "info", peso: Math.min(10, dor.length), texto: `**${plural(dor.length, "cliente que ya te compró no recibe", "clientes que ya te compraron no reciben")}** una cotización desde hace más de 6 meses (**${din(sumar(dor, (v) => v.ganado))}** comprados en total). Reactivarlos es vender sin buscar clientes nuevos.`,
      items: top(dor, (v) => v.ganado).map((v) => `${nombre(v.cli)} · compró ${din(v.ganado)} · última cotización hace ${diasDe(v.ultima, x.ahoraMs)} días`) };
  } },
  { id: "concentracion-cotizado", etapa: "cot", cuando: ["actual", "pasado"], run(x) {
    const [a, mm] = x.m.mes.split("-").map(Number), k = a * 12 + (mm - 1), desde = D.inicioMes(k), hasta = D.inicioMes(k + 1);
    const filas = x.cots.filter((c) => !NO_ENVIADAS.includes(c.estatus) && c.enviada != null && c.enviada >= desde && c.enviada < hasta);
    if (filas.length < 3) return null;
    const por = new Map();
    for (const c of filas) { const v = por.get(c.cliId) || { cli: c.cli, m: 0 }; v.m += c.precio; por.set(c.cliId, v); }
    const total = sumar([...por.values()], (v) => v.m), mayor = [...por.values()].sort((a, b) => b.m - a.m)[0];
    if (!total || por.size < 2 || mayor.m / total < 0.5) return null;
    return { tipo: "info", peso: 2, texto: `**${nombre(mayor.cli)}** concentra **${pct(mayor.m / total)} %** de lo cotizado del mes (**${din(mayor.m)}** de ${din(total)}). Si se cae, se cae la mitad de tu mes: abre otros frentes.` };
  } },
  // ── SOLICITUDES ──
  { id: "solicitudes-sin-atender", etapa: "sol", cuando: ["actual"], run(x) {
    const seg = (x.umbrales.solicitudesSeguimientoHoras || 24) * 3600000, urg = (x.umbrales.solicitudesHoras || 72) * 3600000;
    const nv = x.sols.filter((s) => s.estatus === "Nueva" && s.creada != null && x.ahoraMs - s.creada >= seg).sort((a, b) => a.creada - b.creada);
    if (!nv.length) return null;
    const viejo = x.ahoraMs - nv[0].creada, d = Math.floor(viejo / DIA);
    return { tipo: viejo >= urg ? "urg" : "alerta", peso: Math.min(15, nv.length * 3),
      texto: `**${plural(nv.length, "solicitud sin atender", "solicitudes sin atender")}**; la más antigua lleva **${d >= 1 ? plural(d, "día", "días") : Math.floor(viejo / 3600000) + " horas"}**. Una solicitud sin cotizar es una venta que se enfría: cotízala hoy.`,
      items: nv.slice(0, 3).map((s) => `${nombre(s.cli)} · ${s.canal || "—"} · hace ${Math.max(1, Math.floor((x.ahoraMs - s.creada) / 3600000))} h`) };
  } },
  // ── FACTURADO ──
  { id: "por-facturar-edad", etapa: "fac", cuando: ["actual"], run(x) {
    const lis = x.cuentas.filter((c) => c.estatus === "Por facturar" && cuentaFacturable(c) && c.creada != null).map((c) => ({ c, d: diasDe(c.creada, x.ahoraMs) })).filter((o) => o.d >= 7);
    if (!lis.length) return null;
    const total = sumar(lis, (o) => o.c.total), max = Math.max(...lis.map((o) => o.d));
    return { tipo: max >= 14 ? "urg" : "alerta", peso: Math.min(20, Math.round(total / Math.max(1, x.F.gan.meta || total) * 40)),
      texto: `**${din(total)}** vendidos llevan **más de 7 días sin factura** (${plural(lis.length, "cuenta", "cuentas")}; la más antigua, **${max} días**). Cada día sin facturar es un día más tarde para cobrar.`,
      items: top(lis, (o) => o.c.total).map((o) => `${nombre(o.c.cli)} · ${din(o.c.total)} · ${o.d} días${o.c.concepto ? " · " + String(o.c.concepto).slice(0, 40) : ""}`) };
  } },
  { id: "vendido-sin-factura", etapa: "fac", cuando: ["actual", "pasado"], run(x) {
    const pf = x.D.gan.porFacturar, vend = x.F.gan.cur;
    if (!(pf > 0) || !(vend > 0)) return null;
    return { tipo: "alerta", peso: Math.round(Math.min(15, pf / vend * 15)), texto: `**${din(pf)}** de lo vendido en el mes (**${pct(pf / vend)} %**) sigue sin factura: es lo más rápido de convertir en efectivo, factúralo primero.` };
  } },
  // ── COBRADO ──
  { id: "vencidos-top", etapa: "cob", cuando: ["actual"], run(x) {
    const venc = x.vivas.filter(({ fila }) => fila.semaforo.clave === "vencida");
    if (!venc.length) return null;
    const total = sumar(venc, ({ fila }) => fila.saldo), p = x.F.pxc.cur ? total / x.F.pxc.cur : 0;
    const por = new Map();
    for (const { c, fila } of venc) { const v = por.get(c.cli) || { cli: c.cli, monto: 0, dias: 0 }; v.monto += fila.saldo; v.dias = Math.max(v.dias, fila.semaforo.dias); por.set(c.cli, v); }
    const lista = top([...por.values()], (v) => v.monto);
    return { tipo: p >= 0.2 ? "urg" : "alerta", peso: Math.round(Math.min(20, p * 40)),
      texto: `**${din(total)}** vencidos (**${pct(p)} %** de lo por cobrar) en ${plural(venc.length, "cuenta", "cuentas")}. Es el dinero que más urge perseguir.`,
      items: lista.map((v) => `${nombre(v.cli)} · ${din(v.monto)} · ${v.dias} días de atraso`) };
  } },
  { id: "calendario-cobro", etapa: "cob", cuando: ["actual"], run(x) {
    const prox = x.vivas.filter(({ fila }) => fila.semaforo.clave !== "vencida" && fila.semaforo.dias != null && fila.semaforo.dias <= 7);
    if (!prox.length) return null;
    const total = sumar(prox, ({ fila }) => fila.saldo);
    return { tipo: "info", peso: Math.min(10, Math.round(total / Math.max(1, x.F.cob.meta || total) * 20)),
      texto: `En los próximos **7 días** vencen **${din(total)}** (${plural(prox.length, "cuenta", "cuentas")}). Avísales antes de que venzan: cobrar a tiempo cuesta menos que perseguir después.`,
      items: top(prox, ({ fila }) => fila.saldo).map(({ c, fila }) => `${nombre(c.cli)} · ${din(fila.saldo)} · ${fila.semaforo.dias === 0 ? "vence hoy" : "vence en " + plural(fila.semaforo.dias, "día", "días")}`) };
  } },
  { id: "proyeccion-cobrado", etapa: "cob", cuando: ["actual"], run(x) {
    const f = x.F.cob;
    if (f.meta == null) return null;
    if (f.cur >= f.meta) return { tipo: "bien", peso: 6, texto: `Ya rebasaste tu meta de **Cobrado**: **${din(f.cur)}** contra **${din(f.meta)}**. Todo lo que entre de aquí a fin de mes es sobre la meta.` };
    const falta = f.meta - f.cur;
    const vencen = x.vivas.filter(({ c, fila }) => fila.semaforo.clave !== "vencida" && c.vencimiento && c.vencimiento <= x.finMes);
    const aMes = sumar(vencen, ({ fila }) => fila.saldo), yaVenc = sumar(x.vivas.filter(({ fila }) => fila.semaforo.clave === "vencida"), ({ fila }) => fila.saldo);
    const potencial = f.cur + aMes + yaVenc;
    return { tipo: potencial >= f.meta ? "info" : "alerta", peso: potencial >= f.meta ? 0 : Math.round(Math.min(25, (f.meta - potencial) / f.meta * 50)),
      texto: `Cobrado **${din(f.cur)}** de ${meta(f)} de **${din(f.meta)}**; faltan **${din(falta)}**. Hasta fin de mes vencen **${din(aMes)}** y ya hay **${din(yaVenc)}** vencidos: ${potencial >= f.meta ? `si cobras ambos llegas a **${din(potencial)}**` : `aun cobrando todo llegarías a **${din(potencial)}**, no alcanza: hay que facturar más o cobrar adelantado`}.` };
  } },
  { id: "dias-de-cobro", etapa: "cob", cuando: ["actual"], run(x) {
    const desde = x.ahoraMs - 180 * DIA, pag = [];
    for (const c of x.cuentas) {
      if (c.estatus !== "Pagada" || !c.emision || !c.vencimiento) continue;
      const fechas = c.pagos.filter((p) => !p.anulado).map((p) => p.fecha).filter(Boolean).sort();
      if (!fechas.length || diaMs(fechas[fechas.length - 1]) < desde) continue;
      pag.push({ c, dias: entreFechas(c.emision, fechas[fechas.length - 1]), plazo: entreFechas(c.emision, c.vencimiento) });
    }
    if (pag.length < 3) return null;
    const prom = sumar(pag, (o) => o.dias) / pag.length, plazo = sumar(pag, (o) => o.plazo) / pag.length;
    if (prom <= plazo + 5) return { tipo: "bien", peso: 0, texto: `Tus clientes pagan a tiempo: en promedio a **${Math.round(prom)} días** con plazo de **${Math.round(plazo)}** (últimos 6 meses, ${pag.length} facturas).` };
    const por = new Map();
    for (const o of pag) { const v = por.get(o.c.cli) || { cli: o.c.cli, n: 0, atraso: 0 }; v.n++; v.atraso += o.dias - o.plazo; por.set(o.c.cli, v); }
    const tarde = [...por.values()].filter((v) => v.n >= 2 && v.atraso / v.n > 5).sort((a, b) => b.atraso / b.n - a.atraso / a.n).slice(0, 3);
    return { tipo: "alerta", peso: Math.min(12, Math.round(prom - plazo)), texto: `Tus clientes pagan en promedio a **${Math.round(prom)} días** con plazo de **${Math.round(plazo)}** (últimos 6 meses, ${pag.length} facturas): cobras más tarde de lo que prometes. Considera pedir anticipo a los que siempre se atrasan.`,
      items: tarde.map((v) => `${nombre(v.cli)} · paga ${Math.round(v.atraso / v.n)} días tarde en promedio (${plural(v.n, "factura", "facturas")})`) };
  } },
  { id: "concentracion-cartera", etapa: "cob", cuando: ["actual"], run(x) {
    const por = new Map();
    for (const { c, fila } of x.vivas) { const v = por.get(c.cli) || { cli: c.cli, m: 0 }; v.m += fila.saldo; por.set(c.cli, v); }
    const total = sumar([...por.values()], (v) => v.m), mayor = [...por.values()].sort((a, b) => b.m - a.m)[0];
    if (por.size < 2 || !total || mayor.m / total < 0.5) return null;
    return { tipo: "alerta", peso: 5, texto: `**${nombre(mayor.cli)}** concentra **${pct(mayor.m / total)} %** de lo por cobrar (**${din(mayor.m)}** de ${din(total)}). Si ese pago se retrasa, tu caja lo resiente.` };
  } },
  { id: "cobrado-vs-facturado", etapa: "cob", cuando: ["actual", "pasado"], run(x) {
    const dif = x.F.cob.cur - x.F.fac.cur;
    if (!(x.F.cob.cur > 0 || x.F.fac.cur > 0)) return null;
    return dif >= 0 ? { tipo: "bien", peso: 2, texto: `Cobraste **${din(x.F.cob.cur)}** y facturaste **${din(x.F.fac.cur)}**: cobras más de lo que facturas, así que bajas cartera de meses anteriores.` }
      : { tipo: "alerta", peso: Math.round(Math.min(12, -dif / Math.max(1, x.F.fac.cur) * 15)), texto: `Facturaste **${din(x.F.fac.cur)}** y cobraste **${din(x.F.cob.cur)}**: la cartera crece **${din(-dif)}** este mes. Revisa cuánto de ella vence pronto.` };
  } },
  { id: "cartera-sana", etapa: "cob", cuando: ["actual"], run(x) {
    return x.F.ven.cur <= 0 && x.F.pxc.cur >= 0 ? { tipo: "bien", peso: 0, texto: `Sin cartera vencida: todo lo por cobrar (**${din(x.F.pxc.cur)}**) está en plazo.` } : null;
  } },
  // ── MESES CERRADOS: cómo salió cada meta ──
  ...[["cot", "Cotizado"], ["gan", "Vendido"], ["cob", "Cobrado"]].map(([k, n]) => ({ id: "resultado-" + k, etapa: k, cuando: ["pasado"], run(x) {
    const f = x.F[k];
    if (f.meta == null) return null;
    const p = f.cur / f.meta;
    return { tipo: p >= 1 ? "bien" : "alerta", peso: p >= 1 ? 0 : Math.round((1 - p) * 30), texto: `**${n}** cerró **${x.m.etiquetaMes}** en **${din(f.cur)}**: **${pct(p)} %** de ${meta(f)} de **${din(f.meta)}**.` };
  } })),
  // ── ACUMULADO ──
  { id: "acumulado", etapa: "cot", cuando: ["todo"], run(x) {
    return { tipo: "info", peso: 0, texto: `En todo el historial cotizaste **${din(x.F.cot.cur)}**, vendiste **${din(x.F.gan.cur)}** y cobraste **${din(x.F.cob.cur)}**. Elige un mes para compararlo contra tus metas.` };
  } },
];

// elige las N lecturas de mayor peso, con a lo más 2 de una misma etapa (si no alcanzan, se completa con las siguientes)
function elegir(lecs, max = 3) {
  const orden = lecs.slice().sort((a, b) => b.score - a.score);
  const out = [], porEtapa = {};
  for (const l of orden) {
    if ((porEtapa[l.etapa] || 0) >= 2) continue;
    out.push(l); porEtapa[l.etapa] = (porEtapa[l.etapa] || 0) + 1;
    if (out.length === max) break;
  }
  for (const l of orden) { if (out.length >= max) break; if (!out.includes(l)) out.push(l); }
  return { principales: out, otras: orden.filter((l) => !out.includes(l)).slice(0, 5) };
}

function calcularLecturas(datos, r, { ahora = new Date(), umbrales = {} } = {}) {
  const x = contexto(datos, r, { ahora, umbrales });
  const modo = r.meta.todo ? "todo" : r.meta.esActual ? "actual" : "pasado";
  const lecs = [];
  for (const regla of REGLAS) {
    if (!regla.cuando.includes(modo)) continue;
    try {
      const o = regla.run(x);
      if (!o) continue;
      const panel = PANEL[regla.etapa];
      lecs.push({ id: regla.id, etapa: ETAPAS[regla.etapa], tipo: o.tipo, score: BASE[o.tipo] + (o.peso || 0), texto: o.texto, items: o.items || [], panel, accion: ACCION[panel] });
    } catch (err) { /* una regla con datos raros no debe romper el Resumen */ }
  }
  return elegir(lecs);
}

module.exports = { calcularLecturas, contexto, REGLAS, elegir };
