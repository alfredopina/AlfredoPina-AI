// Reportes generados de Encuestas — Table Storage (tabla "EncuestaReportes"),
// mismo patrón que diagnostico-reporte-tables.js: cada fila es un snapshot YA
// CALCULADO, así la página pública nunca depende de que apcweb-backoffice
// esté despierta. PartitionKey fijo "reporte", RowKey = código corto opaco
// (ver codigo-corto.js) que viaja en el link — NO el mismo `nuevoToken` de
// encuesta-links.js (ese es del link de INVITACIÓN por grupo, QR impreso que
// nunca debe cambiar de formato).
//
// Diferencia con el de Diagnóstico: un string de Table Storage aguanta como
// máximo 64 KB (32 K caracteres), y este snapshot lleva TODOS los comentarios
// (hasta 500 caracteres cada uno) — con un reporte grande se pasaría. Por eso
// el JSON se parte en trozos (snap0, snap1, …) y se vuelve a unir al leer.
const { TableClient } = require("@azure/data-tables");
const { ensureTable, isTableNotFound } = require("./encuesta-tables");

const TROZO = 30000; // caracteres por propiedad, con margen bajo el tope de 32 K
const MAX_TROZOS = 30; // ~900 K de JSON; el tope de la entidad completa es 1 MB

function getEncuestaReportesTable() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return TableClient.fromConnectionString(conn, "EncuestaReportes");
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

async function guardarReporteEncuesta(table, { token, snapshot }) {
  await ensureTable(table);
  const { partes, n } = partirEnTrozos(JSON.stringify(snapshot));
  await table.upsertEntity(
    {
      partitionKey: "reporte",
      rowKey: token,
      generadoEn: snapshot.generadoEn,
      etiqueta: snapshot.etiqueta || "",
      // campos chicos duplicados para que la lista no tenga que unir/parsear
      // el snapshot completo de cada fila
      filtrosJson: JSON.stringify(snapshot.filtros || {}),
      n: snapshot.n,
      nGrupos: snapshot.nGrupos,
      nComentarios: snapshot.comentarios.length,
      promedioGeneral: snapshot.promedioGeneral,
      snapPartes: n,
      ...partes,
    },
    "Replace"
  );
}

async function leerReporteEncuesta(table, token) {
  try {
    const e = await table.getEntity("reporte", token);
    return JSON.parse(unirTrozos(e));
  } catch (err) {
    if (err.statusCode === 404 || isTableNotFound(err)) return null;
    throw err;
  }
}

async function listarReportesEncuesta(table) {
  await ensureTable(table);
  const items = [];
  const entidades = table.listEntities({
    queryOptions: {
      filter: "PartitionKey eq 'reporte'",
      select: ["rowKey", "generadoEn", "etiqueta", "filtrosJson", "n", "nGrupos", "nComentarios", "promedioGeneral"],
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
      nComentarios: e.nComentarios,
      promedioGeneral: e.promedioGeneral,
    });
  }
  return items;
}

async function eliminarReporteEncuesta(table, token) {
  await table.deleteEntity("reporte", token);
}

module.exports = {
  getEncuestaReportesTable,
  partirEnTrozos,
  unirTrozos,
  guardarReporteEncuesta,
  leerReporteEncuesta,
  listarReportesEncuesta,
  eliminarReporteEncuesta,
  TROZO,
};
