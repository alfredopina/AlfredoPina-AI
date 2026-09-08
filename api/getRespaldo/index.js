// getRespaldo/index.js
// Function protegida (rol "admin"): regresa el JSON de un respaldo desde el
// contenedor privado "respaldos" en streaming — mismo patrón que getDiplomaPdf
// para blobs privados, pero con "attachment" (se descarga, no se previsualiza).
const { getRespaldosContainer } = require("../src/backup-tables");
const { JSON_HEADERS } = require("../src/http");

const NOMBRE_RE = /^\d{4}-\d{2}-\d{2}_\d{4}_(auto|manual)\.json$/;

module.exports = async function (context, req) {
  const nombre = (req.query.nombre || "").trim();
  if (!nombre || !NOMBRE_RE.test(nombre)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Nombre de respaldo inválido." } };
    return;
  }

  try {
    const container = await getRespaldosContainer();
    const buffer = await container.getBlockBlobClient(nombre).downloadToBuffer();

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "no-store",
      },
      body: buffer,
    };
  } catch (err) {
    if (err.statusCode === 404) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese respaldo no existe." } };
      return;
    }
    context.log.error("Error descargando el respaldo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo descargar el respaldo." } };
  }
};
