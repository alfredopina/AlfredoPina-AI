// listRespaldos/index.js
// Function protegida (rol "admin"): lista los últimos 20 respaldos del
// contenedor privado "respaldos", más recientes primero. El origen ("auto"/
// "manual") se lee del nombre del archivo; la fecha real viene de la fecha de
// creación del blob (más confiable que reconstruirla desde el nombre).
const { getRespaldosContainer } = require("../src/backup-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const container = await getRespaldosContainer();
    const items = [];
    for await (const blob of container.listBlobsFlat()) {
      // Ojo: \w incluye "_", así que /_(\w+)\.json$/ capturaba desde el PRIMER
      // guion bajo del nombre (ej. "0434_auto" en vez de "auto") — "auto"/"manual"
      // son los únicos valores posibles, se matchean literal para evitar eso.
      const m = /_(auto|manual)\.json$/.exec(blob.name);
      const generadoEn = (blob.properties && (blob.properties.createdOn || blob.properties.lastModified)) || null;
      items.push({
        nombre: blob.name,
        origen: m ? m[1] : "desconocido",
        generadoEn: generadoEn ? new Date(generadoEn).toISOString() : null,
      });
    }
    items.sort((a, b) => new Date(b.generadoEn || 0) - new Date(a.generadoEn || 0));

    context.res = { status: 200, headers: JSON_HEADERS, body: { respaldos: items.slice(0, 20) } };
  } catch (err) {
    context.log.error("Error listando respaldos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los respaldos." } };
  }
};
