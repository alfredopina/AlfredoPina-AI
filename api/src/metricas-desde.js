// api/src/metricas-desde.js
// "Contar desde": el botón de Configuración que reinicia las TARJETAS ACUMULADAS de los Tracking. Ningún Tracking
// reinicia sus métricas solo (decisión de Alfredo 2026-10-07); aquí Alfredo decide cuándo. NO borra nada: guarda una
// fecha por Tracking y las funciones getResumen*Admin solo cuentan lo ocurrido desde ella. "Volver a contar todo" la
// quita. Lo que es estado VIVO (semáforos, pipeline, grupos activos, todo Clientes) nunca se filtra: no es histórico.
// Table Storage (tabla ConfiguracionNotificaciones, renglón config/metricas): no depende de SQL.
//   solicitudes → fecha_creacion de la solicitud · cotizaciones → fecha de cierre (Ganada/Perdida) ·
//   grupos → fecha_cierre del grupo. Clientes no tiene tarjetas acumuladas (todas son del estado actual).
const { TableClient } = require("@azure/data-tables");

const TABLA = "ConfiguracionNotificaciones";
const PK = "config";
const RK = "metricas";
const TRACKINGS = ["solicitudes", "cotizaciones", "grupos"];

function getTabla() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  return conn ? TableClient.fromConnectionString(conn, TABLA) : null;
}

// nunca lanza: ante cualquier problema cuenta todo ({ solicitudes:null, cotizaciones:null, grupos:null })
async function getMetricasDesde() {
  const vacio = Object.fromEntries(TRACKINGS.map((t) => [t, null]));
  const tabla = getTabla();
  if (!tabla) return vacio;
  try {
    const e = await tabla.getEntity(PK, RK);
    for (const t of TRACKINGS) if (typeof e[t] === "string" && e[t] && !isNaN(Date.parse(e[t]))) vacio[t] = e[t];
    return vacio;
  } catch (err) {
    return vacio;
  }
}

// accion: "reiniciar" (cuenta desde ahora) | "quitar" (vuelve a contar todo)
async function cambiarMetricasDesde(tracking, accion, ahora = new Date()) {
  if (!TRACKINGS.includes(tracking)) throw new Error("Ese Tracking no tiene métricas acumuladas que reiniciar.");
  if (accion !== "reiniciar" && accion !== "quitar") throw new Error("Acción desconocida.");
  const tabla = getTabla();
  if (!tabla) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  try { await tabla.createTable(); } catch (err) { if (err.statusCode !== 409) throw err; }
  await tabla.upsertEntity({ partitionKey: PK, rowKey: RK, [tracking]: accion === "reiniciar" ? ahora.toISOString() : "" }, "Merge");
  return getMetricasDesde();
}

module.exports = { TRACKINGS, getMetricasDesde, cambiarMetricasDesde };
