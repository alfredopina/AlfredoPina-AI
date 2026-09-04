// getRecursos/index.js
// Azure Function (modelo v3 clásico) pública: recibe herramienta + curso + código,
// valida el código contra la tabla "Cursos" y, si coincide, regresa los recursos
// de ese curso desde la tabla "Recursos" (Azure Table Storage). El navegador
// nunca ve el código correcto ni los recursos de un curso que no desbloqueó.
const { getCursosTable, getRecursosTable } = require("../src/recursos-tables");

const TIPOS = ["manual", "caso", "plantilla", "skill", "extra"];
const PLURAL = { manual: "manuales", caso: "casos", plantilla: "plantillas", skill: "skills", extra: "extra" };

module.exports = async function (context, req) {
  const herramienta = (req.query.herramienta || "").trim().toLowerCase();
  const curso = (req.query.curso || "").trim().toLowerCase();
  const codigo = (req.query.codigo || "").trim().toUpperCase();

  if (!herramienta || !curso || !codigo) {
    context.res = { status: 400, jsonBody: { error: "Faltan datos (herramienta, curso o código)." } };
    return;
  }

  let cursoEntity;
  try {
    const cursosTable = getCursosTable();
    cursoEntity = await cursosTable.getEntity(herramienta, curso);
  } catch (err) {
    if (err.statusCode === 404) {
      context.res = { status: 404, jsonBody: { error: "Ese curso no existe." } };
      return;
    }
    context.log.error("Error consultando la tabla Cursos:", err.message);
    context.res = { status: 500, jsonBody: { error: "No se pudo validar el curso. Intenta de nuevo en un momento." } };
    return;
  }

  if ((cursoEntity.codigo || "").trim().toUpperCase() !== codigo) {
    context.res = { status: 401, jsonBody: { error: "Código incorrecto." } };
    return;
  }

  const agrupado = { manuales: [], casos: [], plantillas: [], skills: [], extra: [] };

  try {
    const recursosTable = getRecursosTable();
    const partitionKey = `${herramienta}_${curso}`;
    const entidades = recursosTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
    });

    const todas = [];
    for await (const r of entidades) todas.push(r);
    todas.sort((a, b) => (a.orden || 0) - (b.orden || 0));

    for (const r of todas) {
      if (!TIPOS.includes(r.tipo)) continue;
      const item = { titulo: r.titulo || "", texto: r.texto || "" };
      if (r.tipo !== "skill") item.url = r.url || "#";
      agrupado[PLURAL[r.tipo]].push(item);
    }
  } catch (err) {
    context.log.error("Error consultando la tabla Recursos:", err.message);
    context.res = { status: 500, jsonBody: { error: "No se pudieron cargar los recursos. Intenta de nuevo en un momento." } };
    return;
  }

  context.res = {
    status: 200,
    jsonBody: { nombre: cursoEntity.nombre || curso, ...agrupado },
  };
};
