// getPropuestaPublica/index.js
// Function PÚBLICA (propuesta.html no tiene sesión): lee el snapshot de la propuesta por su código opaco en Table
// Storage — nunca toca SQL, así abre al instante aunque la base esté dormida. La visita se cuenta SOLO si no es el
// admin ni un robot de vista previa de links (WhatsApp, LinkedIn…); al admin se le devuelve además `admin` con las
// estadísticas del cliente (la barra "vista admin" de la página).
const { getPropuestasTable, leerPropuesta, registrarVistaPropuesta } = require("../src/propuestas");
const { CODIGO_CORTO_RE } = require("../src/codigo-corto");
const { esAdmin, esBot } = require("../src/verif-cliente");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const codigo = String(req.query.codigo || "").trim().toLowerCase();
  if (!CODIGO_CORTO_RE.test(codigo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el código de la propuesta." } };
    return;
  }

  try {
    const table = getPropuestasTable();
    const p = await leerPropuesta(table, codigo);
    if (!p) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa propuesta no existe o ya no está disponible." } };
      return;
    }
    const admin = esAdmin(req);
    if (!admin && !esBot(req)) registrarVistaPropuesta(table, codigo).catch((err) => context.log.error("Error registrando vista de la propuesta:", err.message));

    const cuerpo = {
      propuesta: p.snapshot,
      reemplazadaPor: p.vivo.reemplazadaPorCodigo ? { codigo: p.vivo.reemplazadaPorCodigo, folio: p.vivo.reemplazadaPorFolio } : null,
      aceptada: Boolean(p.vivo.aceptadaEn),
    };
    if (admin) cuerpo.admin = { vistas: p.vivo.vistas, primeraVista: p.vivo.primeraVista, ultimaVista: p.vivo.ultimaVista, aceptadaEn: p.vivo.aceptadaEn, aceptadaPor: p.vivo.aceptadaPor, aceptadaComentario: p.vivo.aceptadaComentario };
    context.res = { status: 200, headers: { ...JSON_HEADERS, "Cache-Control": "no-store" }, body: cuerpo };
  } catch (err) {
    context.log.error("Error leyendo la propuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar la propuesta." } };
  }
};
