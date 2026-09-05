// uploadRecurso/index.js
// Function protegida (rol "admin"): sube un archivo (Manual, Caso Práctico o
// Plantilla) al Blob Storage y crea o reemplaza su fila en la tabla Recursos.
// El archivo viaja como base64 dentro de un JSON normal (no binario crudo) —
// se intentó mandar el cuerpo binario directo con "dataType":"binary" en
// function.json, pero en el runtime de las "managed functions" de Static Web
// Apps req.body llegaba como string en vez de Buffer (mismo tipo de sorpresa
// que ya dio context.res.jsonBody). Base64+JSON usa el mismo camino que ya
// funciona para el resto de las Functions, a costa de ~33% más tamaño.
// Si se manda "rowKey" de un recurso existente, se sube el archivo nuevo y se
// borra el blob viejo (reemplazo), conservando el mismo renglón.
const crypto = require("crypto");
const { getRecursosTable, getRecursosContainer } = require("../src/recursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const TIPOS_ARCHIVO = ["manual", "caso", "plantilla"];

function sanitizeFilename(name) {
  return (name || "archivo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const curso = (body.curso || "").trim().toLowerCase();
  const tipo = (body.tipo || "").trim().toLowerCase();
  const titulo = (body.titulo || "").trim();
  const texto = (body.texto || "").trim();
  const filename = sanitizeFilename(body.filename);
  const contentType = body.contentType || "application/octet-stream";
  const rowKey = (body.rowKey || "").trim() || crypto.randomUUID();
  const orden = body.orden !== undefined ? Number(body.orden) : Date.now();
  const fileBase64 = body.fileBase64 || "";

  if (!HERRAMIENTAS.includes(herramienta) || !curso || !TIPOS_ARCHIVO.includes(tipo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (herramienta, curso o tipo inválido)." } };
    return;
  }
  if (!titulo) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el título del recurso." } };
    return;
  }
  if (!fileBase64) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No llegó ningún archivo." } };
    return;
  }

  const buffer = Buffer.from(fileBase64, "base64");
  const partitionKey = `${herramienta}_${curso}`;
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
    await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });

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
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo subir el archivo: " + err.message } };
  }
};
