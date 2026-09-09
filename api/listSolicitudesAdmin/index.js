// listSolicitudesAdmin/index.js
// Function protegida (rol "admin"): lista Solicitudes con filtros para el
// panel Solicitudes — JOIN a Cliente/Contacto para mostrar nombres, nunca ids
// (mismo patrón que listDiplomas). Orden (?sort=fecha|cliente|horas,
// ?dir=asc|desc), default fecha/desc — mismo patrón de query parametrizado
// con CASE WHEN que ya usa listClientesAdmin, sin SQL dinámico.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

const SORTS = ["fecha", "cliente", "horas"];
const DIRS = ["asc", "desc"];

module.exports = async function (context, req) {
  const { estatus, clienteId, desde, hasta } = req.query;
  const sortParam = SORTS.includes(req.query.sort) ? req.query.sort : "fecha";
  const dirParam = DIRS.includes(req.query.dir) ? req.query.dir : "desc";

  try {
    const pool = await getPool();
    const request = pool.request();
    const condiciones = [];

    if (estatus) {
      condiciones.push("s.estatus = @estatus");
      request.input("estatus", sql.NVarChar, estatus);
    }
    if (clienteId) {
      condiciones.push("s.cliente_id = @clienteId");
      request.input("clienteId", sql.Int, Number(clienteId));
    }
    if (desde) {
      condiciones.push("CAST(s.fecha_creacion AS DATE) >= @desde");
      request.input("desde", sql.Date, new Date(desde));
    }
    if (hasta) {
      condiciones.push("CAST(s.fecha_creacion AS DATE) <= @hasta");
      request.input("hasta", sql.Date, new Date(hasta));
    }

    request.input("sort", sql.NVarChar, sortParam).input("dir", sql.NVarChar, dirParam);

    const where = condiciones.length ? "WHERE " + condiciones.join(" AND ") : "";
    const result = await request.query(`
      SELECT s.id, s.cliente_id, c.nombre AS cliente, c.codigo AS cliente_codigo,
             s.contacto_id, ct.nombre AS contacto,
             s.herramienta, s.temario_tipo, s.temario_nombre, s.temas_json, s.horas_totales,
             s.canal_origen, s.estatus, s.notas, s.fecha_creacion,
             s.fecha_tentativa, s.ciudad_sede, s.participantes, s.modalidad
      FROM Solicitud s
      JOIN Cliente c ON c.id = s.cliente_id
      LEFT JOIN Contacto ct ON ct.id = s.contacto_id
      ${where}
      ORDER BY
        CASE WHEN @sort = 'fecha' AND @dir = 'asc' THEN s.fecha_creacion END ASC,
        CASE WHEN @sort = 'fecha' AND @dir = 'desc' THEN s.fecha_creacion END DESC,
        CASE WHEN @sort = 'cliente' AND @dir = 'asc' THEN c.nombre END ASC,
        CASE WHEN @sort = 'cliente' AND @dir = 'desc' THEN c.nombre END DESC,
        CASE WHEN @sort = 'horas' AND @dir = 'asc' THEN s.horas_totales END ASC,
        CASE WHEN @sort = 'horas' AND @dir = 'desc' THEN s.horas_totales END DESC,
        s.fecha_creacion DESC
    `);

    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error listando solicitudes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las solicitudes." } };
  }
};
