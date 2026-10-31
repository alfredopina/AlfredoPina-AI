// Contenedor Blob "consultoria" — imagen de referencia opcional de una cotización de consultoría (un boceto del dashboard, una captura…).
// Mismo Storage Account y mismo criterio que "proyectos" (api/src/proyectos-storage.js): acceso público a nivel blob, `access: 'blob'`
// EXPLÍCITO, para que la propuesta pública la muestre por su URL sin una Function pública nueva. El nombre es aleatorio (no se adivina).
const crypto = require("crypto");
const { BlobServiceClient } = require("@azure/storage-blob");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

async function getConsultoriaContainer() {
  const container = BlobServiceClient.fromConnectionString(getConnectionString()).getContainerClient("consultoria");
  await container.createIfNotExists({ access: "blob" });
  return container;
}

const esJpeg = (buf) => Buffer.isBuffer(buf) && buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8;

// Sube el JPEG y regresa su URL pública.
async function subirImagenConsultoria(buffer) {
  const container = await getConsultoriaContainer();
  const nombre = crypto.randomBytes(12).toString("hex") + ".jpg";
  const blob = container.getBlockBlobClient(nombre);
  await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: "image/jpeg", blobCacheControl: "public, max-age=31536000, immutable" } });
  return blob.url;
}

module.exports = { esJpeg, subirImagenConsultoria };
