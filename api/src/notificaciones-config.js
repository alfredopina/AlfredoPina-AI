// api/src/notificaciones-config.js
// Umbrales configurables de Notificaciones ("días para considerar esto
// urgente/en seguimiento") — Table Storage, no SQL: son 6 números sueltos sin
// relación con Cliente/Cotización/Grupo (no necesitan JOINs), así que la
// campana no depende de que apcweb-backoffice esté despierta solo para
// leerlos. Mismo Storage Account/Application Setting que Cursos/Recursos/
// Pendientes (RECURSOS_STORAGE_CONNECTION), tabla nueva autocreada por
// código.
//
// Un solo renglón fijo (PartitionKey "config" / RowKey "notificaciones") con
// los 6 campos: 3 "urgente" (rojo — lo único que dispara la campana) + 3
// "seguimiento" (ámbar — solo colorea el semáforo del panel, nunca notifica;
// agregado 2026-09-15, antes fijo en código). Cada par se valida junto —
// seguimiento siempre debe quedar por debajo de su urgente.
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

const DEFAULTS = {
  cotizacionesDias: 10, gruposDias: 21, clientesDias: 90,
  cotizacionesSeguimientoDias: 6, gruposSeguimientoDias: 10, clientesSeguimientoDias: 30,
};
const CAMPOS_VALIDOS = Object.keys(DEFAULTS);

// Cada urgente (rojo) con su seguimiento (ámbar) — el seguimiento siempre
// debe quedar estrictamente por debajo de su urgente, o el semáforo de ese
// panel dejaría de tener sentido (el tramo ámbar desaparecería o se
// invertiría). Ninguno de los 2 tiene tope máximo fijo aparte de este.
const PARES = {
  cotizacionesDias: "cotizacionesSeguimientoDias",
  cotizacionesSeguimientoDias: "cotizacionesDias",
  gruposDias: "gruposSeguimientoDias",
  gruposSeguimientoDias: "gruposDias",
  clientesDias: "clientesSeguimientoDias",
  clientesSeguimientoDias: "clientesDias",
};
const ES_URGENTE = new Set(["cotizacionesDias", "gruposDias", "clientesDias"]);

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

  // El par (urgente/seguimiento) de la misma señal debe seguir teniendo el
  // seguimiento estrictamente por debajo del urgente después de este cambio
  // — se valida contra el valor actual del otro campo, ya guardado o default.
  const campoPar = PARES[campo];
  const umbralesActuales = await getUmbrales();
  const valorPar = umbralesActuales[campoPar];
  const esUrgente = ES_URGENTE.has(campo);
  if (esUrgente && entero <= valorPar) {
    throw Object.assign(
      new Error(`El umbral urgente debe ser mayor al de seguimiento (${valorPar} días).`),
      { safe: true }
    );
  }
  if (!esUrgente && entero >= valorPar) {
    throw Object.assign(
      new Error(`El umbral de seguimiento debe ser menor al urgente (${valorPar} días).`),
      { safe: true }
    );
  }

  const table = getConfigTable();
  await ensureTable(table);
  await table.upsertEntity({ partitionKey: PARTITION_KEY, rowKey: ROW_KEY, [campo]: entero }, "Merge");
  return entero;
}

module.exports = { getUmbrales, actualizarUmbral, DEFAULTS, CAMPOS_VALIDOS };
