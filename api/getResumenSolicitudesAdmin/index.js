// getResumenSolicitudesAdmin/index.js
// Function protegida (rol "admin"): scorecard del panel Solicitudes — cuántas
// son de canal Manual, cuántas de Sitio, y cuántas ya están "atendidas"
// (cualquier estatus distinto de "Nueva") sobre el total, para el % que pinta
// el admin.
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT
         (SELECT COUNT(*) FROM Solicitud WHERE canal_origen = 'Manual') AS manuales,
         (SELECT COUNT(*) FROM Solicitud WHERE canal_origen = 'Sitio') AS sitio,
         (SELECT COUNT(*) FROM Solicitud) AS total,
         (SELECT COUNT(*) FROM Solicitud WHERE estatus <> 'Nueva') AS atendidas`
    );
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset[0] };
  } catch (err) {
    context.log.error("Error calculando el resumen de solicitudes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo calcular el resumen." } };
  }
};
