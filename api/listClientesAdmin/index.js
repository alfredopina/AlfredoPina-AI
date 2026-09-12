// listClientesAdmin/index.js
// Function protegida (rol "admin"): todos los Clientes con su conteo de
// Contactos, Tipo de Cliente, Completado y Días Inactivo (ver
// api/src/cliente-actividad.js — única fuente de la regla) para la tabla del
// panel Clientes (rediseño 2026-09-12, reemplaza el maestro-detalle
// original). "Días Inactivo" combina Solicitud/Cotización/Grupo/Diploma —
// cada ingrediente crudo se trae con una subconsulta y se resuelve en JS con
// calcularDiasInactivo, nunca reimplementado en SQL (mismo criterio que
// grupo-fase.js#derivarFase). completado y dias_inactivo/semaforo no los
// ordena el backend (no son columnas reales) — el front los ordena en el
// cliente, mismo patrón que listGruposAdmin con fase/herramienta/instructor.
// Búsqueda (?q=) incluye nombre/código del cliente Y nombre de sus contactos.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { calcularDiasInactivo, calcularCompletado } = require("../src/cliente-actividad");

const SORTS = ["nombre", "antiguedad"];
const DIRS = ["asc", "desc"];

const QUERY = `
  SELECT c.id, c.nombre, c.codigo, c.notas, c.cliente_desde, c.tipo_cliente,
         (SELECT COUNT(*) FROM Contacto WHERE cliente_id = c.id) AS num_contactos,
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
`;

module.exports = async function (context, req) {
  const q = (req.query.q || "").trim();
  const sortParam = SORTS.includes(req.query.sort) ? req.query.sort : "nombre";
  const dirParam = DIRS.includes(req.query.dir) ? req.query.dir : "asc";

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("like", sql.NVarChar, `%${q}%`)
      .input("sort", sql.NVarChar, sortParam)
      .input("dir", sql.NVarChar, dirParam)
      .query(
        `${QUERY}
         WHERE c.nombre LIKE @like OR c.codigo LIKE @like
            OR EXISTS (SELECT 1 FROM Contacto ct WHERE ct.cliente_id = c.id AND ct.nombre LIKE @like)
         ORDER BY
           CASE WHEN @sort = 'antiguedad' AND c.cliente_desde IS NULL THEN 1 ELSE 0 END,
           CASE WHEN @sort = 'nombre' AND @dir = 'asc' THEN c.nombre END ASC,
           CASE WHEN @sort = 'nombre' AND @dir = 'desc' THEN c.nombre END DESC,
           CASE WHEN @sort = 'antiguedad' AND @dir = 'asc' THEN c.cliente_desde END ASC,
           CASE WHEN @sort = 'antiguedad' AND @dir = 'desc' THEN c.cliente_desde END DESC,
           c.nombre ASC`
      );

    const ahora = new Date();
    const filas = result.recordset.map((c) => {
      const actividad = calcularDiasInactivo(
        {
          solicitudPendienteFecha: c.solicitud_pendiente_fecha,
          cotizacionActivaFecha: c.cotizacion_activa_fecha,
          grupoActivo: !!c.grupo_activo,
          cotizacionCerradaFecha: c.cotizacion_cerrada_fecha,
          ultimoDiplomaFecha: c.ultimo_diploma_fecha,
        },
        ahora
      );
      const completado = calcularCompletado({
        codigo: c.codigo,
        clienteDesde: c.cliente_desde,
        principalCorreo: c.principal_correo,
        principalTelefono: c.principal_telefono,
      });
      return {
        id: c.id,
        nombre: c.nombre,
        codigo: c.codigo,
        notas: c.notas,
        cliente_desde: c.cliente_desde,
        tipo_cliente: c.tipo_cliente,
        num_contactos: c.num_contactos,
        completado,
        dias_inactivo: actividad.dias,
        semaforo: actividad.semaforo,
        fechas_actividad: {
          solicitud_pendiente: c.solicitud_pendiente_fecha,
          cotizacion_activa: c.cotizacion_activa_fecha,
          cotizacion_cerrada: c.cotizacion_cerrada_fecha,
          grupo_activo: !!c.grupo_activo,
          ultimo_diploma: c.ultimo_diploma_fecha,
          fecha_referencia: actividad.fechaRef,
        },
      };
    });

    context.res = { status: 200, headers: JSON_HEADERS, body: filas };
  } catch (err) {
    context.log.error("Error listando clientes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar los clientes." } };
  }
};
