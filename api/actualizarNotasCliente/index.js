// actualizarNotasCliente/index.js
// Function protegida (rol "admin"): actualiza SOLO el campo `notas` de un
// Cliente — atajo ligero para la acción "Notas" (globito) de Consultar
// Clientes, mismo patrón que actualizarNotasGrupo, sin tener que abrir
// "Modificar Cliente" completo. Sigue siendo el mismo campo de texto simple
// que ya usa ese formulario, no un historial con fecha por entrada.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = Number(body.id);
  const notas = (body.notas || "").trim() || null;

  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id del cliente." } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.request().input("id", sql.Int, id).input("notas", sql.NVarChar, notas).query("UPDATE Cliente SET notas = @notas WHERE id = @id");
    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese cliente ya no existe." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error actualizando notas del cliente:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron guardar las notas." } };
  }
};
