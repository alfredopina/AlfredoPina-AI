// getFotoGrupo/index.js
// Function protegida (rol "admin"): la foto de un grupo (?grupoId=) para la
// vista previa en Calificaciones → Cargar Calificaciones. Distinta de
// getFotoGrupoReporte (pública, gateada por token) — aquí ya se entró con
// sesión de admin, no hace falta validar nada más.
const { getFotoGrupoBuffer } = require("../src/grupo-foto-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const grupoId = Number(req.query.grupoId);
  if (!grupoId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el grupo." } };
    return;
  }
  try {
    const foto = await getFotoGrupoBuffer(grupoId);
    if (!foto) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Sin foto." } };
      return;
    }
    context.res = { status: 200, headers: { "Content-Type": foto.contentType, "Cache-Control": "private, max-age=60" }, body: foto.buffer };
  } catch (err) {
    context.log.error("Error leyendo la foto del grupo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar la foto." } };
  }
};
