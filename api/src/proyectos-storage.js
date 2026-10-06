// Contenedor Blob "proyectos" — imágenes de ejemplo de cada Proyecto del catálogo (un dashboard, un
// reporte formulado, macros en reportes…). Se ven en la tarjeta pública del programa y en el PDF de la
// cotización. Reusa el Storage Account apcwebrecursos (misma RECURSOS_STORAGE_CONNECTION). Acceso público
// a nivel blob, como "diagnostico": son imágenes de ejemplo servidas directo por su URL.
// `access: 'blob'` va EXPLÍCITO (createIfNotExists() sin esa opción deja el contenedor privado, ver
// diagnostico-storage.js).
// Cada imagen se guarda en DOS tamaños, ambos JPEG (pdfmake no lee WebP): la completa (≈1600 px, para
// verla en grande en el sitio) y una miniatura (≈640 px, para la tarjeta y el PDF, ~60-90 KB). El nombre
// lleva un sello de tiempo: un reemplazo nunca choca con el caché del navegador.
const { BlobServiceClient } = require("@azure/storage-blob");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

async function getProyectosContainer() {
  const container = BlobServiceClient.fromConnectionString(getConnectionString()).getContainerClient("proyectos");
  await container.createIfNotExists({ access: "blob" });
  return container;
}

const esJpeg = (buf) => Buffer.isBuffer(buf) && buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8;

async function subirImagenes(herramienta, id, full, mini) {
  const container = await getProyectosContainer();
  const sello = Date.now().toString(36);
  const imagenBlob = `${herramienta}/${id}-${sello}.jpg`;
  const imagenMiniBlob = `${herramienta}/${id}-${sello}-mini.jpg`;
  const headers = { blobContentType: "image/jpeg", blobCacheControl: "public, max-age=31536000, immutable" };
  const a = container.getBlockBlobClient(imagenBlob);
  const b = container.getBlockBlobClient(imagenMiniBlob);
  await a.uploadData(full, { blobHTTPHeaders: headers });
  await b.uploadData(mini, { blobHTTPHeaders: headers });
  return { imagenBlob, imagenMiniBlob, imagenUrl: a.url, imagenMiniUrl: b.url };
}

// nunca crítico: si un blob ya no existe o falla, solo se avisa
async function borrarBlobs(nombres) {
  const lista = (nombres || []).filter(Boolean);
  if (!lista.length) return;
  try {
    const container = await getProyectosContainer();
    for (const n of lista) {
      try { await container.deleteBlob(n); } catch (err) { console.warn("No se pudo borrar el blob " + n, err.message); }
    }
  } catch (err) {
    console.warn("No se pudieron borrar los blobs de proyecto", err.message);
  }
}

async function descargarBlob(nombre) {
  const container = await getProyectosContainer();
  return container.getBlobClient(nombre).downloadToBuffer();
}

module.exports = { getProyectosContainer, esJpeg, subirImagenes, borrarBlobs, descargarBlob };
