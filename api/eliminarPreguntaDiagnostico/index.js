// eliminarPreguntaDiagnostico/index.js
// Function protegida (rol "admin"): borra una pregunta de verdad (no es un
// simple desactivar) y su imagen del contenedor Blob "diagnostico". Las
// respuestas históricas que ya la usaron NO se tocan — pregunta_id no tiene
// FK a propósito (ver sql/009_diagnostico.sql), se vuelve un id huérfano y
// listRespuestasDiagnosticoAdmin lo muestra como "(pregunta eliminada)".
const { getPool, sql } = require("../src/backoffice-db");
const { getDiagnosticoContainer } = require("../src/diagnostico-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const id = Number((req.body || {}).id);
  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id de la pregunta." } };
    return;
  }

  try {
    const pool = await getPool();
    const existente = await pool.request().input("id", sql.Int, id).query("SELECT imagen_url FROM DiagnosticoPregunta WHERE id = @id");
    if (!existente.recordset.length) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa pregunta ya no existe." } };
      return;
    }

    await pool.request().input("id", sql.Int, id).query("DELETE FROM DiagnosticoPregunta WHERE id = @id");

    const imagenUrl = existente.recordset[0].imagen_url;
    if (imagenUrl) {
      try {
        const blobName = decodeURIComponent(new URL(imagenUrl).pathname.split("/").pop());
        const container = await getDiagnosticoContainer();
        await container.deleteBlob(blobName);
      } catch (e) {
        context.log.warn("No se pudo borrar la imagen " + imagenUrl, e.message);
      }
    }

    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando la pregunta del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar: " + err.message } };
  }
};
