// listClientesAdmin/index.js
// Function protegida (rol "admin"): todos los Clientes con su conteo de
// Contactos, antigüedad y la fecha de su última Cotización, para la lista del
// panel Clientes. Cotizacion todavía no tiene ninguna Function que la
// alimente (Fase 1.2) — hasta entonces ultima_cotizacion siempre sale NULL,
// la columna ya está lista para cuando empiece a haber datos reales.
// Búsqueda (?q=) incluye nombre/código del cliente Y nombre de sus contactos
// (Alfredo a veces recuerda a la persona antes que a la empresa).
// Orden (?sort=nombre|antiguedad|ultima_cotizacion), default nombre.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

const SORTS = ["nombre", "antiguedad", "ultima_cotizacion"];

module.exports = async function (context, req) {
  const q = (req.query.q || "").trim();
  const sortParam = SORTS.includes(req.query.sort) ? req.query.sort : "nombre";

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("like", sql.NVarChar, `%${q}%`)
      .input("sort", sql.NVarChar, sortParam)
      .query(
        `SELECT c.id, c.nombre, c.codigo, c.notas, c.cliente_desde,
                (SELECT COUNT(*) FROM Contacto WHERE cliente_id = c.id) AS num_contactos,
                (SELECT MAX(fecha_creacion) FROM Cotizacion WHERE cliente_id = c.id) AS ultima_cotizacion
         FROM Cliente c
         WHERE c.nombre LIKE @like OR c.codigo LIKE @like
            OR EXISTS (SELECT 1 FROM Contacto ct WHERE ct.cliente_id = c.id AND ct.nombre LIKE @like)
         ORDER BY
           CASE WHEN @sort = 'antiguedad' AND c.cliente_desde IS NULL THEN 1 ELSE 0 END,
           CASE WHEN @sort = 'nombre' THEN c.nombre END ASC,
           CASE WHEN @sort = 'antiguedad' THEN c.cliente_desde END ASC,
           CASE WHEN @sort = 'ultima_cotizacion' THEN (SELECT MAX(fecha_creacion) FROM Cotizacion WHERE cliente_id = c.id) END DESC,
           c.nombre ASC`
      );
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error listando clientes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los clientes." } };
  }
};
