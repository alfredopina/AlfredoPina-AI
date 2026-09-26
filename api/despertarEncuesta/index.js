// despertarEncuesta/index.js
// Function PÚBLICA (a diferencia de despertarBackoffice, que es rol admin —
// encuesta.html no tiene sesión, no podría llamarla): encuesta.html la
// dispara en paralelo al cargar, sin esperar la respuesta, para que la base
// SQL (donde vive enviarRespuesta) ya esté despierta para cuando el alumno
// termine de contestar varios minutos después. El banco de preguntas ya no
// depende de SQL (ver encuesta-tables.js), así que esto solo protege el paso
// final del envío, no la carga inicial. Mismo "SELECT 1" barato que
// despertarBackoffice/despertarDiagnostico, a propósito sin reusar ninguna
// Function de negocio.
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { despertarConLimite } = require("../src/despertar-limite");

module.exports = async function (context, req) {
  try {
    // una ejecución real cada 10 min por instancia (ver src/despertar-limite.js):
    // evita que aperturas repetidas o un robot mantengan la base despierta
    const r = await despertarConLimite(async () => {
      const pool = await getPool();
      await pool.request().query("SELECT 1");
    });
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, omitido: r.omitido } };
  } catch (err) {
    context.log.error("Error despertando la base (encuesta):", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo despertar la base." } };
  }
};
