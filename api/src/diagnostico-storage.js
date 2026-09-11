// Contenedor Blob "diagnostico" — imágenes de referencia de las preguntas del
// Diagnóstico. Reusa el Storage Account apcwebrecursos (misma Application
// Setting RECURSOS_STORAGE_CONNECTION que Cursos/Recursos/Diplomas/Plantillas/
// Cotizaciones). Acceso público a nivel blob (como "recursos", no como
// "plantillas"/"cotizaciones") — son imágenes de bajo riesgo servidas directo
// por su URL, sin Function de streaming.
//
// `access: 'blob'` va EXPLÍCITO a propósito: createIfNotExists() sin esa
// opción deja el contenedor privado por default — ya nos pasó con
// "respaldos"/"cotizaciones" (ver CLAUDE.md → "Ya resueltos"), aquí el
// contenedor sí necesita ser público, así que omitirlo sería el error
// contrario (un contenedor que se queda privado cuando debía ser público).
const { BlobServiceClient } = require("@azure/storage-blob");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

async function getDiagnosticoContainer() {
  const serviceClient = BlobServiceClient.fromConnectionString(getConnectionString());
  const container = serviceClient.getContainerClient("diagnostico");
  await container.createIfNotExists({ access: "blob" });
  return container;
}

const EXTENSIONES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

function extensionDeContentType(contentType) {
  return EXTENSIONES[contentType] || "png";
}

async function subirImagenPregunta(key, buffer, contentType) {
  const container = await getDiagnosticoContainer();
  const blobName = `${key}.${extensionDeContentType(contentType)}`;
  const blockBlobClient = container.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
  return blockBlobClient.url;
}

module.exports = { getDiagnosticoContainer, subirImagenPregunta };
