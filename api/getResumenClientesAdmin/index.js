// getResumenClientesAdmin/index.js
// Function protegida (rol "admin"): scorecard del panel Clientes — total de
// Clientes vs. completos, total de Contactos, y clientes en semáforo verde.
// Reusa el mismo ingrediente crudo (y la misma regla, api/src/
// cliente-actividad.js) que listClientesAdmin, para que el número del
// scorecard nunca se desalinee con lo que se ve en la tabla.
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { calcularDiasInactivo, calcularCompletado } = require("../src/cliente-actividad");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const [totales, filas] = await Promise.all([
      pool.request().query("SELECT COUNT(*) AS total_contactos FROM Contacto"),
      pool.request().query(`
        SELECT c.id, c.codigo, c.cliente_desde,
               cp.correo AS principal_correo, cp.telefono AS principal_telefono,
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
               (SELECT MAX(fecha_fin) FROM Diploma WHERE cliente_id = c.id AND estatus = 'vigente') AS ultimo_diploma_fecha
        FROM Cliente c
        OUTER APPLY (SELECT TOP 1 correo, telefono FROM Contacto WHERE cliente_id = c.id AND es_principal = 1) cp
      `),
    ]);

    const ahora = new Date();
    let completos = 0;
    let enVerde = 0;
    for (const c of filas.recordset) {
      if (
        calcularCompletado({
          codigo: c.codigo,
          clienteDesde: c.cliente_desde,
          principalCorreo: c.principal_correo,
          principalTelefono: c.principal_telefono,
        })
      ) {
        completos++;
      }
      const { semaforo } = calcularDiasInactivo(
        {
          solicitudPendienteFecha: c.solicitud_pendiente_fecha,
          cotizacionActivaFecha: c.cotizacion_activa_fecha,
          grupoActivo: !!c.grupo_activo,
          cotizacionCerradaFecha: c.cotizacion_cerrada_fecha,
          ultimoDiplomaFecha: c.ultimo_diploma_fecha,
        },
        ahora
      );
      if (semaforo === "verde") enVerde++;
    }

    const total = filas.recordset.length;
    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: {
        total_clientes: total,
        clientes_completos: completos,
        total_contactos: totales.recordset[0].total_contactos,
        clientes_en_verde: enVerde,
        pct_en_verde: total ? Math.round((enVerde / total) * 100) : 0,
      },
    };
  } catch (err) {
    context.log.error("Error calculando el resumen de clientes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo calcular el resumen." } };
  }
};
