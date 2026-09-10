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

// Fondo de Cotización — blob separado del de Diplomas (misma idea, mismo
// contenedor "plantillas", nombre distinto: cotizacion-fondo.png) porque son
// dos documentos con formato/tamaño propios, no una variante del mismo.
async function getCotizacionFondoBuffer() {
  const container = getPlantillasContainer();
  try {
    return await container.getBlockBlobClient("cotizacion-fondo.png").downloadToBuffer();
  } catch (err) {
    if (err.statusCode === 404) {
      throw new Error("No hay una plantilla de fondo configurada todavía — súbela desde Cotizaciones → Plantilla.");
    }
    throw err;
  }
}

async function uploadCotizacionFondo(buffer, contentType) {
  const container = getPlantillasContainer();
  await container.getBlockBlobClient("cotizacion-fondo.png").uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

async function uploadFirma(instructorSlug, buffer, contentType) {
  const container = getPlantillasContainer();
  await container.getBlockBlobClient(`firmas/${instructorSlug}.png`).uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

// Lista de instructores — vive en instructores.json dentro del mismo
// contenedor (no hay todavía una entidad Instructor real, ver roadmap Fase
// 2.1 "atribución simple"). Si el archivo no existe aún, regresa esta
// semilla en vez de tronar — así no hace falta un paso manual de setup.
const INSTRUCTORES_SEMILLA = ["Ing. Alfredo Piña", "Lic. Sergio Moreno"];

async function getInstructores() {
  const container = getPlantillasContainer();
  try {
    const buffer = await container.getBlockBlobClient("instructores.json").downloadToBuffer();
    const lista = JSON.parse(buffer.toString("utf8"));
    return Array.isArray(lista) && lista.length ? lista : INSTRUCTORES_SEMILLA;
  } catch (err) {
    if (err.statusCode === 404) return INSTRUCTORES_SEMILLA;
    throw err;
  }
}

async function agregarInstructor(nombre) {
  const lista = await getInstructores();
  if (!lista.includes(nombre)) lista.push(nombre);
  const container = getPlantillasContainer();
  await container.getBlockBlobClient("instructores.json").uploadData(Buffer.from(JSON.stringify(lista)), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
  return lista;
}

// Quita al instructor de la lista y borra su firma (si tenía) — los
// diplomas que ya se generaron con su nombre no se tocan, solo deja de
// aparecer en los selectores hacia adelante.
async function eliminarInstructor(nombre) {
  const lista = (await getInstructores()).filter((n) => n !== nombre);
  const container = getPlantillasContainer();
  await container.getBlockBlobClient("instructores.json").uploadData(Buffer.from(JSON.stringify(lista)), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
  await container.getBlockBlobClient(`firmas/${slugify(nombre)}.png`).deleteIfExists();
  return lista;
}

// Borra solo la firma — el instructor se queda en la lista, sus próximos
// diplomas salen sin firma hasta que suba una nueva.
async function eliminarFirma(instructorSlug) {
  const container = getPlantillasContainer();
  await container.getBlockBlobClient(`firmas/${instructorSlug}.png`).deleteIfExists();
}

module.exports = {
  getPlantillasContainer,
  slugify,
  getFondoBuffer,
  getFirmaBuffer,
  uploadFondo,
  uploadFirma,
  getInstructores,
  agregarInstructor,
  eliminarInstructor,
  eliminarFirma,
  getCotizacionFondoBuffer,
  uploadCotizacionFondo,
};
