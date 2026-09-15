// api/src/notificaciones-config.js
// Umbrales configurables de Notificaciones ("días para considerar esto
// urgente") — Table Storage, no SQL: son 3 números sueltos sin relación con
// Cliente/Cotización/Grupo (no necesitan JOINs), así que la campana no
// depende de que apcweb-backoffice esté despierta solo para leerlos. Mismo
// Storage Account/Application Setting que Cursos/Recursos/Pendientes
// (RECURSOS_STORAGE_CONNECTION), tabla nueva autocreada por código.
//
// Un solo renglón fijo (PartitionKey "config" / RowKey "notificaciones") con
// los 3 campos. Solo el umbral "urgente" de cada señal es configurable — el
// nivel "de seguimiento" (ámbar) de cada una se queda fijo en código, ver
// CLAUDE.md → Notificaciones para el porqué.
const { TableClient } = require("@azure/data-tables");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

async function ensureTable(tableClient) {
  try {
    await tableClient.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err; // 409 = ya existe
  }
  return tableClient;
}

function getConfigTable() {
  return TableClient.fromConnectionString(getConnectionString(), "ConfiguracionNotificaciones");
}

const PARTITION_KEY = "config";
const ROW_KEY = "notificaciones";

const DEFAULTS = { cotizacionesDias: 10, gruposDias: 21, clientesDias: 90 };
const CAMPOS_VALIDOS = Object.keys(DEFAULTS);

// Si el renglón (o la tabla completa) todavía no existe, regresa los mismos
// valores que ya estaban fijos en código hasta ahora — el comportamiento no
// cambia hasta que Alfredo guarde un valor distinto por primera vez.
async function getUmbrales() {
  const table = getConfigTable();
  try {
    const e = await table.getEntity(PARTITION_KEY, ROW_KEY);
    const umbrales = {};
    for (const campo of CAMPOS_VALIDOS) {
      umbrales[campo] = typeof e[campo] === "number" ? e[campo] : DEFAULTS[campo];
    }
    return umbrales;
  } catch (err) {
    if (err.statusCode === 404) return { ...DEFAULTS };
    throw err;
  }
}

async function actualizarUmbral(campo, valor) {
  if (!CAMPOS_VALIDOS.includes(campo)) {
    throw Object.assign(new Error("Campo de umbral inválido."), { safe: true });
  }
  const entero = Number(valor);
  if (!Number.isInteger(entero) || entero < 1) {
    throw Object.assign(new Error("El valor debe ser un número entero mayor a 0."), { safe: true });
  }
  const table = getConfigTable();
  await ensureTable(table);
  await table.upsertEntity({ partitionKey: PARTITION_KEY, rowKey: ROW_KEY, [campo]: entero }, "Merge");
  return entero;
}

module.exports = { getUmbrales, actualizarUmbral, DEFAULTS, CAMPOS_VALIDOS };
