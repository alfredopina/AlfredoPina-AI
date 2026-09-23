// Cliente compartido de Azure Table Storage para los reportes generados del
// Diagnóstico (vista pública de 3 pestañas: General/Grupos/Individual). Cada
// fila es un snapshot YA CALCULADO (nunca se recalcula al abrir el link) —
// mismo motivo que el banco de preguntas (ver diagnostico-tables.js): la
// página pública no puede depender de que apcweb-backoffice esté despierta.
// generarReporteDiagnostico hace el cálculo pesado una sola vez contra SQL y
// lo guarda aquí; getReporteDiagnosticoPublico solo lee esta tabla.
//
// PartitionKey fijo "reporte" (volumen esperado bajo — reportes generados a
// mano, no uno por envío) — RowKey = código corto opaco (ver codigo-corto.js),
// el mismo valor que viaja en el link público. No se expone clienteId en la
// URL a propósito (ver getReporteDiagnosticoPublico) para no permitir
// enumerar reportes de otros clientes.
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
    if (err.statusCode !== 409) throw err; // 409 = la tabla ya existe, se ignora
  }
  return tableClient;
}

function getDiagnosticoReportesTable() {
  return TableClient.fromConnectionString(getConnectionString(), "DiagnosticoReportes");
}

async function guardarReporte(table, { token, herramienta, clienteId, clienteNombre, desde, hasta, snapshot }) {
  await ensureTable(table);
  await table.upsertEntity(
    {
      partitionKey: "reporte",
      rowKey: token,
      herramienta,
      clienteId,
      clienteNombre,
      desde: desde || "",
      hasta: hasta || "",
      generadoEn: new Date().toISOString(),
      visitas: 0,
      // n/promedioGeneral duplicados como propiedades propias (además de ir
      // dentro de snapshotJson) para que listarReportes pueda proyectar solo
      // estos campos chicos sin tener que parsear el JSON completo de cada
      // fila — importa poco hoy, pero evita que listar 100+ reportes se
      // vuelva lento/caro según crezca el snapshot (con Individual incluido).
      n: snapshot.general.n,
      promedioGeneral: snapshot.general.promedioGeneral,
      snapshotJson: JSON.stringify(snapshot),
    },
    "Replace"
  );
}

async function leerReporte(table, token) {
  try {
    const e = await table.getEntity("reporte", token);
    return {
      token: e.rowKey,
      herramienta: e.herramienta,
      clienteId: e.clienteId,
      clienteNombre: e.clienteNombre,
      desde: e.desde || null,
      hasta: e.hasta || null,
      generadoEn: e.generadoEn,
      snapshot: JSON.parse(e.snapshotJson),
    };
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

// Solo para getReporteDiagnosticoPublico — mejor esfuerzo, nunca debe tumbar
// la carga del reporte si falla (ej. 2 personas abriendo el link al mismo
// tiempo, condición de carrera rara en el conteo, aceptable para un contador
// simple de aperturas, no es un dato que se vaya a facturar ni auditar).
async function incrementarVisitas(table, token) {
  try {
    const e = await table.getEntity("reporte", token);
    await table.updateEntity({ partitionKey: "reporte", rowKey: token, visitas: (e.visitas || 0) + 1 }, "Merge");
  } catch (err) {
    // silencioso a propósito
  }
}

async function listarReportes(table) {
  await ensureTable(table);
  const items = [];
  const entidades = table.listEntities({
    queryOptions: {
      filter: "PartitionKey eq 'reporte'",
      select: ["rowKey", "herramienta", "clienteId", "clienteNombre", "desde", "hasta", "generadoEn", "visitas", "n", "promedioGeneral"],
    },
  });
  for await (const e of entidades) {
    items.push({
      token: e.rowKey,
      herramienta: e.herramienta,
      clienteId: e.clienteId,
      clienteNombre: e.clienteNombre,
      desde: e.desde || null,
      hasta: e.hasta || null,
      generadoEn: e.generadoEn,
      visitas: e.visitas || 0,
      n: e.n,
      promedioGeneral: e.promedioGeneral,
    });
  }
  return items;
}

async function eliminarReporte(table, token) {
  await table.deleteEntity("reporte", token);
}

module.exports = {
  getDiagnosticoReportesTable,
  guardarReporte,
  leerReporte,
  incrementarVisitas,
  listarReportes,
  eliminarReporte,
};
