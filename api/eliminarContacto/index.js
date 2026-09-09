// eliminarContacto/index.js
// Function protegida (rol "admin"): borrado real de un Contacto (a diferencia
// de Cliente, que nunca se borra — un contacto individual sí puede dejar de
// existir sin perder el historial del cliente).
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const id = Number((req.body || {}).id);
  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id del contacto." } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.request().input("id", sql.Int, id).query("DELETE FROM Contacto WHERE id = @id");
    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese contacto ya no existe." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando el contacto:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar el contacto." } };
  }
};
