// Contenedor Blob "cotizaciones" — PDFs generados de Cotización, privado.
// Reusa el Storage Account apcwebrecursos (misma Application Setting
// RECURSOS_STORAGE_CONNECTION que Cursos/Recursos/Diplomas/Plantillas).
// A diferencia del contenedor "diplomas" (que Alfredo crea a mano en el
// portal), este se autocrea la primera vez que se escribe — mismo patrón que
// "respaldos" en backup-tables.js, sin la opción "access" (Azure solo acepta
// "container"/"blob" como valores válidos de acceso público, "none" no existe
// y hace fallar la llamada — bug ya documentado en CLAUDE.md).
const { BlobServiceClient } = require("@azure/storage-blob");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

async function getCotizacionesContainer() {
  const serviceClient = BlobServiceClient.fromConnectionString(getConnectionString());
  const container = serviceClient.getContainerClient("cotizaciones");
  await container.createIfNotExists();
  return container;
}

async function subirCotizacionPdf(folio, buffer) {
  const container = await getCotizacionesContainer();
  const blobName = `${folio}.pdf`;
  await container.getBlockBlobClient(blobName).uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: "application/pdf" },
  });
  return blobName;
}

async function getCotizacionPdfBuffer(folio) {
  const container = await getCotizacionesContainer();
  try {
    return await container.getBlockBlobClient(`${folio}.pdf`).downloadToBuffer();
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

module.exports = { getCotizacionesContainer, subirCotizacionPdf, getCotizacionPdfBuffer };
