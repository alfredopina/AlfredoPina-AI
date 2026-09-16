// getNotificacionesActivas/index.js
// Function protegida (rol "admin"): agrega las 3 señales que alimentan la
// campana del topbar — Cotizaciones frías, Grupos atorados y Clientes
// inactivos — usando los umbrales configurables de Configuración →
// Notificaciones (ver api/src/notificaciones-config.js). El resultado es el
// mismo dato que ya calculan/muestran Tracking Comercial, Tracking Operación
// y Consultar Clientes (misma regla, mismo umbral) — esto solo lo junta en
// un lugar, no reimplementa la regla en un cuarto sitio.
//
// Cotizaciones y Grupos: el umbral vive normalmente en JS del front
// (admin/index.html), aquí se recalcula del lado del servidor con el mismo
// criterio exacto para no tener que exponer una Function nueva de "dame
// todas las cotizaciones activas sin filtro" solo para la campana. Clientes:
// reusa calcularDiasInactivo (cliente-actividad.js), única fuente de verdad.
const { getPool, sql } = require("../src/backoffice-db");
const { getUmbrales } = require("../src/notificaciones-config");
const { calcularDiasInactivo } = require("../src/cliente-actividad");
const { JSON_HEADERS } = require("../src/http");

async function cotizacionesFrias(pool, umbral) {
  const result = await pool
    .request()
    .input("umbral", sql.Int, umbral)
    .query(`
      SELECT s.id, c.nombre AS cliente, s.herramienta,
             DATEDIFF(day, s.fecha_creacion, GETUTCDATE()) AS dias
      FROM Cotizacion s
      JOIN Cliente c ON c.id = s.cliente_id
      WHERE s.estatus IN ('Borrador', 'Enviada', 'En negociación')
        AND DATEDIFF(day, s.fecha_creacion, GETUTCDATE()) >= @umbral
      ORDER BY dias DESC
    `);
  return result.recordset.map((r) => ({
    tipo: "cotizacion",
    id: r.id,
    cliente: r.cliente,
    detalle: `Cotización ${r.herramienta}, sin respuesta`,
    dias: r.dias,
  }));
}

// Solo grupos en fase de cierre (Proyecto/Calificaciones/Diplomas) —
// derivarFase (grupo-fase.js) dice que un Grupo con estatus_curso='Terminado'
// y estatus_cierre NULL ya está en fase "Proyecto" (es la 1ª parada de
// cierre), no fuera de ella — la condición de abajo replica eso exacto, no
// solo "estatus_cierre IN (...)", para no dejar fuera los que todavía no
// tienen estatus_cierre capturado.
async function gruposAtorados(pool, umbral) {
  const result = await pool
    .request()
    .input("umbral", sql.Int, umbral)
    .query(`
      SELECT g.id, c.nombre AS cliente, g.nombre_curso, g.estatus_cierre,
             (SELECT DATEDIFF(day, MAX(gfh.fecha), GETUTCDATE()) FROM GrupoFaseHistorial gfh WHERE gfh.grupo_id = g.id) AS dias
      FROM Grupo g
      JOIN Cliente c ON c.id = g.cliente_id
      WHERE g.estatus_curso = 'Terminado'
        AND (g.estatus_cierre IS NULL OR g.estatus_cierre IN ('Proyecto', 'Calificaciones', 'Diplomas'))
    `);
  return result.recordset
    .filter((r) => r.dias != null && r.dias > umbral)
    .map((r) => ({
      tipo: "grupo",
      id: r.id,
      cliente: r.cliente,
      detalle: `${r.nombre_curso || "Grupo"}, en ${r.estatus_cierre || "Proyecto"}`,
      dias: r.dias,
    }))
    .sort((a, b) => b.dias - a.dias);
}

async function clientesInactivos(pool, umbral) {
  const result = await pool.request().query(`
    SELECT c.id, c.nombre,
           (SELECT MAX(fecha_creacion) FROM Solicitud
              WHERE cliente_id = c.id AND estatus IN ('Nueva', 'En seguimiento')) AS solicitud_pendiente_fecha,
           (SELECT MAX(COALESCE(fecha_envio, fecha_creacion)) FROM Cotizacion
              WHERE cliente_id = c.id AND estatus IN ('Enviada', 'En negociación')) AS cotizacion_activa_fecha,
           (SELECT MAX(fecha_cierre) FROM Cotizacion
              WHERE cliente_id = c.id AND estatus IN ('Ganada', 'Perdida')) AS cotizacion_cerrada_fecha,
           CASE WHEN EXISTS (
             SELECT 1 FROM Grupo
             WHERE (cliente_id = c.id OR cliente_final_id = c.id)
               AND (estatus_cierre IS NULL OR estatus_cierre <> 'Cerrado')
           ) THEN 1 ELSE 0 END AS grupo_activo,
           (SELECT MAX(fecha_fin) FROM Diploma WHERE cliente_id = c.id AND estatus = 'vigente') AS ultimo_diploma_fecha,
           (SELECT MAX(fecha_cierre) FROM Grupo
              WHERE (cliente_id = c.id OR cliente_final_id = c.id) AND estatus_cierre = 'Cerrado') AS ultimo_grupo_cerrado_fecha
    FROM Cliente c
  `);
  const ahora = new Date();
  const items = [];
  for (const c of result.recordset) {
    const actividad = calcularDiasInactivo(
      {
        solicitudPendienteFecha: c.solicitud_pendiente_fecha,
        cotizacionActivaFecha: c.cotizacion_activa_fecha,
        grupoActivo: !!c.grupo_activo,
        cotizacionCerradaFecha: c.cotizacion_cerrada_fecha,
        ultimoDiplomaFecha: c.ultimo_diploma_fecha,
        ultimoGrupoCerradoFecha: c.ultimo_grupo_cerrado_fecha,
      },
      ahora,
      { diasAmarillo: umbral }
    );
    if (actividad.semaforo !== "rojo") continue;
    items.push({
      tipo: "cliente",
      id: c.id,
      cliente: c.nombre,
      detalle: actividad.dias == null ? "Sin ninguna interacción registrada" : "Sin interacción reciente",
      dias: actividad.dias,
    });
  }
  // dias null (sin ningún dato) es el caso más urgente de todos — va primero.
  items.sort((a, b) => (b.dias == null ? Infinity : b.dias) - (a.dias == null ? Infinity : a.dias));
  return items;
}

module.exports = async function (context, req) {
  try {
    const umbrales = await getUmbrales();
    const pool = await getPool();
    const [cotizaciones, grupos, clientes] = await Promise.all([
      cotizacionesFrias(pool, umbrales.cotizacionesDias),
      gruposAtorados(pool, umbrales.gruposDias),
      clientesInactivos(pool, umbrales.clientesDias),
    ]);
    const items = [...cotizaciones, ...grupos, ...clientes];
    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: { total: items.length, umbrales, grupos: { cotizaciones, grupos, clientes } },
    };
  } catch (err) {
    context.log.error("Error armando notificaciones activas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar las notificaciones: " + err.message } };
  }
};
