// eliminarFotoGrupo/index.js
// Function protegida (rol "admin"): borra solo la foto del grupo (el
// permiso "mostrar en el reporte" se queda como esté — el próximo reporte
// simplemente no tendrá foto que mostrar).
const { eliminarFotoGrupo } = require("../src/grupo-foto-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const grupoId = Number((req.body || {}).grupoId);
  if (!grupoId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el grupo." } };
    return;
  }
  try {
    await eliminarFotoGrupo(grupoId);
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando la foto del grupo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar la foto: " + err.message } };
  }
};
