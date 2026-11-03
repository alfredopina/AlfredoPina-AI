// getListaEsperaAbiertaAdmin/index.js
// Function protegida (rol "admin"): la lista de espera de Cursos Abiertos («avísame» del sitio) con su interés, quién paga, de qué grupo o parte de la página
// vino, el origen de la visita y su estado (nueva, avisada, descartada).
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT id, nombre, correo, interes, paga, contexto, grupo_referencia, estado, utm_source, utm_medium, utm_campaign, fecha_creacion, fecha_estado
       FROM ListaEspera ORDER BY CASE estado WHEN 'nueva' THEN 0 ELSE 1 END, fecha_creacion DESC, id DESC`
    );
    context.res = { status: 200, headers: JSON_HEADERS, body: { espera: r.recordset } };
  } catch (err) {
    context.log.error("Error listando la lista de espera:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar la lista de espera." } };
  }
};
