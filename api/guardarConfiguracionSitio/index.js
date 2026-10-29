// guardarConfiguracionSitio/index.js
// Function protegida (rol "admin"): { seccion: "linkedin"|"contacto"|"perfiles"|"aviso", datos: {…} } → valida en el servidor, guarda y publica al
// instante (el sitio lo lee en la siguiente carga, con ≤ 60 s de caché). Registra quién lo guardó con el correo que verificó Azure, no con el
// que mande el navegador. Solo Table Storage. Ver api/src/sitio-config.js.
const { guardarSeccion, ErrorValidacion } = require("../src/sitio-config");
const { getUserFromRequest } = require("../src/auth");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const b = req.body || {};
  try {
    const u = getUserFromRequest(req);
    const guardado = await guardarSeccion(String(b.seccion || ""), b.datos, u ? u.correo : "", new Date());
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, seccion: String(b.seccion), datos: guardado } };
  } catch (err) {
    const validacion = err instanceof ErrorValidacion;
    if (!validacion) context.log.error("Error guardando la configuración del sitio:", err.message);
    context.res = { status: validacion ? 400 : 500, headers: JSON_HEADERS, body: { error: validacion ? err.message : "No se pudo guardar." } };
  }
};
