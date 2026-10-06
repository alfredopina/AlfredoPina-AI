// eliminarImagenProyecto/index.js
// Function protegida (rol "admin"): quita la imagen de ejemplo de un Proyecto (borra los blobs y limpia sus
// campos de imagen; el resto del proyecto queda intacto).
const { getProyectosTable } = require("../src/cursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");
const { borrarBlobs } = require("../src/proyectos-storage");

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const id = (body.id || "").trim().toLowerCase();
  if (!HERRAMIENTAS.includes(herramienta) || !id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (herramienta o id)." } };
    return;
  }
  try {
    const tabla = getProyectosTable();
    let existente;
    try {
      existente = await tabla.getEntity(herramienta, id);
    } catch (e) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese proyecto no existe." } };
      return;
    }
    const { imagenUrl, imagenMiniUrl, imagenBlob, imagenMiniBlob, etag, timestamp, ...resto } = existente;
    await tabla.upsertEntity({ ...resto, partitionKey: herramienta, rowKey: id }, "Replace");
    await borrarBlobs([imagenBlob, imagenMiniBlob]);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error quitando la imagen del proyecto:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo quitar la imagen: " + err.message } };
  }
};
