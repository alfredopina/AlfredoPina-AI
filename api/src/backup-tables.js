// Respaldo de las 5 tablas de Table Storage que hoy no tienen ningún mecanismo
// de backup/recuperación (hallazgo Alto de la auditoría de resiliencia del
// 2026-09-08) — Table Storage no ofrece soft-delete ni point-in-time restore,
// así que esto es la única red de seguridad real contra un borrado/bug que
// corrompa el catálogo de Cursos/Recursos.
const { TableClient } = require("@azure/data-tables");
const { BlobServiceClient } = require("@azure/storage-blob");
const { isTableNotFound } = require("./cursos-tables");
const config = require("../config/agenda-config.json");

const TABLAS = ["Cursos", "Recursos", "Temas", "TemariosEstandar", "Proyectos"];

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

async function leerTabla(nombre) {
  const table = TableClient.fromConnectionString(getConnectionString(), nombre);
  const filas = [];
  try {
    for await (const e of table.listEntities()) filas.push(e);
  } catch (err) {
    if (!isTableNotFound(err)) throw err; // tabla que nunca se ha escrito = catálogo vacío, no error
  }
  return filas;
}

async function getRespaldosContainer() {
  const serviceClient = BlobServiceClient.fromConnectionString(getConnectionString());
  const container = serviceClient.getContainerClient("respaldos");
  // Sin "access" = privado por default. Azure solo acepta "container"/"blob" como
  // valores válidos de acceso público — "none" no existe y hace fallar la llamada.
  await container.createIfNotExists();
  return container;
}

// Mismo cálculo de "hora de México fija" (offset -6, sin horario de verano) que
// ya usa availability-logic.js para Agenda — reutilizado aquí solo para nombrar
// el archivo, no hay nada de negocio de por medio.
function partesHoraMexico(date) {
  const shifted = new Date(date.getTime() + config.utcOffsetHours * 3600000);
  return {
    y: shifted.getUTCFullYear(),
    mo: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    hh: shifted.getUTCHours(),
    mm: shifted.getUTCMinutes(),
  };
}

function nombreArchivo(date, origen) {
  const { y, mo, d, hh, mm } = partesHoraMexico(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${y}-${pad(mo)}-${pad(d)}_${pad(hh)}${pad(mm)}_${origen}.json`;
}

// origen: "auto" (timer semanal) | "manual" (botón "Respaldar ahora" del admin).
async function generarRespaldo(origen) {
  const tablas = {};
  for (const nombre of TABLAS) {
    tablas[nombre] = await leerTabla(nombre);
  }

  const ahora = new Date();
  const payload = { generadoEn: ahora.toISOString(), origen, tablas };
  const nombreBlob = nombreArchivo(ahora, origen);
  const contenido = JSON.stringify(payload);

  const container = await getRespaldosContainer();
  await container.getBlockBlobClient(nombreBlob).upload(contenido, Buffer.byteLength(contenido), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });

  return { nombreBlob, conteos: Object.fromEntries(TABLAS.map((t) => [t, tablas[t].length])) };
}

module.exports = { generarRespaldo, getRespaldosContainer, nombreArchivo, TABLAS };
