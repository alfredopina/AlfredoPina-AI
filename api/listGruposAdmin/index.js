// listGruposAdmin/index.js
// Function protegida (rol "admin"): lista Grupos con filtros para el panel
// Consultar Grupos — JOIN a Cliente (contratante y final)/Contacto/Cotizacion
// para mostrar nombres/folio, nunca ids (mismo patrón que listSolicitudesAdmin/
// listDiplomas). herramienta filtra con LIKE sobre el JSON guardado en
// `herramientas` (los valores son slugs fijos de HERRAMIENTAS, sin
// caracteres que puedan escapar el patrón) — más simple que OPENJSON para
// un filtro de "contiene". Orden por fecha_inicio (la fecha que de verdad
// importa para un Grupo) o cliente, ?dir=asc|desc, default fecha_inicio/desc.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

const SORTS = ["fecha", "cliente"];
const DIRS = ["asc", "desc"];

module.exports = async function (context, req) {
  const { clienteId, herramienta, estatusCurso, estatusCierre, desde, hasta } = req.query;
  const sortParam = SORTS.includes(req.query.sort) ? req.query.sort : "fecha";
  const dirParam = DIRS.includes(req.query.dir) ? req.query.dir : "desc";

  try {
    const pool = await getPool();
    const request = pool.request();
    const condiciones = [];

    if (clienteId) {
      condiciones.push("(g.cliente_id = @clienteId OR g.cliente_final_id = @clienteId)");
      request.input("clienteId", sql.Int, Number(clienteId));
    }
    if (herramienta) {
      condiciones.push("g.herramientas LIKE @herramienta");
      request.input("herramienta", sql.NVarChar, `%"${herramienta}"%`);
    }
    if (estatusCurso) {
      condiciones.push("g.estatus_curso = @estatusCurso");
      request.input("estatusCurso", sql.NVarChar, estatusCurso);
    }
    if (estatusCierre) {
      condiciones.push("g.estatus_cierre = @estatusCierre");
      request.input("estatusCierre", sql.NVarChar, estatusCierre);
    }
    if (desde) {
      condiciones.push("g.fecha_inicio >= @desde");
      request.input("desde", sql.Date, new Date(desde));
    }
    if (hasta) {
      condiciones.push("g.fecha_inicio <= @hasta");
      request.input("hasta", sql.Date, new Date(hasta));
    }

    request.input("sort", sql.NVarChar, sortParam).input("dir", sql.NVarChar, dirParam);

    const where = condiciones.length ? "WHERE " + condiciones.join(" AND ") : "";
    const result = await request.query(`
      SELECT g.id, g.cliente_id, c.nombre AS cliente, c.codigo AS cliente_codigo,
             g.cliente_final_id, cf.nombre AS cliente_final,
             g.contacto_id, ct.nombre AS contacto,
             g.modalidad, g.grupo_codigo, g.herramientas, g.nombre_curso, g.niveles,
             g.horas, g.sesiones, g.fecha_inicio, g.fecha_fin, g.instructor,
             g.estatus_curso, g.estatus_cierre,
             g.cotizacion_id, cot.folio AS cotizacion_folio,
             g.fotos_rs, g.correos_ml, g.pagado, g.fecha_cierre, g.notas, g.fecha_creacion
      FROM Grupo g
      JOIN Cliente c ON c.id = g.cliente_id
      LEFT JOIN Cliente cf ON cf.id = g.cliente_final_id
      LEFT JOIN Contacto ct ON ct.id = g.contacto_id
      LEFT JOIN Cotizacion cot ON cot.id = g.cotizacion_id
      ${where}
      ORDER BY
        CASE WHEN @sort = 'fecha' AND @dir = 'asc' THEN g.fecha_inicio END ASC,
        CASE WHEN @sort = 'fecha' AND @dir = 'desc' THEN g.fecha_inicio END DESC,
        CASE WHEN @sort = 'cliente' AND @dir = 'asc' THEN c.nombre END ASC,
        CASE WHEN @sort = 'cliente' AND @dir = 'desc' THEN c.nombre END DESC,
        g.fecha_creacion DESC
    `);

    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error listando grupos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los grupos." } };
  }
};
