// listTemasAdmin/index.js
// Function protegida (rol "admin"): lista TODOS los temas de una herramienta,
// sin importar su estado — a diferencia de getCatalogoCursos, que es pública
// y solo regresa temas publicados.
const { getTemasTable, isTableNotFound } = require("../src/cursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const herramienta = (req.query.herramienta || "").trim().toLowerCase();
  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }

  try {
    const temasTable = getTemasTable();
    const temas = [];
    try {
      const entidades = temasTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${herramienta}'` } });
      for await (const t of entidades) {
        temas.push({
          id: t.rowKey,
          nombre: t.nombre || "",
          descripcion: t.descripcion || "",
          horas: Number(t.horas) || 0,
          nivel: Number(t.nivel) || 0,
          estado: t.estado || "borrador",
          orden: t.orden || 0,
        });
      }
    } catch (err) {
      if (!isTableNotFound(err)) throw err;
    }
    temas.sort((a, b) => (a.orden || 0) - (b.orden || 0));

    context.res = { status: 200, headers: JSON_HEADERS, body: { temas } };
  } catch (err) {
    context.log.error("Error consultando la tabla Temas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los temas: " + err.message } };
  }
};
