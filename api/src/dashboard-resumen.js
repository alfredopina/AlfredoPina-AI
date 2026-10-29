// api/src/dashboard-resumen.js
// Dashboard → Resumen: las MISMAS 25 tarjetas de los 5 Trackings, con valor del periodo, línea de 12 meses y comparación contra el mes
// anterior. Lógica PURA (sin SQL ni red) para poder probarla: dashboard-resumen-db.js carga las filas y esta pieza calcula.
// Por qué en JS y no en SQL: así se reutiliza la regla que ya usa cada Tracking (cobranza.resumir, cotizacion-alternativas.representantes,
// cliente-actividad), en vez de una segunda fórmula que pudiera diferir. Las tablas son chicas (cientos de filas); nada viaja al navegador.
//
// Fechas: todo el negocio vive en hora de Monterrey (UTC-6 todo el año). Un mes empieza a las 06:00 UTC del día 1. Las columnas DATE llegan
// ya normalizadas por el cargador (medianoche de Monterrey); las DATETIME2 llegan tal cual (UTC).
//
// Tres clases de tarjeta:
//   flujo → lo ocurrido DENTRO del mes (Cobrado, Ganado, Perdido, Tasa, Tiempo de cierre, flujos de Solicitudes, Cerrados, Días de cierre…)
//   stock → cómo estaba todo AL FINAL del mes, reconstruido por fechas (Por cobrar, Vencido, Por facturar, Total, Clientes, % Directos)
//   foto  → estado de hoy sin historia en la base (Pipeline, Grupos Activos/Directos, Completos, Contactos, Activos): se acumula con la
//           "foto diaria" (dashboard-foto.js); mientras no haya foto del mes anterior se muestra como "estado de hoy".
const C = require("./cobranza");
const { representantes } = require("./cotizacion-alternativas");
const { HERRAMIENTAS } = require("./herramientas");

const DIA = 24 * 3600 * 1000;
const TZ = 6 * 3600 * 1000;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const TIPOS_CLIENTE = ["Directo", "Intermediario", "Indirecto", "Prospecto"];
const ESTRATEGIAS = ["empresas", "abiertos"];
const MENOS = "−";

// ── Definición de las tarjetas (nombres exactos de los Trackings) ──
// dir: sube_bien | baja_bien | sube_mal | neutral — qué significa que la cifra suba (nunca se juzga solo por color: ícono + texto)
const SECCIONES = [
  { id: "cobranza", titulo: "Cobranza", sub: "cuentas por cobrar y pagos", panel: "cobranza", noAplica: [], tarjetas: [
    { id: "por_cobrar", label: "Por cobrar", fmt: "dinero", dir: "neutral", clase: "stock" },
    { id: "vencido", label: "Vencido", fmt: "dinero", dir: "sube_mal", clase: "stock", urg: true },
    { id: "por_facturar", label: "Por facturar", fmt: "dinero", dir: "sube_mal", clase: "stock" },
    { id: "cobrado", label: "Cobrado", fmt: "dinero", dir: "sube_bien", clase: "flujo" },
    { id: "dias_cobro", label: "Días promedio de cobro", fmt: "dias", dir: "baja_bien", clase: "flujo" },
  ] },
  { id: "cotizaciones", titulo: "Cotizaciones", sub: "embudo comercial", panel: "tracking-comercial", noAplica: ["estrategia"], tarjetas: [
    { id: "pipeline", label: "Pipeline activo", fmt: "dinero", dir: "neutral", clase: "foto" },
    { id: "ganado", label: "Ganado", fmt: "dinero", dir: "sube_bien", clase: "flujo" },
    { id: "perdido", label: "Perdido", fmt: "dinero", dir: "baja_bien", clase: "flujo" },
    { id: "tasa", label: "Tasa de conversión", fmt: "pct", dir: "sube_bien", clase: "flujo" },
    { id: "tiempo_cierre", label: "Tiempo promedio de cierre", fmt: "dias", dir: "baja_bien", clase: "flujo" },
  ] },
  { id: "solicitudes", titulo: "Solicitudes", sub: "entrada de oportunidades", panel: "solicitudes", noAplica: ["estrategia"], tarjetas: [
    { id: "sol_manuales", label: "Solicitudes manuales", fmt: "num", dir: "neutral", clase: "flujo" },
    { id: "sol_sitio", label: "Solicitudes del sitio", fmt: "num", dir: "sube_bien", clase: "flujo" },
    { id: "sol_atendidas", label: "% Solicitudes atendidas", fmt: "pct", dir: "sube_bien", clase: "flujo" },
    { id: "sol_horas", label: "Horas promedio de atención", fmt: "horas", dir: "baja_bien", clase: "flujo" },
    { id: "sol_prospectos", label: "Prospectos generados", fmt: "num", dir: "sube_bien", clase: "flujo" },
  ] },
  { id: "grupos", titulo: "Grupos", sub: "operación de cursos", panel: "tracking-operacion", noAplica: ["estrategia"], tarjetas: [
    { id: "gru_activos", label: "Grupos Activos", fmt: "num", dir: "neutral", clase: "foto" },
    { id: "gru_cerrados", label: "Grupos Cerrados", fmt: "num", dir: "sube_bien", clase: "flujo" },
    { id: "gru_total", label: "Total", fmt: "num", dir: "neutral", clase: "stock" },
    { id: "gru_dias", label: "Días promedio de cierre", fmt: "dias", dir: "baja_bien", clase: "flujo" },
    { id: "gru_directos", label: "Grupos de Clientes Directos", fmt: "num", dir: "neutral", clase: "foto" },
  ] },
  { id: "clientes", titulo: "Clientes", sub: "cartera", panel: "clientes", noAplica: ["estrategia", "herramienta"], tarjetas: [
    { id: "cli_total", label: "Clientes", fmt: "num", dir: "neutral", clase: "stock" },
    { id: "cli_completos", label: "Completos", fmt: "num", dir: "neutral", clase: "foto" },
    { id: "cli_contactos", label: "Contactos", fmt: "num", dir: "neutral", clase: "foto" },
    { id: "cli_activos", label: "Clientes Activos", fmt: "num", dir: "neutral", clase: "foto" },
    { id: "cli_directos", label: "Clientes Directos", fmt: "pct", dir: "neutral", clase: "stock" },
  ] },
];
const IDS_FOTO = SECCIONES.flatMap((s) => s.tarjetas).filter((t) => t.clase === "foto").map((t) => t.id);
const NOTA_NO_APLICA = {
  estrategia: { cotizaciones: "Estrategia: aún no se registra en Cotizaciones", solicitudes: "Estrategia: aún no se registra en Solicitudes", grupos: "Estrategia: aún no se registra en Grupos", clientes: "Estrategia: no aplica a Clientes" },
  herramienta: { clientes: "Herramienta: no aplica a Clientes" },
};

// ── Fechas ──
const aMs = (v) => (v == null || v === "" ? null : v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v));
const diaMs = (s) => { const f = C.aFecha(s); return f ? f.getTime() + TZ : null; }; // "YYYY-MM-DD" → medianoche de Monterrey
const diasUTC = (a, b) => Math.floor(b / DIA) - Math.floor(a / DIA); // igual que DATEDIFF(day) de SQL: cruces de medianoche UTC
const redondea = (n, d) => { const k = Math.pow(10, d); return Math.round((Number(n) + Number.EPSILON) * k) / k; };
const prom = (a, d) => (a.length ? redondea(a.reduce((x, y) => x + y, 0) / a.length, d) : null);
const mesIdx = (ms) => { const d = new Date(ms - TZ); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const inicioMes = (k) => Date.UTC(Math.floor(k / 12), k % 12, 1, 6);
const claveMes = (k) => Math.floor(k / 12) + "-" + String((k % 12) + 1).padStart(2, "0");
const etiquetaMes = (k) => { const m = MESES[k % 12]; return m[0].toUpperCase() + m.slice(1) + " " + Math.floor(k / 12); };
const fechaMty = (ms) => new Date(ms - TZ).toISOString().slice(0, 10);
const enVentana = (t, v) => t != null && (v.desde == null || t >= v.desde) && (v.hasta == null || t < v.hasta);

// ── Filtros ──
// Una fila pasa si cada filtro activo la deja pasar. `herr` puede ser texto (Cotización/Solicitud) o lista (Grupo/Cuenta).
function pasa(f, { tipo, herr, estrategia }, aplica) {
  if (aplica.tipo && f.tipoCliente && tipo !== f.tipoCliente) return false;
  if (aplica.herr && f.herramienta) {
    const lista = Array.isArray(herr) ? herr : herr ? [herr] : [];
    if (!lista.includes(f.herramienta)) return false;
  }
  if (aplica.estrategia && f.estrategia && estrategia !== f.estrategia) return false;
  return true;
}

// ── Cobranza ──
// "Ahora": las filas tal cual están hoy (la misma forma que usa el Tracking). "Histórico": el estado que tenía la cuenta al instante T,
// reconstruido con sus fechas (emisión, pagos, creación); luego se pasa por la MISMA cobranza.resumir que usa el Tracking.
function filasAhora(cuentas, hoyMs, umbral) {
  const hoy = new Date(hoyMs);
  return cuentas.map((c) => {
    const pagos = c.pagos.map((p) => ({ fecha: p.fecha, monto: Number(p.monto), anulado: !!p.anulado }));
    const saldo = C.saldoDe(c.total, pagos);
    return { estatus: c.estatus, total: c.total, saldo, pagos, fecha_emision: c.emision, tipo_factura: c.tipo_factura, semaforo: C.semaforoDe({ estatus: c.estatus, saldo, vencimiento: c.vencimiento }, hoy, umbral) };
  });
}
function filasEn(cuentas, T, umbral) {
  const hoy = new Date(T - TZ - 1); // el último día que ya cuenta
  const filas = [];
  for (const c of cuentas) {
    if (c.estatus === "Cancelada") continue; // no se sabe cuándo se canceló: queda fuera de toda la historia
    const em = c.emision ? diaMs(c.emision) : c.estatus === "Por facturar" ? null : c.creada; // facturada sin fecha: cuenta desde que se creó
    const emitida = em != null && em < T; // T es el instante en que el periodo YA no cuenta
    if (!emitida && !(c.creada < T)) continue; // aún no existía
    const pagos = c.pagos.map((p) => ({ fecha: p.fecha || fechaMty(p.creada), monto: Number(p.monto), anulado: !!p.anulado }))
      .filter((p) => !p.anulado && diaMs(p.fecha) < T);
    const saldo = C.saldoDe(c.total, pagos);
    const estatus = C.estatusDerivado({ estatusActual: emitida ? "Facturada" : "Por facturar", total: c.total, pagos, tieneFactura: emitida });
    filas.push({ estatus, total: c.total, saldo, pagos, fecha_emision: emitida ? c.emision || fechaMty(em) : null, tipo_factura: c.tipo_factura, semaforo: C.semaforoDe({ estatus, saldo, vencimiento: c.vencimiento }, hoy, umbral) });
  }
  return filas;
}
function calcCobranza(datos, f, v, ahora, umbral) {
  const cuentas = datos.cuentas.filter((c) => pasa(f, { tipo: c.tipo, herr: c.herrs, estrategia: c.estrategia }, { tipo: true, herr: true, estrategia: true }));
  const filas = ahora ? filasAhora(cuentas, (v.ref != null ? v.ref : v.hasta) - 1 - TZ, umbral) : filasEn(cuentas, v.hasta, umbral);
  const rango = { desde: v.desde == null ? null : new Date(v.desde).toISOString(), hasta: v.hasta == null ? null : new Date(v.hasta).toISOString() };
  const r = C.resumir(filas, rango);
  return { por_cobrar: r.por_cobrar, vencido: r.vencido, por_facturar: r.por_facturar, cobrado: r.cobrado, dias_cobro: r.dias_promedio };
}

// ── Cotizaciones ──
const filtraCot = (datos, f) => datos.cotizaciones.filter((c) => pasa(f, { tipo: c.tipo, herr: c.herr }, { tipo: true, herr: true }));
function calcCotizaciones(datos, f, v) {
  const rows = filtraCot(datos, f);
  const cerradas = rows.filter((c) => (c.estatus === "Ganada" || c.estatus === "Perdida") && enVentana(c.cierre, v));
  const ganadas = cerradas.filter((c) => c.estatus === "Ganada"), perdidas = cerradas.filter((c) => c.estatus === "Perdida");
  const suma = (a) => redondea(a.reduce((x, c) => x + (Number(c.precio) || 0), 0), 2);
  const dias = cerradas.filter((c) => c.cierreReal != null).map((c) => diasUTC(c.creada, c.cierreReal));
  return { ganado: suma(ganadas), perdido: suma(perdidas), tasa: cerradas.length ? Math.round((ganadas.length / cerradas.length) * 100) : null, tiempo_cierre: prom(dias, 1) };
}

// ── Solicitudes ──
function calcSolicitudes(datos, f, v) {
  const rows = datos.solicitudes.filter((s) => pasa(f, { tipo: s.tipo, herr: s.herr }, { tipo: true, herr: true }) && enVentana(s.creada, v));
  const horas = rows.filter((s) => s.primera != null).map((s) => Math.max(0, (s.primera - s.creada) / 3600000));
  return {
    sol_manuales: rows.filter((s) => s.canal === "Manual").length,
    sol_sitio: rows.filter((s) => s.canal === "Sitio").length,
    sol_atendidas: rows.length ? Math.round((rows.filter((s) => s.estatus !== "Nueva").length / rows.length) * 100) : null,
    sol_horas: prom(horas, 1),
    sol_prospectos: rows.filter((s) => s.prospecto).length,
  };
}

// ── Grupos ──
const filtraGru = (datos, f) => datos.grupos.filter((g) => pasa(f, { tipo: g.tipo, herr: g.herrs }, { tipo: true, herr: true }));
function calcGrupos(datos, f, v) {
  const rows = filtraGru(datos, f);
  const cerrados = rows.filter((g) => g.cerrado && enVentana(g.cierre, v));
  const dias = cerrados.filter((g) => g.fin != null && g.cierre != null).map((g) => diasUTC(g.fin, g.cierre));
  return { gru_cerrados: cerrados.length, gru_dias: prom(dias, 1), gru_total: rows.filter((g) => g.existe != null && (v.hasta == null || g.existe < v.hasta)).length };
}

// ── Clientes ──
const filtraCli = (datos, f) => datos.clientes.filter((c) => pasa(f, { tipo: c.tipo }, { tipo: true }) && c.tipo !== "Prospecto" && c.tipo !== "Tercero");
function calcClientes(datos, f, v) {
  const rows = filtraCli(datos, f).filter((c) => c.creada == null || v.hasta == null || c.creada < v.hasta); // sin fecha de origen = ya estaba antes de la serie
  const directos = rows.filter((c) => (c.tipo || "Directo") !== "Indirecto").length;
  return { cli_total: rows.length, cli_directos: rows.length ? Math.round((directos / rows.length) * 100) : null };
}

// ── Fotos del momento (lo que no se puede reconstruir) ──
function calcFoto(datos, f) {
  const pipeline = representantes(filtraCot(datos, f).filter((c) => c.estatus === "Enviada" || c.estatus === "En negociación").map((c) => ({ id: c.id, alternativa_grupo: c.alt, precio_final: c.precio })));
  const activos = filtraGru(datos, f).filter((g) => g.activo);
  const cli = filtraCli(datos, f);
  return {
    pipeline: redondea(pipeline.reduce((a, c) => a + Number(c.precio_final || 0), 0), 2),
    gru_activos: activos.length,
    gru_directos: activos.filter((g) => g.tipo === "Directo").length,
    cli_completos: cli.filter((c) => c.completo).length,
    cli_contactos: cli.reduce((a, c) => a + (c.contactos || 0), 0),
    cli_activos: cli.filter((c) => c.activo).length,
  };
}
// La foto del día guarda TODAS las combinaciones de tipo de cliente × herramienta (35 claves chicas): así cualquier filtro tiene historia.
const claveFoto = (f) => (f.tipoCliente || "") + "|" + (f.herramienta || "");
function fotoDelDia(datos) {
  const out = {};
  for (const tipoCliente of ["", ...TIPOS_CLIENTE]) for (const herramienta of ["", ...HERRAMIENTAS]) out[claveFoto({ tipoCliente, herramienta })] = calcFoto(datos, { tipoCliente, herramienta });
  return out;
}

// ── Comparación ──
const num1 = (n) => String(redondea(n, 1));
function comparar(t, v, p, mesPrev) {
  if (v == null || p == null) return { k: "na", ic: "igual", texto: "sin comparación" };
  const dif = v - p;
  const rel = p === 0 ? (v === 0 ? 0 : Infinity) : Math.abs(dif) / Math.abs(p);
  if (rel < 0.03) return { k: "igual", ic: "igual", texto: "igual que " + mesPrev };
  const sube = dif > 0, signo = sube ? "+" : MENOS, abs = Math.abs(dif);
  let texto;
  if (t.fmt === "dinero") texto = p === 0 ? "desde cero vs " + mesPrev : signo + Math.round(rel * 100) + " % vs " + mesPrev;
  else if (t.fmt === "pct") texto = signo + num1(abs) + " pts vs " + mesPrev;
  else if (t.fmt === "dias") texto = signo + num1(abs) + (abs === 1 ? " día" : " días") + " vs " + mesPrev;
  else if (t.fmt === "horas") texto = signo + num1(abs) + " h vs " + mesPrev;
  else texto = signo + num1(abs) + " vs " + mesPrev;
  let k = "normal";
  if (t.dir === "sube_bien") k = sube ? "bien" : "mal";
  else if (t.dir === "baja_bien") k = sube ? "mal" : "bien";
  else if (t.dir === "sube_mal") k = sube ? (t.urg ? "urg" : "mal") : "bien";
  if (k === "urg") texto += " · atención";
  return { k, ic: sube ? "sube" : "baja", texto };
}

// ── Orquestación ──
// filtros: { mes: "2026-10" | "todo" | "", estrategia, tipoCliente, herramienta }
// fotos: [{ fecha: "YYYY-MM-DD", datos: <salida de fotoDelDia> }]  ·  opciones: { ahora: Date, umbralPorVencer }
function calcular(datos, filtros, { ahora = new Date(), fotos = [], umbralPorVencer = C.POR_VENCER_DEFAULT } = {}) {
  const f = { estrategia: filtros.estrategia || "", tipoCliente: filtros.tipoCliente || "", herramienta: filtros.herramienta || "" };
  const ahoraMs = ahora.getTime(), kHoy = mesIdx(ahoraMs);
  const hoy = new Date(ahoraMs - TZ), diaHoy = hoy.getUTCDate();
  const todo = filtros.mes === "todo";
  let M = kHoy;
  const m = /^(\d{4})-(\d{2})$/.exec(filtros.mes || "");
  if (m) M = Math.min(kHoy, +m[1] * 12 + (+m[2] - 1));
  const esActual = M === kHoy;
  const finDeHoy = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), diaHoy + 1, 6);

  // primer mes con datos (para no dibujar meses vacíos anteriores a la historia)
  const fechas = [];
  const pon = (x) => { if (x != null && isFinite(x)) fechas.push(x); };
  datos.cuentas.forEach((c) => { pon(c.emision ? diaMs(c.emision) : c.creada); c.pagos.forEach((p) => pon(p.fecha ? diaMs(p.fecha) : p.creada)); });
  datos.cotizaciones.forEach((c) => { pon(c.creada); pon(c.cierre); });
  datos.solicitudes.forEach((s) => pon(s.creada));
  datos.grupos.forEach((g) => { pon(g.existe); pon(g.cierre); });
  datos.clientes.forEach((c) => pon(c.creada));
  const kPrimero = fechas.length ? Math.min(...fechas.map(mesIdx)) : M;
  const kIni = Math.max(Math.min(kPrimero, M), M - 11);

  // ventana del mes k: completa, salvo el mes en curso (hasta el fin de hoy) y su comparación (mismo corte, mes anterior)
  const ventana = (k, corteDia) => {
    const fin = inicioMes(k + 1);
    return { desde: inicioMes(k), hasta: corteDia ? Math.min(fin, Date.UTC(Math.floor(k / 12), k % 12, corteDia + 1, 6)) : fin };
  };
  const calcTodo = (v, ahoraFlag) => ({
    ...calcCobranza(datos, f, v, ahoraFlag, umbralPorVencer), ...calcCotizaciones(datos, f, v), ...calcSolicitudes(datos, f, v), ...calcGrupos(datos, f, v), ...calcClientes(datos, f, v),
  });

  // serie de 12 meses (los que haya) y valor/comparación
  const puntos = [];
  for (let k = kIni; k <= M; k++) {
    const vk = k === M && esActual ? ventana(k, diaHoy) : ventana(k, 0);
    puntos.push({ k, vals: calcTodo(vk, k === M && esActual) });
  }
  const valoresM = todo
    ? calcTodo({ desde: null, hasta: null, ref: finDeHoy }, true) // "Todo el historial": acumulado, igual que los Trackings sin "contar desde"
    : puntos[puntos.length - 1].vals;
  const prevCorte = !todo && M - 1 >= kPrimero ? calcTodo(esActual ? ventana(M - 1, diaHoy) : ventana(M - 1, 0), false) : null;

  // fotos del momento: valor vivo para el mes en curso; para meses pasados, la última foto de ese mes
  const vivo = calcFoto(datos, f), kf = claveFoto(f);
  const fotosOrd = fotos.map((x) => ({ ms: diaMs(x.fecha), datos: x.datos })).filter((x) => x.ms != null).sort((a, b) => a.ms - b.ms);
  const fotoDeMes = (k, hastaMs) => {
    const v = ventana(k, 0);
    const c = fotosOrd.filter((x) => x.ms >= v.desde && x.ms < Math.min(v.hasta, hastaMs == null ? Infinity : hastaMs));
    const u = c[c.length - 1];
    return u && u.datos && u.datos[kf] ? u.datos[kf] : null;
  };

  const mesPrev = MES_CORTO[(M - 1 + 1200) % 12];
  const activos = { estrategia: !!f.estrategia, herramienta: !!f.herramienta };
  const secciones = SECCIONES.map((s) => {
    const rotos = s.noAplica.filter((d) => activos[d]);
    const notas = rotos.map((d) => NOTA_NO_APLICA[d][s.id]);
    if (s.id === "cobranza" && f.herramienta) notas.push("Herramienta: las cuentas manuales sin cotización ni grupo no se incluyen");
    const tarjetas = s.tarjetas.map((t) => {
      let valor, serie, cmp;
      if (t.clase === "foto") {
        serie = puntos.map((p) => ({ mes: claveMes(p.k), v: p.k === M && esActual ? vivo[t.id] : (fotoDeMes(p.k) || {})[t.id] ?? null }));
        valor = esActual || todo ? vivo[t.id] : (fotoDeMes(M) || {})[t.id] ?? null;
        const prev = todo ? null : fotoDeMes(M - 1, esActual ? Date.UTC(Math.floor((M - 1) / 12), (M - 1) % 12, diaHoy + 1, 6) : null);
        if (valor == null) cmp = { k: "na", ic: "reloj", texto: "sin foto de ese mes" };
        else if (todo || !prev || prev[t.id] == null) cmp = { k: "hoy", ic: "reloj", texto: esActual || todo ? "estado de hoy" : "sin foto del mes anterior" };
        else cmp = comparar(t, valor, prev[t.id], mesPrev);
      } else {
        serie = puntos.map((p) => ({ mes: claveMes(p.k), v: p.vals[t.id] ?? null }));
        valor = valoresM[t.id] ?? null;
        cmp = todo ? { k: "acum", ic: "igual", texto: "acumulado" } : prevCorte ? comparar(t, valor, prevCorte[t.id] ?? null, mesPrev) : { k: "na", ic: "igual", texto: "sin mes anterior" };
      }
      return { id: t.id, label: t.label, fmt: t.fmt, clase: t.clase, valor, serie, cmp, urgente: cmp.k === "urg" };
    });
    return { id: s.id, titulo: s.titulo, sub: s.sub, panel: s.panel, sinFiltrar: rotos.length > 0, nota: notas.length ? notas.join(" · ") : null, tarjetas };
  });

  const meses = [];
  for (let k = kHoy; k >= Math.min(kPrimero, kHoy); k--) meses.push({ valor: claveMes(k), etiqueta: etiquetaMes(k) });
  return {
    meta: {
      mes: todo ? "todo" : claveMes(M), etiquetaMes: todo ? "Todo el historial" : etiquetaMes(M), esActual: esActual && !todo, todo,
      corteDia: esActual && !todo ? diaHoy : null, mesAnterior: mesPrev, hoy: fechaMty(ahoraMs), meses, filtros: f,
    },
    secciones,
  };
}

module.exports = { calcular, fotoDelDia, calcFoto, comparar, SECCIONES, IDS_FOTO, TIPOS_CLIENTE, ESTRATEGIAS, claveFoto, filasEn, filasAhora, diaMs, TZ, DIA };
