// eliminarPreguntaDiagnostico/index.js
// Function protegida (rol "admin"): borra una pregunta de verdad (no es un
// simple desactivar) y su imagen del contenedor Blob "diagnostico". Las
// respuestas históricas que ya la usaron NO se tocan — pregunta_id no tiene
// FK a propósito (ver sql/015_diagnostico_tablestorage.sql), se vuelve un id
// huérfano y listRespuestasDiagnosticoAdmin lo muestra como
// "(pregunta eliminada)".
//
// Vive en Table Storage, no en SQL (2026-09-13) — necesita herramienta
// (PartitionKey) además del id (RowKey) para poder borrar sin recorrer toda
// la tabla; el admin ya conoce la herramienta activa cuando llama esto.
const { getDiagnosticoPreguntasTable, HERRAMIENTAS } = require("../src/diagnostico-tables");
const { eliminarImagenPorUrl } = require("../src/diagnostico-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = (body.id || "").trim();
  const herramienta = (body.herramienta || "").trim().toLowerCase();

  if (!id || !HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id o la herramienta de la pregunta." } };
    return;
  }

  try {
    const table = getDiagnosticoPreguntasTable();

    let existente;
    try {
      existente = await table.getEntity(herramienta, id);
    } catch (err) {
      if (err.statusCode === 404) {
        context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa pregunta ya no existe." } };
        return;
      }
      throw err;
    }

    await table.deleteEntity(herramienta, id);
    await eliminarImagenPorUrl(existente.imagen_url);

    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando la pregunta del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar: " + err.message } };
  }
};
