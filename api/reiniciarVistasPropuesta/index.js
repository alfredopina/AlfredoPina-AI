// reiniciarVistasPropuesta/index.js
// Function protegida (rol "admin"): deja en cero las vistas de una propuesta (por código). Sirve cuando Alfredo la abrió desde
// otro navegador o dispositivo antes de enviarla y el contador ya no refleja al cliente. No toca la aceptación ni SQL;
// la siguiente apertura real vuelve a contar y a mandar el aviso "Abrieron tu propuesta".
const { getPropuestasTable, reiniciarVistasPropuesta } = require("../src/propuestas");
const { CODIGO_CORTO_RE } = require("../src/codigo-corto");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const codigo = String((req.body && req.body.codigo) || "").trim().toLowerCase();
  if (!CODIGO_CORTO_RE.test(codigo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el código de la propuesta." } };
    return;
  }
  try {
    const existe = await reiniciarVistasPropuesta(getPropuestasTable(), codigo);
    context.res = existe
      ? { status: 200, headers: JSON_HEADERS, body: { ok: true } }
      : { status: 404, headers: JSON_HEADERS, body: { error: "Esa propuesta ya no existe." } };
  } catch (err) {
    context.log.error("Error reiniciando las vistas de la propuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron reiniciar las vistas." } };
  }
};
