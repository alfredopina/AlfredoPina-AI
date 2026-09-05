// getCatalogoCursos/index.js
// Function pública (v3 clásico): para una herramienta, regresa los temas
// publicados (banco para el constructor "Personalizado"), los temarios
// estándar publicados (con sus temas resueltos y horas/nivel calculados) y los
// proyectos publicados (para que el constructor calcule en vivo cuál se
// desbloquea según lo que el usuario va seleccionando). cursos.html la usa
// para armar ambas vistas de una herramienta sin hardcodear nada.
const { getTemasTable, getTemariosTable, getProyectosTable, isTableNotFound } = require("../src/cursos-tables");
const { HERRAMIENTAS } = require("../src/herramientas");
const { resolverTemario, proyectoCubierto, parseTemaIds } = require("../src/cursos-calc");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

async function listPartition(table, herramienta) {
  const out = [];
  try {
    const entidades = table.listEntities({ queryOptions: { filter: `PartitionKey eq '${herramienta}'` } });
    for await (const e of entidades) out.push(e);
  } catch (err) {
    if (!isTableNotFound(err)) throw err;
  }
  return out;
}

module.exports = async function (context, req) {
  const herramienta = (req.query.herramienta || "").trim().toLowerCase();
  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }

  try {
    const [temasEntities, temariosEntities, proyectosEntities] = await Promise.all([
      listPartition(getTemasTable(), herramienta),
      listPartition(getTemariosTable(), herramienta),
      listPartition(getProyectosTable(), herramienta),
    ]);

    const temasPorId = {};
    temasEntities.forEach((t) => { temasPorId[t.rowKey] = t; });

    const temasPublicados = temasEntities
      .filter((t) => t.estado === "publicado")
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map((t) => ({ id: t.rowKey, nombre: t.nombre || "", descripcion: t.descripcion || "", horas: Number(t.horas) || 0, nivel: Number(t.nivel) || 0 }));

    const proyectosPublicados = proyectosEntities
      .filter((p) => p.estado === "publicado")
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map((p) => ({ id: p.rowKey, nombre: p.nombre || "", objetivo: p.objetivo || "", temaIds: parseTemaIds(p.temaIds) }));

    const estandarPublicados = temariosEntities
      .filter((t) => t.estado === "publicado")
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map((t) => {
        const { temas, horas, nivelLabel } = resolverTemario(t, temasPorId);
        const temaIdsSet = new Set(temas.map((x) => x.id));
        const proyectos = proyectosPublicados
          .filter((p) => proyectoCubierto(p.temaIds, temaIdsSet))
          .map((p) => p.nombre);
        const tags = (t.tags || "").split(",").map((s) => s.trim()).filter(Boolean);
        return {
          id: t.rowKey,
          nombre: t.nombre || "",
          objetivo: t.objetivo || "",
          dirigido: t.dirigido || "",
          tags,
          horas,
          nivelLabel,
          temas,
          proyectos,
        };
      });

    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: { temas: temasPublicados, estandar: estandarPublicados, proyectos: proyectosPublicados },
    };
  } catch (err) {
    context.log.error("Error consultando el catálogo de cursos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar el catálogo." } };
  }
};
