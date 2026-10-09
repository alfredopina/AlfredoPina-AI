// listCotizacionesAdmin/index.js
// Function protegida (rol "admin"): lista Cotizaciones para el panel
// Seguimiento — JOIN a Cliente/Contacto (nombres, no ids) y a Solicitud
// (origen, opcional). ?vista=activas|ganadas|perdidas|todas mapea a los 4
// tabs del mockup aprobado (activas = Borrador/Enviada/En negociación); sin
// vista, regresa activas por default. dias_estatus (días desde el último cambio de estatus) y vencida se calculan en
// la consulta (no en el front): vencida es SOLO informativa — nunca cambia el
// estatus real, Alfredo decide qué hacer con una cotización vencida.
// ?estatus= (exacto, ej. "Reemplazada") se agregó para "Ver Cotizaciones" —
// a diferencia de ?vista= (categorías amplias para el pipeline), aquí se
// necesita cualquier estatus individual para navegar el historial completo.
const { getPool, sql } = require("../src/backoffice-db");
const { codigoDePropuesta } = require("../src/propuestas");
const { JSON_HEADERS } = require("../src/http");

const VISTAS = {
  activas: "s.estatus IN ('Borrador', 'Enviada', 'En negociación')",
  ganadas: "s.estatus = 'Ganada'",
  perdidas: "s.estatus = 'Perdida'",
  todas: null,
};

module.exports = async function (context, req) {
  const { clienteId, desde, hasta, estatus } = req.query;
  const vista = VISTAS.hasOwnProperty(req.query.vista) ? req.query.vista : "activas";

  try {
    const pool = await getPool();
    const request = pool.request();
    const condiciones = [];

    if (VISTAS[vista]) condiciones.push(VISTAS[vista]);
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
      SELECT s.id, s.folio, s.solicitud_id, s.cliente_id, c.nombre AS cliente, c.codigo AS cliente_codigo,
             s.contacto_id, ct.nombre AS contacto, ct.area AS contacto_area, ct.correo AS contacto_correo,
             s.herramienta, s.temario_tipo, s.temario_nombre, s.temas_json,
             s.horas, s.precio_sugerido, s.descuento_pct, s.precio_final,
             s.fecha_creacion, s.fecha_envio, s.fecha_estatus, s.motivo_perdida, s.nota_cierre, s.fecha_vigencia, s.estatus, s.reemplaza_a_folio, c.tipo_cliente,
             s.fecha_tentativa, s.ciudad_sede, s.participantes, s.modalidad, s.blob_path,
             so.objetivo AS sol_objetivo, so.alcance AS sol_alcance, so.dirigido_a AS sol_dirigido_a, so.proyectos_json AS sol_proyectos_json,
             DATEDIFF(day, s.fecha_estatus, GETUTCDATE()) AS dias_estatus,
             CASE WHEN s.fecha_vigencia < CAST(GETUTCDATE() AS DATE)
                       AND s.estatus IN ('Borrador', 'Enviada', 'En negociación')
                  THEN 1 ELSE 0 END AS vencida
      FROM Cotizacion s
      JOIN Cliente c ON c.id = s.cliente_id
      LEFT JOIN Contacto ct ON ct.id = s.contacto_id
      LEFT JOIN Solicitud so ON so.id = s.solicitud_id
      ${where}
      ORDER BY s.fecha_creacion DESC
    `);

    // propuesta_codigo: las cotizaciones nuevas tienen propuesta web; las viejas (sin código) siguen con su PDF
    const filas = result.recordset.map(({ blob_path, ...resto }) => ({ ...resto, propuesta_codigo: codigoDePropuesta(blob_path) }));
    context.res = { status: 200, headers: JSON_HEADERS, body: filas };
  } catch (err) {
    context.log.error("Error listando cotizaciones:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las cotizaciones." } };
  }
};
