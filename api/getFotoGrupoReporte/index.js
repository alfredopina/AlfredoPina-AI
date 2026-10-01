// getFotoGrupoReporte/index.js
// Function PÚBLICA: la foto de un grupo (?token=, el del reporte + &grupoId=)
// para reporte-resultados.html. A diferencia de getLogoIntermediario (un
// logo de marca, sin personas, servido solo por clienteId), esta foto puede
// mostrar caras de empleados del cliente — por eso NO se sirve solo con el
// grupoId: se exige el token del reporte que ya se compartió, se valida que
// ese grupo de verdad sea parte de ese reporte, y se respeta mostrarFoto tal
// como quedó congelado en el snapshot al generarse (si Alfredo apagó el
// permiso después, deja de servirse aunque el link del reporte siga vivo).
const { getCalificacionesReportesTable, leerReporteCalificaciones } = require("../src/calificaciones-reportes");
const { getFotoGrupoBuffer } = require("../src/grupo-foto-storage");
const { CODIGO_CORTO_RE } = require("../src/codigo-corto");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const token = String(req.query.token || "").trim();
  const grupoId = Number(req.query.grupoId);
  if (!CODIGO_CORTO_RE.test(token) || !grupoId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos." } };
    return;
  }

  try {
    const snapshot = await leerReporteCalificaciones(getCalificacionesReportesTable(), token);
    const g = snapshot && (snapshot.porGrupo || []).find((x) => x.grupoId === grupoId);
    if (!g || !g.mostrarFoto) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Sin foto." } };
      return;
    }
    const foto = await getFotoGrupoBuffer(grupoId);
    if (!foto) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Sin foto." } };
      return;
    }
    context.res = { status: 200, headers: { "Content-Type": foto.contentType, "Cache-Control": "public, max-age=3600" }, body: foto.buffer };
  } catch (err) {
    context.log.error("Error leyendo la foto del grupo para el reporte:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar la foto." } };
  }
};
