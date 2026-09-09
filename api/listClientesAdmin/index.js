// listClientesAdmin/index.js
// Function protegida (rol "admin"): todos los Clientes con su conteo de
// Contactos, antigüedad y la fecha de su última Cotización, para la lista del
// panel Clientes. Cotizacion todavía no tiene ninguna Function que la
// alimente (Fase 1.2) — hasta entonces ultima_cotizacion siempre sale NULL,
// la columna ya está lista para cuando empiece a haber datos reales.
// Búsqueda (?q=) incluye nombre/código del cliente Y nombre de sus contactos
// (Alfredo a veces recuerda a la persona antes que a la empresa).
// Orden (?sort=nombre|antiguedad|ultima_cotizacion, ?dir=asc|desc), default
// nombre/asc. Los NULL de antigüedad/última cotización siempre van al final,
// sin importar la dirección — un cliente sin dato no debe leerse como "el
// primero" ni "el último real" en ningún sentido.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

const SORTS = ["nombre", "antiguedad", "ultima_cotizacion"];
const DIRS = ["asc", "desc"];

module.exports = async function (context, req) {
  const q = (req.query.q || "").trim();
  const sortParam = SORTS.includes(req.query.sort) ? req.query.sort : "nombre";
  const dirParam = DIRS.includes(req.query.dir) ? req.query.dir : "asc";

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("like", sql.NVarChar, `%${q}%`)
      .input("sort", sql.NVarChar, sortParam)
      .input("dir", sql.NVarChar, dirParam)
      .query(
        `SELECT c.id, c.nombre, c.codigo, c.notas, c.cliente_desde,
                (SELECT COUNT(*) FROM Contacto WHERE cliente_id = c.id) AS num_contactos,
                (SELECT MAX(fecha_creacion) FROM Cotizacion WHERE cliente_id = c.id) AS ultima_cotizacion
         FROM Cliente c
         WHERE c.nombre LIKE @like OR c.codigo LIKE @like
            OR EXISTS (SELECT 1 FROM Contacto ct WHERE ct.cliente_id = c.id AND ct.nombre LIKE @like)
         ORDER BY
           CASE WHEN @sort = 'antiguedad' AND c.cliente_desde IS NULL THEN 1 ELSE 0 END,
           CASE WHEN @sort = 'ultima_cotizacion' AND (SELECT MAX(fecha_creacion) FROM Cotizacion WHERE cliente_id = c.id) IS NULL THEN 1 ELSE 0 END,
           CASE WHEN @sort = 'nombre' AND @dir = 'asc' THEN c.nombre END ASC,
           CASE WHEN @sort = 'nombre' AND @dir = 'desc' THEN c.nombre END DESC,
           CASE WHEN @sort = 'antiguedad' AND @dir = 'asc' THEN c.cliente_desde END ASC,
           CASE WHEN @sort = 'antiguedad' AND @dir = 'desc' THEN c.cliente_desde END DESC,
           CASE WHEN @sort = 'ultima_cotizacion' AND @dir = 'asc' THEN (SELECT MAX(fecha_creacion) FROM Cotizacion WHERE cliente_id = c.id) END ASC,
           CASE WHEN @sort = 'ultima_cotizacion' AND @dir = 'desc' THEN (SELECT MAX(fecha_creacion) FROM Cotizacion WHERE cliente_id = c.id) END DESC,
           c.nombre ASC`
      );
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error listando clientes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los clientes." } };
  }
};
