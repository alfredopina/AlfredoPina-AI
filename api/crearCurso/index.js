// crearCurso/index.js
// Function protegida (rol "admin"): alta o edición de un curso (upsert por
// herramienta+curso). Cubre nombre, código y estado en una sola llamada — rotar
// el código es simplemente volver a guardar el curso con un código distinto.
const { getCursosTable } = require("../src/recursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json" };
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const curso = (body.curso || "").trim().toLowerCase();
  const nombre = (body.nombre || "").trim();
  const codigo = (body.codigo || "").trim().toUpperCase();
  const estado = body.estado === "publicado" ? "publicado" : "borrador";
  const orden = Number.isFinite(body.orden) ? body.orden : 0;

  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }
  if (!SLUG_RE.test(curso)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El id del curso solo puede tener minúsculas, números y guiones (ej. excel-bi)." } };
    return;
  }
  if (!nombre || !codigo) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan el nombre o el código del curso." } };
    return;
  }

  try {
    const cursosTable = getCursosTable();
    await cursosTable.upsertEntity(
      { partitionKey: herramienta, rowKey: curso, nombre, codigo, estado, orden },
      "Replace"
    );
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error guardando el curso:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el curso." } };
  }
};
