// registrarAccesoAdmin/index.js
// Function protegida (rol "admin"): se llama una vez por carga de /admin
// (justo después de confirmar la sesión vía /.auth/me) para llevar el
// conteo de "Actividad". El correo NUNCA viene del cliente — se lee del
// header x-ms-client-principal que Azure ya verificó, así nadie puede
// inflar el contador de otra persona mandando un correo distinto.
const { getUserFromRequest } = require("../src/auth");
const { registrarAcceso } = require("../src/actividad-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const user = getUserFromRequest(req);
  if (!user) {
    context.res = { status: 401, headers: JSON_HEADERS, body: { error: "Sin sesión." } };
    return;
  }

  try {
    await registrarAcceso(user.correo);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error registrando actividad:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo registrar: " + err.message } };
  }
};
