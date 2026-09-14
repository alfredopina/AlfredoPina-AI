// despertarDiagnostico/index.js
// Function PÚBLICA (a diferencia de despertarBackoffice, que es rol admin —
// diagnostico.html no tiene sesión, no podría llamarla): diagnostico.html la
// dispara en paralelo al cargar, sin esperar la respuesta, para que la base
// SQL (donde vive enviarDiagnostico) ya esté despierta para cuando la
// persona termine de contestar las 15 preguntas varios minutos después. El
// banco de preguntas ya no depende de SQL (ver diagnostico-tables.js), así
// que esto solo protege el paso final del envío, no la carga inicial.
// Mismo "SELECT 1" barato que despertarBackoffice, a propósito sin reusar
// ninguna Function de negocio.
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1");
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error despertando la base (diagnóstico):", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo despertar la base." } };
  }
};
