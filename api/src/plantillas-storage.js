// Contenedor Blob "plantillas" — reusa el Storage Account apcwebrecursos
// (misma Application Setting RECURSOS_STORAGE_CONNECTION que Cursos/Recursos/
// Diplomas). Privado: nadie fuera del admin necesita verlo directo.
// Guarda una firma por instructor (firmas/{slug-del-instructor}.png) — así
// Alfredo puede actualizarlas desde el panel Diplomas → Firmas sin depender
// de un redeploy. Ya NO guarda un fondo.png: el diploma dejó de ser una
// imagen de fondo con coordenadas fijas, ahora es HTML/CSS (ver
// assets/js/diploma-template.js) que se captura con html2canvas + jsPDF en
// el navegador — el diseño completo vive en ese archivo, no en Blob.
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
  await container.getBlockBlobClient(`fotos/${slugify(nombre)}`).deleteIfExists();
  const perfiles = await getPerfilesInstructores();
  if (perfiles[slugify(nombre)]) {
    delete perfiles[slugify(nombre)];
    await guardarPerfilesInstructores(perfiles);
  }
  return lista;
}

// Borra solo la firma — el instructor se queda en la lista, sus próximos
// diplomas salen sin firma hasta que suba una nueva.
async function eliminarFirma(instructorSlug) {
  const container = getPlantillasContainer();
  await container.getBlockBlobClient(`firmas/${instructorSlug}.png`).deleteIfExists();
}


// Perfil público de cada instructor (reseña + foto) para la página de
// verificar diploma — instructores-perfil.json { slug: { resena, foto } } y la
// foto en fotos/{slug}. La lista de nombres sigue siendo instructores.json.
async function getPerfilesInstructores() {
  const container = getPlantillasContainer();
  try {
    const buffer = await container.getBlockBlobClient("instructores-perfil.json").downloadToBuffer();
    const perfiles = JSON.parse(buffer.toString("utf8"));
    return perfiles && typeof perfiles === "object" ? perfiles : {};
  } catch (err) {
    if (err.statusCode === 404) return {};
    throw err;
  }
}

async function guardarPerfilesInstructores(perfiles) {
  const container = getPlantillasContainer();
  await container.getBlockBlobClient("instructores-perfil.json").uploadData(Buffer.from(JSON.stringify(perfiles)), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
}

async function guardarPerfilInstructor(nombre, { resena, foto }) {
  const perfiles = await getPerfilesInstructores();
  const slug = slugify(nombre);
  perfiles[slug] = { resena: resena || "", foto: foto === undefined ? Boolean(perfiles[slug] && perfiles[slug].foto) : foto };
  await guardarPerfilesInstructores(perfiles);
  return perfiles;
}

async function uploadFotoInstructor(slug, buffer, contentType) {
  const container = getPlantillasContainer();
  await container.getBlockBlobClient("fotos/" + slug).uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
}

// null si no tiene foto
async function getFotoInstructor(slug) {
  const container = getPlantillasContainer();
  try {
    const blob = container.getBlockBlobClient("fotos/" + slug);
    const props = await blob.getProperties();
    return { buffer: await blob.downloadToBuffer(), contentType: props.contentType || "image/jpeg" };
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

async function eliminarFotoInstructor(slug) {
  const container = getPlantillasContainer();
  await container.getBlockBlobClient("fotos/" + slug).deleteIfExists();
  const perfiles = await getPerfilesInstructores();
  if (perfiles[slug]) {
    perfiles[slug].foto = false;
    await guardarPerfilesInstructores(perfiles);
  }
}

// Perfil de un instructor por su nombre tal como está en Grupo.instructor —
// { nombre, resena, fotoSlug } (fotoSlug null si no tiene foto). Nunca truena:
// el perfil es un extra del registro de verificación, no debe frenar un diploma.
async function getPerfilPublicoInstructor(nombre) {
  const base = { nombre: nombre || "", resena: "", fotoSlug: null };
  if (!nombre) return base;
  try {
    const slug = slugify(nombre);
    const p = (await getPerfilesInstructores())[slug];
    if (p) return { nombre, resena: p.resena || "", fotoSlug: p.foto ? slug : null };
  } catch (err) {
    // se ignora a propósito
  }
  return base;
}

module.exports = {
  getPlantillasContainer,
  slugify,
  getFirmaBuffer,
  uploadFirma,
  getInstructores,
  agregarInstructor,
  eliminarInstructor,
  eliminarFirma,
  getPerfilesInstructores,
  guardarPerfilInstructor,
  uploadFotoInstructor,
  getFotoInstructor,
  eliminarFotoInstructor,
  getPerfilPublicoInstructor,
};
