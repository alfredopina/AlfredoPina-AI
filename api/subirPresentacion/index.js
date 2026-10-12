// subirPresentacion/index.js
// Function protegida (rol "admin"): sube o reemplaza una presentación de curso
// (un .html autocontenido) en el contenedor privado "presentaciones". Mismo
// camino que uploadRecurso: el archivo viaja como base64 dentro de un JSON.
// No hay "eliminar": volver a subir con el mismo título y herramienta reemplaza.
const { subirPresentacion } = require("../src/presentaciones-storage");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");

const MAX_BYTES = 8 * 1024 * 1024;

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = String(body.herramienta || "").trim().toLowerCase();
  const titulo = String(body.titulo || "").trim().slice(0, 140);
  const horas = String(body.horas || "").trim().slice(0, 20);
  const diapositivas = Number(body.diapositivas) || 0;
  const fail = (status, error) => { context.res = { status, headers: JSON_HEADERS, body: { error } }; };

  if (!HERRAMIENTAS.includes(herramienta)) return fail(400, "Elige la herramienta.");
  if (!titulo) return fail(400, "Falta el nombre del programa.");
  if (!body.fileBase64) return fail(400, "Falta el archivo.");

  try {
    const buffer = Buffer.from(String(body.fileBase64), "base64");
    if (!buffer.length) return fail(400, "El archivo llegó vacío.");
    if (buffer.length > MAX_BYTES) return fail(400, "La presentación pesa demasiado (máx. 8 MB).");
    const head = buffer.slice(0, 400).toString("utf8").toLowerCase();
    if (!head.includes("<!doctype html") && !head.includes("<html")) return fail(400, "El archivo no parece una presentación .html.");
    const r = await subirPresentacion({ herramienta, titulo, horas, diapositivas, buffer });
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, id: r.id, subido: r.subido } };
  } catch (err) {
    context.log.error("Error subiendo la presentación:", err.message);
    fail(500, "No se pudo subir la presentación: " + err.message);
  }
};
