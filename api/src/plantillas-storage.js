// Contenedor Blob "plantillas" — reusa el Storage Account apcwebrecursos
// (misma Application Setting RECURSOS_STORAGE_CONNECTION que Cursos/Recursos/
// Diplomas). Privado: nadie fuera del admin necesita verlo directo.
// Guarda el fondo del diploma (fondo.png) y una firma por instructor
// (firmas/{slug-del-instructor}.png) — así Alfredo puede actualizarlos desde
// el panel "Plantillas" sin depender de un redeploy.
const { BlobServiceClient } = require("@azure/storage-blob");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

function getPlantillasContainer() {
  const serviceClient = BlobServiceClient.fromConnectionString(getConnectionString());
  return serviceClient.getContainerClient("plantillas");
}

// mismo criterio en cliente y servidor: minúsculas, sin acentos, guiones
const DIACRITICOS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICOS_RE, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function getFondoBuffer() {
  const container = getPlantillasContainer();
  try {
    return await container.getBlockBlobClient("fondo.png").downloadToBuffer();
  } catch (err) {
    if (err.statusCode === 404) {
      throw new Error("No hay una plantilla de fondo configurada todavía — súbela desde Plantillas.");
    }
    throw err;
  }
}

// null si el instructor todavía no tiene firma — el diploma se genera igual, sin firma
async function getFirmaBuffer(instructorSlug) {
  const container = getPlantillasContainer();
  try {
    return await container.getBlockBlobClient(`firmas/${instructorSlug}.png`).downloadToBuffer();
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

async function uploadFondo(buffer, contentType) {
  const container = getPlantillasContainer();
  await container.getBlockBlobClient("fondo.png").uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

async function uploadFirma(instructorSlug, buffer, contentType) {
  const container = getPlantillasContainer();
  await container.getBlockBlobClient(`firmas/${instructorSlug}.png`).uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

module.exports = { getPlantillasContainer, slugify, getFondoBuffer, getFirmaBuffer, uploadFondo, uploadFirma };
