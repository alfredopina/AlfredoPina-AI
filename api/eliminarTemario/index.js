// eliminarTemario/index.js
// Function protegida (rol "admin"): borra un temario estándar. Nada más
// referencia un temario (a diferencia de un tema), así que es un delete directo.
const { getTemariosTable } = require("../src/cursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const body = req.body || {};
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const id = (body.id || "").trim().toLowerCase();

  if (!HERRAMIENTAS.includes(herramienta) || !id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (herramienta o id)." } };
    return;
  }

  try {
    const temariosTable = getTemariosTable();
    await temariosTable.deleteEntity(herramienta, id);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando el temario:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el temario: " + err.message } };
  }
};
