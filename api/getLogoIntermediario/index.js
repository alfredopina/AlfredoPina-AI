// getLogoIntermediario/index.js
// Function PÚBLICA: el logo de un Cliente Intermediario (?cliente={id}) para
// el bloque "Socio Comercial" de los Reportes. No toca SQL — el permiso de
// mostrarlo ya quedó congelado en el snapshot del reporte al generarse (ver
// calificaciones-reporte-calc.js), esta Function solo sirve el blob si
// existe. 404 si no tiene logo, igual que getFotoInstructor.
const { getLogoIntermediarioBuffer } = require("../src/intermediarios-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const clienteId = Number(req.query.cliente);
  if (!clienteId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el cliente." } };
    return;
  }
  try {
    const buffer = await getLogoIntermediarioBuffer(clienteId);
    if (!buffer) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Sin logo." } };
      return;
    }
    context.res = { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" }, body: buffer };
  } catch (err) {
    context.log.error("Error leyendo el logo del intermediario:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar el logo." } };
  }
};
