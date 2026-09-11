// listPendientes/index.js
// Function protegida (rol "admin"): trae las 5 particiones completas
// (activas + archivadas, el volumen es mínimo) — el front separa por
// categoría y ordena las activas por `orden` (drag & drop / botón de
// ordenar) y las archivadas por fecha, no hace falta filtrar ni ordenar
// aquí. `orden` puede venir null en notas creadas antes de este campo — el
// front lo resuelve con la fecha de creación.
const { getPendientesTable, isTableNotFound } = require("../src/pendientes-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const table = getPendientesTable();
    const pendientes = [];
    try {
      const entidades = table.listEntities();
      for await (const p of entidades) {
        pendientes.push({
          categoria: p.partitionKey,
          id: p.rowKey,
          texto: p.texto || "",
          fecha_creacion: p.fecha_creacion || null,
          archivado: !!p.archivado,
          fecha_archivado: p.fecha_archivado || null,
          orden: (typeof p.orden === "number") ? p.orden : null,
        });
      }
    } catch (err) {
      if (!isTableNotFound(err)) throw err;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: pendientes };
  } catch (err) {
    context.log.error("Error listando pendientes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los pendientes: " + err.message } };
  }
};
