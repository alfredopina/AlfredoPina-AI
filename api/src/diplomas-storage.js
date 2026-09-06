// Contenedor Blob "diplomas" — reusa el Storage Account apcwebrecursos (misma
// Application Setting RECURSOS_STORAGE_CONNECTION que ya usan Cursos/Recursos),
// pero a diferencia de "recursos" este contenedor es PRIVADO: los PDFs traen
// datos personales de alumnos, no se descargan por link directo, solo vía
// getDiplomaPdf (protegida, rol admin).
const { BlobServiceClient } = require("@azure/storage-blob");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

function getDiplomasContainer() {
  const serviceClient = BlobServiceClient.fromConnectionString(getConnectionString());
  return serviceClient.getContainerClient("diplomas");
}

module.exports = { getDiplomasContainer };
