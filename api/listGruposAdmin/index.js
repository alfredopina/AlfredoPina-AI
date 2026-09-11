// listGruposAdmin/index.js
// Function protegida (rol "admin"): lista Grupos con filtros para Consultar
// Grupos Y para Tracking Operación (mismo endpoint, filtros adicionales) —
// JOIN a Cliente (contratante y final)/Contacto/Cotizacion para mostrar
// nombres/folio, nunca ids (mismo patrón que listSolicitudesAdmin/
// listDiplomas). herramienta filtra con LIKE sobre el JSON guardado en
// `herramientas` (los valores son slugs fijos de HERRAMIENTAS, sin
// caracteres que puedan escapar el patrón) — más simple que OPENJSON para
// un filtro de "contiene". Orden por fecha_inicio (la fecha que de verdad
// importa para un Grupo) o cliente, ?dir=asc|desc, default fecha_inicio/desc.
// `?vista=activos|cerrados` (usado por Tracking Operación, opcional — sin
// vista, Consultar Grupos sigue viendo todo) filtra por estatus_cierre, no
// por la fase derivada — ver getResumenGruposAdmin para por qué esa
// condición es equivalente. `fase` y `dias_en_fase` se agregan por fila
// después de la consulta: fase siempre pasa por derivarFase (nunca se
// reimplementa la regla en SQL), dias_en_fase sale de una subconsulta
// correlacionada contra GrupoFaseHistorial (días desde que cruzó a la fase
// actual).
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { derivarFase } = require("../src/grupo-fase");

const SORTS = ["fecha", "cliente"];
const DIRS = ["asc", "desc"];
const VISTAS = {
  activos: "(g.estatus_cierre IS NULL OR g.estatus_cierre <> 'Cerrado')",
  cerrados: "g.estatus_cierre = 'Cerrado'",
};

module.exports = async function (context, req) {
  const { clienteId, herramienta, estatusCurso, estatusCierre, desde, hasta } = req.query;
  const sortParam = SORTS.includes(req.query.sort) ? req.query.sort : "fecha";
  const dirParam = DIRS.includes(req.query.dir) ? req.query.dir : "desc";

  try {
    const pool = await getPool();
    const request = pool.request();
    const condiciones = [];

    if (VISTAS[req.query.vista]) condiciones.push(VISTAS[req.query.vista]);
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
             g.fotos_rs, g.correos_ml, g.pagado, g.fecha_cierre, g.notas, g.fecha_creacion,
             (SELECT DATEDIFF(day, MAX(gfh.fecha), GETUTCDATE()) FROM GrupoFaseHistorial gfh WHERE gfh.grupo_id = g.id) AS dias_en_fase
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

    const filas = result.recordset.map((g) => ({ ...g, fase: derivarFase(g.estatus_curso, g.estatus_cierre) }));
    context.res = { status: 200, headers: JSON_HEADERS, body: filas };
  } catch (err) {
    context.log.error("Error listando grupos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los grupos." } };
  }
};
