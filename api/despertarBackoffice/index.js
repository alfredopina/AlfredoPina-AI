// despertarBackoffice/index.js
// Botón "Despertar" del topbar: dispara la consulta más barata posible contra
// apcweb-backoffice solo para sacarla del auto-pause antes de que Alfredo
// necesite de verdad Clientes/Solicitudes/Cotizaciones/Diplomas/Encuestas —
// sin esto, el primer panel que abra paga los ~20-60s de arranque en frío.
// A propósito no reusa ninguna Function de negocio (un SELECT 1 no le cuesta
// nada extra a la base, un query real sí).
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1");
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error despertando la base:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo despertar la base: " + err.message } };
  }
};
