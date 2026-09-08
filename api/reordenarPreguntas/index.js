// reordenarPreguntas/index.js
// Function protegida (rol "admin"): reordenamiento tras un drag & drop en la
// pestaña Preguntas. Copia estructural de updateOrdenCursos pero sobre SQL en
// vez de Table Storage, e independiente a propósito (mismo criterio que ya se
// usó al separar ese Function del updateOrden original de Recursos).
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const items = Array.isArray((req.body || {}).items) ? req.body.items : [];
  if (!items.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No hay nada que reordenar." } };
    return;
  }

  try {
    const pool = await getPool();
    for (const item of items) {
      const id = Number(item.id);
      if (!id) continue;
      const orden = Number(item.orden) || 0;
      await pool.request().input("id", sql.Int, id).input("orden", sql.Int, orden).query("UPDATE EncuestaPregunta SET orden = @orden WHERE id = @id");
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error reordenando preguntas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar el nuevo orden: " + err.message } };
  }
};
