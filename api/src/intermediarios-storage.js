// Contenedor Blob "intermediarios" — reusa el Storage Account apcwebrecursos
// (misma Application Setting RECURSOS_STORAGE_CONNECTION que Cursos/Recursos/
// Diplomas/Plantillas/Cotizaciones). Un logo por Cliente tipo Intermediario
// ({clienteId}.png) — mismo criterio que firmas/{slug}.png de plantillas-storage.js.
const { BlobServiceClient } = require("@azure/storage-blob");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

async function getIntermediariosContainer() {
  const serviceClient = BlobServiceClient.fromConnectionString(getConnectionString());
  const container = serviceClient.getContainerClient("intermediarios");
  await container.createIfNotExists();
  return container;
}

async function subirLogoIntermediario(clienteId, buffer) {
  const container = await getIntermediariosContainer();
  await container.getBlockBlobClient(`${clienteId}.png`).uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: "image/png" },
  });
}

// null si el cliente todavía no tiene logo
async function getLogoIntermediarioBuffer(clienteId) {
  const container = await getIntermediariosContainer();
  try {
    return await container.getBlockBlobClient(`${clienteId}.png`).downloadToBuffer();
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

async function eliminarLogoIntermediario(clienteId) {
  const container = await getIntermediariosContainer();
  await container.getBlockBlobClient(`${clienteId}.png`).deleteIfExists();
}

module.exports = { subirLogoIntermediario, getLogoIntermediarioBuffer, eliminarLogoIntermediario };
