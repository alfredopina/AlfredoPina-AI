// listDiplomas/index.js
// Function protegida (rol "admin"): lista diplomas con filtros para la
// pestaña "Consultar Diplomas" del admin. Ningún registro se borra ni se
// oculta — "anulado" es un estatus más, siempre visible.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const { alumno, clienteId, herramienta, curso, desde, hasta, resultado, estatus } = req.query;

  try {
    const pool = await getPool();
    const request = pool.request();
    const condiciones = [];

    if (alumno) {
      condiciones.push("a.nombre_completo LIKE @alumno");
      request.input("alumno", sql.NVarChar, `%${alumno}%`);
    }
    if (clienteId) {
      condiciones.push("d.cliente_id = @clienteId");
      request.input("clienteId", sql.Int, Number(clienteId));
    }
    if (herramienta) {
      condiciones.push("d.herramienta = @herramienta");
      request.input("herramienta", sql.NVarChar, herramienta);
    }
    if (curso) {
      condiciones.push("d.curso LIKE @curso");
      request.input("curso", sql.NVarChar, `%${curso}%`);
    }
    if (desde) {
      condiciones.push("d.fecha_inicio >= @desde");
      request.input("desde", sql.Date, new Date(desde));
    }
    if (hasta) {
      condiciones.push("d.fecha_fin <= @hasta");
      request.input("hasta", sql.Date, new Date(hasta));
    }
    if (resultado) {
      condiciones.push("d.resultado = @resultado");
      request.input("resultado", sql.NVarChar, resultado);
    }
    if (estatus) {
      condiciones.push("d.estatus = @estatus");
      request.input("estatus", sql.NVarChar, estatus);
    }

    const where = condiciones.length ? "WHERE " + condiciones.join(" AND ") : "";
    const result = await request.query(`
      SELECT d.folio, a.nombre_completo AS alumno, c.nombre AS cliente, d.cliente_id, d.herramienta, d.curso, d.nivel,
             d.resultado, d.fecha_inicio, d.fecha_fin, d.horas, d.estatus, d.blob_path, d.grupo, d.instructor, d.corrige_a_folio
      FROM Diploma d
      JOIN Alumno a ON a.id = d.alumno_id
      JOIN Cliente c ON c.id = d.cliente_id
      ${where}
      ORDER BY d.fecha_generacion DESC
    `);

    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error listando diplomas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los diplomas: " + err.message } };
  }
};
