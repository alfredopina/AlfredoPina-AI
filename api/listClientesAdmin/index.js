// listClientesAdmin/index.js
// Function protegida (rol "admin"): todos los Clientes con su conteo de
// Contactos, para la tabla del panel Clientes. Búsqueda opcional por nombre o
// código (?q=) — sin ella regresa la lista completa.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const q = (req.query.q || "").trim();

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("like", sql.NVarChar, `%${q}%`)
      .query(
        `SELECT c.id, c.nombre, c.codigo, c.notas,
                (SELECT COUNT(*) FROM Contacto WHERE cliente_id = c.id) AS num_contactos
         FROM Cliente c
         WHERE c.nombre LIKE @like OR c.codigo LIKE @like
         ORDER BY c.nombre`
      );
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error listando clientes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los clientes." } };
  }
};
