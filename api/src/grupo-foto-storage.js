// api/src/grupo-foto-storage.js
// Contenedor Blob "grupo-fotos" — reusa el Storage Account apcwebrecursos.
// Una foto por Grupo ({grupoId}, sin extensión — el contentType real se
// guarda en el blob, mismo criterio que fotos/{slug} de instructor en
// plantillas-storage.js, a diferencia del logo de Intermediario que siempre
// es PNG). Quién puede VER esta foto no se decide aquí — eso lo resuelve
// getFotoGrupoReporte validando el token del reporte; este módulo solo
// guarda/lee/borra el blob.
const { BlobServiceClient } = require("@azure/storage-blob");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

async function getGrupoFotosContainer() {
  const serviceClient = BlobServiceClient.fromConnectionString(getConnectionString());
  const container = serviceClient.getContainerClient("grupo-fotos");
  await container.createIfNotExists();
  return container;
}

async function subirFotoGrupo(grupoId, buffer, contentType) {
  const container = await getGrupoFotosContainer();
  await container.getBlockBlobClient(String(grupoId)).uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

// null si el grupo todavía no tiene foto
async function getFotoGrupoBuffer(grupoId) {
  const container = await getGrupoFotosContainer();
  const blob = container.getBlockBlobClient(String(grupoId));
  try {
    const props = await blob.getProperties();
    return { buffer: await blob.downloadToBuffer(), contentType: props.contentType || "image/jpeg" };
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

async function eliminarFotoGrupo(grupoId) {
  const container = await getGrupoFotosContainer();
  await container.getBlockBlobClient(String(grupoId)).deleteIfExists();
}

module.exports = { subirFotoGrupo, getFotoGrupoBuffer, eliminarFotoGrupo };
