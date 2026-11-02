// api/src/metas.js
// Metas mensuales de dinero (SIN IVA) del Dashboard → Resumen: Cotizado, Ganado y Cobrado. Alfredo las escribe en Configuración → Metas;
// mientras una no exista, esa fila del Resumen usa el promedio de sus últimos 12 meses (comportamiento anterior).
// Table Storage (tabla ConfiguracionNotificaciones, renglón config/metas): no depende de SQL ni la despierta.
// Un campo vacío = "sin meta propia" (se usa el promedio). Nunca se borra nada de verdad: guardar vacío solo quita la meta.
const { TableClient } = require("@azure/data-tables");

const TABLA = "ConfiguracionNotificaciones";
const PK = "config";
const RK = "metas";
const CLAVES = ["cot", "gan", "cob"];
const MAXIMO = 1e9;

function getTabla() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  return conn ? TableClient.fromConnectionString(conn, TABLA) : null;
}

const aMonto = (v) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : null);

// nunca lanza: ante cualquier problema no hay metas → { cot:null, gan:null, cob:null }
async function getMetas() {
  const r = Object.fromEntries(CLAVES.map((k) => [k, null]));
  const tabla = getTabla();
  if (!tabla) return r;
  try {
    const e = await tabla.getEntity(PK, RK);
    for (const k of CLAVES) r[k] = aMonto(e[k]);
    return r;
  } catch (err) {
    return r;
  }
}

// valores: { cot, gan, cob }; cada uno es un monto >= 0, o vacío/null para quitar esa meta. Regresa las metas guardadas.
async function guardarMetas(valores) {
  const v = valores || {};
  const limpio = {};
  for (const k of CLAVES) {
    const crudo = v[k];
    if (crudo === null || crudo === undefined || String(crudo).trim() === "") { limpio[k] = null; continue; }
    const n = Number(crudo);
    if (!isFinite(n) || n < 0) throw new Error("Las metas deben ser montos de cero o más.");
    if (n > MAXIMO) throw new Error("Esa meta es demasiado grande.");
    limpio[k] = Math.round(n * 100) / 100;
  }
  const tabla = getTabla();
  if (!tabla) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  try { await tabla.createTable(); } catch (err) { if (err.statusCode !== 409) throw err; }
  const entidad = { partitionKey: PK, rowKey: RK };
  for (const k of CLAVES) if (limpio[k] != null) entidad[k] = limpio[k];
  await tabla.upsertEntity(entidad, "Replace");
  return limpio;
}

module.exports = { CLAVES_METAS: CLAVES, getMetas, guardarMetas };
