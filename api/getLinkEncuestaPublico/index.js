// getLinkEncuestaPublico/index.js
// Function PÚBLICA (encuesta.html no tiene sesión): resuelve un token de link
// por grupo a lo mínimo que la página necesita mostrar (empresa, curso,
// instructor) y si sigue abierto. Table Storage puro — nunca toca SQL, así el
// link carga aunque la base esté dormida. No expone grupoId/clienteId ni el
// resto del snapshot.
const { getEncuestaLinksTable, leerLink } = require("../src/encuesta-links");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const token = (req.query.t || "").trim();
  if (!token) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el token del link." } };
    return;
  }
  try {
    const link = await leerLink(getEncuestaLinksTable(), token);
    if (!link) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Este link no es válido — pide de nuevo el link o el QR a tu instructor." } };
      return;
    }
    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: { clienteNombre: link.clienteNombre, curso: link.curso, instructor: link.instructor, abierta: link.abierta },
    };
  } catch (err) {
    context.log.error("Error leyendo el link de encuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar el link en este momento." } };
  }
};
