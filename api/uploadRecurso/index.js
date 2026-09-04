// uploadRecurso/index.js
// Function protegida (rol "admin"): sube un archivo (Manual, Caso Práctico o
// Plantilla) al Blob Storage y crea o reemplaza su fila en la tabla Recursos.
// El archivo viaja como cuerpo binario crudo (no multipart) — el navegador lo
// manda con fetch(url, {body: file}) y los metadatos van en la query string.
// Si se manda "rowKey" de un recurso existente, se sube el archivo nuevo y se
// borra el blob viejo (reemplazo), conservando el mismo renglón.
const crypto = require("crypto");
const { getRecursosTable, getRecursosContainer } = require("../src/recursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json" };
const TIPOS_ARCHIVO = ["manual", "caso", "plantilla"];

function sanitizeFilename(name) {
  return (name || "archivo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

module.exports = async function (context, req) {
  const q = req.query || {};
  const herramienta = (q.herramienta || "").trim().toLowerCase();
  const curso = (q.curso || "").trim().toLowerCase();
  const tipo = (q.tipo || "").trim().toLowerCase();
  const titulo = (q.titulo || "").trim();
  const texto = (q.texto || "").trim();
  const filename = sanitizeFilename(q.filename);
  const rowKey = (q.rowKey || "").trim() || crypto.randomUUID();
  const orden = q.orden !== undefined ? Number(q.orden) : Date.now();

  if (!HERRAMIENTAS.includes(herramienta) || !curso || !TIPOS_ARCHIVO.includes(tipo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (herramienta, curso o tipo inválido)." } };
    return;
  }
  if (!titulo) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el título del recurso." } };
    return;
  }
  if (!req.body || !req.body.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No llegó ningún archivo." } };
    return;
  }

  const partitionKey = `${herramienta}_${curso}`;
  const contentType = req.headers["content-type"] || "application/octet-stream";
  const blobPath = `${herramienta}/${curso}/${tipo}/${rowKey}-${filename}`;

  try {
    const recursosTable = getRecursosTable();
    const container = getRecursosContainer();

    // si ya existía este renglón (reemplazo de archivo), recordamos su blob viejo para borrarlo después
    let oldBlobPath = null;
    try {
      const existente = await recursosTable.getEntity(partitionKey, rowKey);
      oldBlobPath = existente.blobPath || null;
    } catch (e) { /* no existía, es un recurso nuevo */ }

    const blockBlobClient = container.getBlockBlobClient(blobPath);
    await blockBlobClient.uploadData(req.body, { blobHTTPHeaders: { blobContentType: contentType } });

    await recursosTable.upsertEntity(
      { partitionKey, rowKey, tipo, titulo, texto, url: blockBlobClient.url, blobPath, orden },
      "Replace"
    );

    if (oldBlobPath && oldBlobPath !== blobPath) {
      try { await container.deleteBlob(oldBlobPath); } catch (e) { context.log.warn("No se pudo borrar el blob viejo " + oldBlobPath, e.message); }
    }

    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, rowKey, url: blockBlobClient.url } };
  } catch (err) {
    context.log.error("Error subiendo el recurso:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo subir el archivo." } };
  }
};
