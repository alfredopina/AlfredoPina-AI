// crearTema/index.js
// Function protegida (rol "admin"): alta o edición de un tema (upsert por
// herramienta+id). Es el banco compartido que alimenta tanto el constructor
// "Personalizado" (solo temas publicados) como cualquier Temario Estándar que
// lo incluya.
const { getTemasTable, ensureTable } = require("../src/cursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const id = (body.id || "").trim().toLowerCase();
  const nombre = (body.nombre || "").trim();
  const descripcion = (body.descripcion || "").trim();
  const horas = Number(body.horas);
  const nivel = Number(body.nivel);
  const estado = body.estado === "publicado" ? "publicado" : "borrador";
  const orden = Number.isFinite(body.orden) ? body.orden : 0;

  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }
  if (!SLUG_RE.test(id)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El id del tema solo puede tener minúsculas, números y guiones (ej. tablas-dinamicas)." } };
    return;
  }
  if (!nombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el nombre del tema." } };
    return;
  }
  if (!Number.isFinite(horas) || horas <= 0) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Las horas deben ser un número mayor a 0." } };
    return;
  }
  if (![1, 2, 3].includes(nivel)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El nivel debe ser Básico, Intermedio o Avanzado." } };
    return;
  }

  try {
    const temasTable = getTemasTable();
    await ensureTable(temasTable);
    await temasTable.upsertEntity(
      { partitionKey: herramienta, rowKey: id, nombre, descripcion, horas, nivel, estado, orden },
      "Replace"
    );
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error guardando el tema:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el tema: " + err.message } };
  }
};
