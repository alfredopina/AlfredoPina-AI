// api/src/metricas-desde.js
// "Contar desde / hasta": el control de Configuración → Métricas de los Tracking para las TARJETAS ACUMULADAS. Ningún
// Tracking reinicia sus métricas solo (decisión de Alfredo 2026-10-07); aquí Alfredo decide. NO borra nada: guarda un
// rango por Tracking y las funciones getResumen*Admin solo cuentan lo ocurrido dentro de él. Tres usos:
//   · reiniciar ahora    → desde = este momento, sin fin (empezar a contar de nuevo)
//   · rango (pruebas)    → de una fecha a otra, cualquiera de las dos puede quedar vacía
//   · volver a contar todo → sin rango
// Lo que es estado VIVO (semáforos, pipeline, grupos activos, todo Clientes) nunca se filtra: no es histórico.
// Table Storage (tabla ConfiguracionNotificaciones, renglón config/metricas): no depende de SQL.
//   solicitudes → fecha_creacion de la solicitud · cotizaciones → fecha de cierre (Ganada/Perdida) ·
//   grupos → fecha_cierre del grupo. Clientes no tiene tarjetas acumuladas (todas son del estado actual).
// Fechas: `desde` es un instante (inclusive); `hasta` es el instante en que YA no cuenta (exclusivo) — al elegir una fecha
// "hasta" en el calendario se incluye ese día completo. Los días se interpretan en hora de Monterrey (UTC-6 todo el año).
const { TableClient } = require("@azure/data-tables");

const TABLA = "ConfiguracionNotificaciones";
const PK = "config";
const RK = "metricas";
const TRACKINGS = ["solicitudes", "cotizaciones", "grupos"];
const DIA_MS = 24 * 3600 * 1000;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function getTabla() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  return conn ? TableClient.fromConnectionString(conn, TABLA) : null;
}

const valido = (v) => typeof v === "string" && v && !isNaN(Date.parse(v)) ? v : null;

// nunca lanza: ante cualquier problema cuenta todo → { solicitudes:{desde:null,hasta:null}, … }
async function getMetricasRango() {
  const r = Object.fromEntries(TRACKINGS.map((t) => [t, { desde: null, hasta: null }]));
  const tabla = getTabla();
  if (!tabla) return r;
  try {
    const e = await tabla.getEntity(PK, RK);
    for (const t of TRACKINGS) { r[t].desde = valido(e[t]); r[t].hasta = valido(e[t + "Hasta"]); }
    return r;
  } catch (err) {
    return r;
  }
}

// solo el "desde" de cada Tracking (compatibilidad)
async function getMetricasDesde() {
  const r = await getMetricasRango();
  return Object.fromEntries(TRACKINGS.map((t) => [t, r[t].desde]));
}

// "2026-10-12" → inicio de ese día en Monterrey, como instante ISO
function inicioDelDia(fecha) {
  const d = new Date(fecha + "T00:00:00-06:00");
  if (!FECHA_RE.test(fecha) || isNaN(d)) throw new Error("La fecha debe verse como 2026-10-12.");
  return d;
}

// accion: "reiniciar" (cuenta desde ahora, sin fin) | "quitar" (vuelve a contar todo) | "rango" ({ desde, hasta } como
// "YYYY-MM-DD", cualquiera puede ir vacía pero no las dos)
async function cambiarMetricasDesde(tracking, accion, opciones = {}) {
  if (!TRACKINGS.includes(tracking)) throw new Error("Ese Tracking no tiene métricas acumuladas que reiniciar.");
  if (!["reiniciar", "quitar", "rango"].includes(accion)) throw new Error("Acción desconocida.");
  let desde = "", hasta = "";
  if (accion === "reiniciar") {
    desde = (opciones.ahora instanceof Date ? opciones.ahora : new Date()).toISOString();
  } else if (accion === "rango") {
    const d = String(opciones.desde || "").trim(), h = String(opciones.hasta || "").trim();
    if (!d && !h) throw new Error("Elige al menos una fecha (desde o hasta).");
    if (d) desde = inicioDelDia(d).toISOString();
    if (h) hasta = new Date(inicioDelDia(h).getTime() + DIA_MS).toISOString(); // el día elegido cuenta completo
    if (desde && hasta && Date.parse(desde) >= Date.parse(hasta)) throw new Error("La fecha «hasta» no puede ser anterior a «desde».");
  }
  const tabla = getTabla();
  if (!tabla) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  try { await tabla.createTable(); } catch (err) { if (err.statusCode !== 409) throw err; }
  await tabla.upsertEntity({ partitionKey: PK, rowKey: RK, [tracking]: desde, [tracking + "Hasta"]: hasta }, "Merge");
  return getMetricasRango();
}

module.exports = { TRACKINGS, getMetricasRango, getMetricasDesde, cambiarMetricasDesde };
