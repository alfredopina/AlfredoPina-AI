// listSolicitudesAdmin/index.js
// Function protegida (rol "admin"): lista Solicitudes con filtros para el
// panel Solicitudes — JOIN a Cliente/Contacto para mostrar nombres, nunca ids
// (mismo patrón que listDiplomas).
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const { estatus, clienteId, desde, hasta } = req.query;

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

    const where = condiciones.length ? "WHERE " + condiciones.join(" AND ") : "";
    const result = await request.query(`
      SELECT s.id, s.cliente_id, c.nombre AS cliente, c.codigo AS cliente_codigo,
             s.contacto_id, ct.nombre AS contacto,
             s.herramienta, s.temario_tipo, s.temario_nombre, s.temas_json, s.horas_totales,
             s.canal_origen, s.estatus, s.notas, s.fecha_creacion
      FROM Solicitud s
      JOIN Cliente c ON c.id = s.cliente_id
      LEFT JOIN Contacto ct ON ct.id = s.contacto_id
      ${where}
      ORDER BY s.fecha_creacion DESC
    `);

    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error listando solicitudes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las solicitudes." } };
  }
};
