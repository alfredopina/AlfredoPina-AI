// getDiplomasGrupoPublico/index.js
// Function PÚBLICA (diplomas-grupo.html no tiene sesión, igual que los
// reportes de Diagnóstico/Encuestas/Calificaciones): lee el snapshot de
// Table Storage por el token del grupo — nunca toca SQL. A diferencia de un
// Reporte, este link es el mismo siempre para ese grupo (no cambia en cada
// clic de "Generar"), así que si Alfredo anula un diploma o genera uno
// nuevo, el mismo link ya compartido con el cliente refleja el cambio.
const { getDiplomasGrupoTable, leerDiplomasGrupo, registrarVistaDiplomasGrupo } = require("../src/diplomas-reportes");
const { CODIGO_CORTO_RE } = require("../src/codigo-corto");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const token = String(req.query.token || "").trim();
  if (!CODIGO_CORTO_RE.test(token)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el token." } };
    return;
  }

  try {
    const table = getDiplomasGrupoTable();
    const snapshot = await leerDiplomasGrupo(table, token);
    if (!snapshot) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese link no existe o ya no está disponible." } };
      return;
    }
    registrarVistaDiplomasGrupo(table, token).catch((err) => context.log.error("Error registrando vista de diplomas:", err.message));
    context.res = { status: 200, headers: JSON_HEADERS, body: snapshot };
  } catch (err) {
    context.log.error("Error leyendo diplomas públicos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los diplomas." } };
  }
};
