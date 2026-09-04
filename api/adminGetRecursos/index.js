// adminGetRecursos/index.js
// Function protegida (rol "admin"): regresa TODOS los recursos de un curso, sin
// agrupar y con su rowKey — a diferencia de getRecursos (pública), no exige
// código ni exige que el curso esté publicado, porque el admin edita cursos
// en borrador igual que publicados.
const { getRecursosTable } = require("../src/recursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const herramienta = (req.query.herramienta || "").trim().toLowerCase();
  const curso = (req.query.curso || "").trim().toLowerCase();

  if (!HERRAMIENTAS.includes(herramienta) || !curso) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (herramienta o curso)." } };
    return;
  }

  try {
    const recursosTable = getRecursosTable();
    const partitionKey = `${herramienta}_${curso}`;
    const entidades = recursosTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
    });

    const recursos = [];
    for await (const r of entidades) {
      recursos.push({
        rowKey: r.rowKey,
        tipo: r.tipo || "",
        titulo: r.titulo || "",
        texto: r.texto || "",
        url: r.url || "",
        orden: r.orden || 0,
      });
    }
    recursos.sort((a, b) => a.orden - b.orden);

    context.res = { status: 200, headers: JSON_HEADERS, body: { recursos } };
  } catch (err) {
    context.log.error("Error consultando la tabla Recursos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los recursos." } };
  }
};
