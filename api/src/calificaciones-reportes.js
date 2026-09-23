// api/src/calificaciones-reportes.js
// Reportes generados de Calificaciones — Table Storage (tabla
// "CalificacionesReportes"), mismo patrón que encuesta-reportes.js: cada fila
// es un snapshot YA CALCULADO, así la página pública nunca depende de que
// apcweb-backoffice esté despierta. PartitionKey fijo "reporte", RowKey =
// código corto opaco (ver codigo-corto.js) que viaja en el link.
const { TableClient } = require("@azure/data-tables");
const { actualizarConReintento } = require("./table-contador");

const TROZO = 30000; // caracteres por propiedad, con margen bajo el tope de 32 K
const MAX_TROZOS = 30; // ~900 K de JSON; el tope de la entidad completa es 1 MB

function getConexion() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}
function getCalificacionesReportesTable() {
  return TableClient.fromConnectionString(getConexion(), "CalificacionesReportes");
}

async function ensureTable(table) {
  try {
    await table.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err; // 409 = la tabla ya existe, se ignora
  }
  return table;
}
function isTableNotFound(err) {
  if (!err || err.statusCode !== 404) return false;
  return /TableNotFound/i.test(err.code || "") || /table.*not.*found/i.test(err.message || "");
}

function partirEnTrozos(texto) {
  const partes = {};
  const n = Math.ceil(texto.length / TROZO);
  if (n > MAX_TROZOS) throw new Error("El reporte es demasiado grande para guardarse — acota los filtros.");
  for (let i = 0; i < n; i++) partes["snap" + i] = texto.slice(i * TROZO, (i + 1) * TROZO);
  return { partes, n };
}
function unirTrozos(entidad) {
  let texto = "";
  for (let i = 0; i < (entidad.snapPartes || 0); i++) texto += entidad["snap" + i] || "";
  return texto;
}

async function guardarReporteCalificaciones(table, { token, snapshot }) {
  await ensureTable(table);
  const { partes, n } = partirEnTrozos(JSON.stringify(snapshot));
  await table.upsertEntity(
    {
      partitionKey: "reporte",
      rowKey: token,
      generadoEn: snapshot.generadoEn,
      etiqueta: snapshot.etiqueta || "",
      filtrosJson: JSON.stringify(snapshot.filtros || {}),
      n: snapshot.n,
      nGrupos: snapshot.nGrupos,
      aprobados: snapshot.aprobados,
      promedioCalificacion: snapshot.promedioCalificacion,
      vistas: 0,
      snapPartes: n,
      ...partes,
    },
    "Replace"
  );
}

// Contador "en vivo" de aperturas del link público — mismo patrón que los
// contadores de Diagnóstico/Encuestas (lectura-modificación-escritura con
// ETag y reintento, ver table-contador.js). No es crítico si se pierde una
// vista por una carrera rarísima; nunca debe tumbar la carga del reporte.
async function registrarVistaReporte(table, token) {
  await actualizarConReintento(
    table,
    "reporte",
    token,
    (entidad) => ({ vistas: (entidad.vistas || 0) + 1 }),
    () => ({ vistas: 1 })
  );
}

async function leerReporteCalificaciones(table, token) {
  try {
    const e = await table.getEntity("reporte", token);
    return JSON.parse(unirTrozos(e));
  } catch (err) {
    if (err.statusCode === 404 || isTableNotFound(err)) return null;
    throw err;
  }
}

async function listarReportesCalificaciones(table) {
  await ensureTable(table);
  const items = [];
  const entidades = table.listEntities({
    queryOptions: {
      filter: "PartitionKey eq 'reporte'",
      select: ["rowKey", "generadoEn", "etiqueta", "filtrosJson", "n", "nGrupos", "aprobados", "promedioCalificacion", "vistas"],
    },
  });
  for await (const e of entidades) {
    let filtros = {};
    try { filtros = JSON.parse(e.filtrosJson || "{}"); } catch (err) { filtros = {}; }
    items.push({
      token: e.rowKey,
      generadoEn: e.generadoEn,
      etiqueta: e.etiqueta || "",
      filtros,
      n: e.n,
      nGrupos: e.nGrupos,
      aprobados: e.aprobados,
      promedioCalificacion: e.promedioCalificacion,
      vistas: e.vistas || 0,
    });
  }
  return items;
}

async function eliminarReporteCalificaciones(table, token) {
  await table.deleteEntity("reporte", token);
}

module.exports = {
  getCalificacionesReportesTable,
  guardarReporteCalificaciones,
  leerReporteCalificaciones,
  listarReportesCalificaciones,
  eliminarReporteCalificaciones,
  registrarVistaReporte,
};
