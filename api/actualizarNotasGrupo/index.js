// actualizarNotasGrupo/index.js
// Function protegida (rol "admin"): actualiza SOLO el campo `notas` de un
// Grupo — atajo ligero para la acción "Notas" de Tracking Operación/
// Consultar Grupos, sin tener que mandar el resto del payload completo que
// exige editarGrupo (cliente, herramientas, fechas, etc.). Sigue siendo un
// campo de texto simple, no un historial con fecha por entrada — si más
// adelante Alfredo quiere ver "quién anotó qué y cuándo" durante un curso,
// eso es una tabla nueva aparte, no algo que este endpoint resuelva.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = Number(body.id);
  const notas = (body.notas || "").trim() || null;

  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id del grupo." } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.request().input("id", sql.Int, id).input("notas", sql.NVarChar, notas).query("UPDATE Grupo SET notas = @notas WHERE id = @id");
    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese grupo ya no existe." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error actualizando notas del grupo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron guardar las notas." } };
  }
};
