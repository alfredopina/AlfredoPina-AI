// Contenedor Blob "presentaciones" — reusa el Storage Account apcwebrecursos
// (misma Application Setting RECURSOS_STORAGE_CONNECTION que Cursos/Recursos/
// Diplomas). Privado: solo el admin lo lee. Aquí viven las presentaciones de
// curso (un .html autocontenido por programa, ~1 MB) que se generan en
// Materiales\ (fuera del repo público) con el constructor de presentaciones.
// Una presentación = un blob "{herramienta}/{slug}.html"; los datos de la
// tarjeta (título, horas, diapositivas, fecha) van en los metadatos del blob,
// codificados con encodeURIComponent porque Azure solo admite ASCII ahí.
const { BlobServiceClient } = require("@azure/storage-blob");

function getContainer() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return BlobServiceClient.fromConnectionString(conn).getContainerClient("presentaciones");
}

const DIACRITICOS_RE = new RegExp("[\\u0300-\\u036f]", "g");
function slugify(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICOS_RE, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

const enc = (v) => encodeURIComponent(String(v == null ? "" : v));
const dec = (v) => { try { return decodeURIComponent(v || ""); } catch { return v || ""; } };

function blobName(herramienta, slug) {
  return `${herramienta}/${slug}.html`;
}

// Sube o reemplaza (mismo herramienta+título → mismo blob) una presentación.
async function subirPresentacion({ herramienta, titulo, horas, diapositivas, buffer }) {
  const container = getContainer();
  await container.createIfNotExists();
  const slug = slugify(titulo);
  const nombre = blobName(herramienta, slug);
  const subido = new Date().toISOString();
  await container.getBlockBlobClient(nombre).uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: "text/html; charset=utf-8" },
    metadata: {
      titulo: enc(titulo),
      herramienta: enc(herramienta),
      horas: enc(horas),
      diapositivas: enc(diapositivas),
      subido: enc(subido),
    },
  });
  return { id: nombre, subido };
}

async function listarPresentaciones() {
  const container = getContainer();
  if (!(await container.exists())) return [];
  const items = [];
  for await (const b of container.listBlobsFlat({ includeMetadata: true })) {
    const m = b.metadata || {};
    items.push({
      id: b.name,
      titulo: dec(m.titulo) || b.name,
      herramienta: dec(m.herramienta) || b.name.split("/")[0],
      horas: dec(m.horas),
      diapositivas: Number(dec(m.diapositivas)) || null,
      subido: dec(m.subido) || (b.properties.lastModified ? b.properties.lastModified.toISOString() : ""),
      bytes: b.properties.contentLength || 0,
    });
  }
  items.sort((a, b) => (a.subido < b.subido ? 1 : -1));
  return items;
}

async function leerPresentacion(id) {
  // el id viene del cliente: solo "herramienta/slug.html", sin recorrer carpetas
  if (!/^[a-z0-9]+\/[a-z0-9-]+\.html$/.test(id || "")) return null;
  try {
    return await getContainer().getBlockBlobClient(id).downloadToBuffer();
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

module.exports = { subirPresentacion, listarPresentaciones, leerPresentacion, slugify };
