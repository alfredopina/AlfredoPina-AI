// eliminarFirma/index.js
// Function protegida (rol "admin"): borra solo la firma de un instructor —
// el instructor se queda en la lista, sus próximos diplomas salen sin firma
// hasta que suba una nueva.
const { eliminarFirma, slugify } = require("../src/plantillas-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const instructor = ((req.body || {}).instructor || "").trim();
  if (!instructor) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el instructor." } };
    return;
  }

  try {
    await eliminarFirma(slugify(instructor));
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error eliminando la firma:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo eliminar la firma: " + err.message } };
  }
};
