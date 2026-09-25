// getVerifResumenDiplomas/index.js
// Function protegida (rol "admin"): cuántas veces se verificó cada diploma
// (por QR o por folio, cuántas llegaron desde LinkedIn, clics en el botón de
// LinkedIn y la última visita) — por diploma y sumado por grupo. Lee solo
// Table Storage (DiplomasVerif), nunca SQL, así el panel no despierta la base.
const { getDiplomasVerifTable, listarEstadisticas } = require("../src/diplomas-verif");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    context.res = { status: 200, headers: JSON_HEADERS, body: await listarEstadisticas(getDiplomasVerifTable()) };
  } catch (err) {
    context.log.error("Error leyendo estadísticas de verificación:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar las verificaciones." } };
  }
};
