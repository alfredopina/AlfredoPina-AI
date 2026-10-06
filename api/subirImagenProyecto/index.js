// subirImagenProyecto/index.js
// Function protegida (rol "admin"): sube (o reemplaza) la imagen de ejemplo de un Proyecto. El navegador ya
// comprimió la imagen a dos JPEG (completa ≈1600 px y miniatura ≈640 px) y los manda como base64 dentro de
// un JSON normal (mismo camino que uploadRecurso). El proyecto debe existir; solo se tocan sus campos de
// imagen ("Merge") y se borran los blobs anteriores.
const { getProyectosTable } = require("../src/cursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");
const { esJpeg, subirImagenes, borrarBlobs } = require("../src/proyectos-storage");

const MAX_FULL = 1500 * 1024;
const MAX_MINI = 450 * 1024;

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const id = (body.id || "").trim().toLowerCase();
  const full = Buffer.from(body.fullBase64 || "", "base64");
  const mini = Buffer.from(body.miniBase64 || "", "base64");

  if (!HERRAMIENTAS.includes(herramienta) || !id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (herramienta o id)." } };
    return;
  }
  if (!esJpeg(full) || !esJpeg(mini)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "La imagen debe llegar como JPEG (completa y miniatura)." } };
    return;
  }
  if (full.length > MAX_FULL || mini.length > MAX_MINI) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "La imagen es demasiado pesada (máx. 1.5 MB completa y 450 KB miniatura)." } };
    return;
  }

  try {
    const tabla = getProyectosTable();
    let existente;
    try {
      existente = await tabla.getEntity(herramienta, id);
    } catch (e) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese proyecto no existe todavía; guárdalo primero." } };
      return;
    }
    const nuevas = await subirImagenes(herramienta, id, full, mini);
    await tabla.updateEntity({ partitionKey: herramienta, rowKey: id, ...nuevas }, "Merge");
    await borrarBlobs([existente.imagenBlob, existente.imagenMiniBlob]);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, imagenUrl: nuevas.imagenUrl, imagenMiniUrl: nuevas.imagenMiniUrl } };
  } catch (err) {
    context.log.error("Error subiendo la imagen del proyecto:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo subir la imagen: " + err.message } };
  }
};
