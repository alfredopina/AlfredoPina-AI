// getResumenClientesAdmin/index.js
// Function protegida (rol "admin"): scorecard del panel Clientes — total de
// Clientes, total de Contactos, y cuántos Clientes tienen al menos una
// Cotización creada en el año en curso ("clientes activos", para el % que
// pinta el admin). Cotizacion todavía no tiene ninguna Function que la
// alimente (Fase 1.2) — hasta entonces clientes_activos siempre sale 0, y
// empieza a reflejar la realidad solo, sin tocar este archivo.
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT
         (SELECT COUNT(*) FROM Cliente) AS total_clientes,
         (SELECT COUNT(*) FROM Contacto) AS total_contactos,
         (SELECT COUNT(DISTINCT cliente_id) FROM Cotizacion WHERE YEAR(fecha_creacion) = YEAR(SYSUTCDATETIME())) AS clientes_activos`
    );
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset[0] };
  } catch (err) {
    context.log.error("Error calculando el resumen de clientes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo calcular el resumen." } };
  }
};
