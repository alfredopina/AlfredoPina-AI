// listRespuestasEncuesta/index.js
// Function protegida (rol "admin"): respuestas con filtros para la pestaña
// "Resultados". Regresa cada respuesta con su detalle ya resuelto (LEFT JOIN
// contra EncuestaPregunta — una pregunta borrada no tumba la consulta, solo
// aparece como "(pregunta eliminada)", ver sql/003_encuestas.sql).
const { getPool, sql } = require("../src/backoffice-db");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const { clienteId, curso, instructor, desde, hasta } = req.query;

  try {
    const pool = await getPool();
    const request = pool.request();
    const condiciones = [];

    if (clienteId) {
      condiciones.push("r.cliente_id = @clienteId");
      request.input("clienteId", sql.Int, Number(clienteId));
    }
    if (curso) {
      condiciones.push("r.curso LIKE @curso");
      request.input("curso", sql.NVarChar, `%${curso}%`);
    }
    if (instructor) {
      condiciones.push("r.instructor = @instructor");
      request.input("instructor", sql.NVarChar, instructor);
    }
    if (desde) {
      condiciones.push("r.fecha >= @desde");
      request.input("desde", sql.Date, new Date(desde));
    }
    if (hasta) {
      condiciones.push("r.fecha <= @hasta");
      request.input("hasta", sql.Date, new Date(hasta));
    }

    const where = condiciones.length ? "WHERE " + condiciones.join(" AND ") : "";
    const result = await request.query(`
      SELECT r.id AS respuesta_id, r.nombre, r.cliente_id, c.nombre AS cliente, r.curso, r.instructor, r.fecha, r.fecha_envio,
             d.pregunta_id, ISNULL(p.texto, '(pregunta eliminada)') AS pregunta_texto, p.tipo AS pregunta_tipo, d.valor
      FROM EncuestaRespuesta r
      JOIN Cliente c ON c.id = r.cliente_id
      JOIN EncuestaRespuestaDetalle d ON d.respuesta_id = r.id
      LEFT JOIN EncuestaPregunta p ON p.id = d.pregunta_id
      ${where}
      ORDER BY r.fecha_envio DESC, r.id, d.id
    `);

    // agrupa las filas planas (una por pregunta) en una respuesta por cabecera
    const porId = new Map();
    for (const row of result.recordset) {
      if (!porId.has(row.respuesta_id)) {
        porId.set(row.respuesta_id, {
          id: row.respuesta_id,
          nombre: row.nombre,
          cliente_id: row.cliente_id,
          cliente: row.cliente,
          curso: row.curso,
          instructor: row.instructor,
          fecha: row.fecha,
          fecha_envio: row.fecha_envio,
          respuestas: [],
        });
      }
      porId.get(row.respuesta_id).respuestas.push({
        pregunta_id: row.pregunta_id,
        texto: row.pregunta_texto,
        tipo: row.pregunta_tipo,
        valor: row.valor,
      });
    }

    context.res = { status: 200, headers: JSON_HEADERS, body: Array.from(porId.values()) };
  } catch (err) {
    context.log.error("Error listando respuestas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las respuestas: " + err.message } };
  }
};
