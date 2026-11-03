// getInscripcionesAbiertasAdmin/index.js
// Function protegida (rol "admin"): las inscripciones de los grupos abiertos (una fila por persona) con su grupo, quién paga, estado, pago, cuándo vence el apartado,
// origen de la visita y su cuenta en Cobranza; y lo que todavía espera en la cola del sitio (con los envíos que fallaron y su motivo).
const { getPool } = require("../src/backoffice-db");
const { resumenColas } = require("../src/cursos-abiertos-import");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT i.id, i.grupo_id, g.grupo_codigo AS grupo, g.nombre_curso AS curso, a.nombre_completo AS nombre, a.correo, a.whatsapp, i.paga,
              CASE WHEN c.codigo = 'ABIERTOS' THEN NULL ELSE c.nombre END AS empresa, i.requiere_factura, i.rfc, i.razon_social, i.estado, i.estado_pago, i.monto_estimado,
              i.apartado_hasta, CASE WHEN i.estado = 'apartada' AND i.apartado_hasta < SYSUTCDATETIME() THEN 1 ELSE 0 END AS vencido,
              i.utm_source, i.utm_medium, i.utm_campaign, i.origen, i.cuenta_cobrar_id, cx.estatus AS cuenta_estatus, cx.folio_factura, i.fecha_creacion
       FROM Inscripcion i
       JOIN Grupo g ON g.id = i.grupo_id
       JOIN Alumno a ON a.id = i.alumno_id
       JOIN Cliente c ON c.id = a.cliente_id
       LEFT JOIN CuentaPorCobrar cx ON cx.id = i.cuenta_cobrar_id
       ORDER BY i.fecha_creacion DESC, i.id DESC`
    );
    let cola = { inscripciones: 0, espera: 0, errores: [] };
    try { cola = await resumenColas(); } catch (err) { context.log.warn("No se pudo leer la cola de Cursos Abiertos:", err.message); }
    context.res = { status: 200, headers: JSON_HEADERS, body: { inscripciones: r.recordset, cola } };
  } catch (err) {
    context.log.error("Error listando las inscripciones abiertas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar las inscripciones." } };
  }
};
