// getResumenCompletitudAdmin/index.js
// Function protegida (rol "admin"): cruza el módulo Cursos (TemariosEstandar,
// Proyectos) con el módulo Recursos (Cursos, Recursos) a través del campo
// `temarioId` que ahora guarda el Curso de Recursos, para calcular por
// herramienta qué % de sus cursos publicados están "completos".
//
// Un curso se considera completo si tiene al menos 1 recurso tipo "manual"
// cargado (en la práctica un curso solo lleva un manual, así que esto
// equivale a "¿ya le subiste el manual?"). Temas y proyectos desbloqueados
// se siguen calculando y regresando para el detalle del drill-down, pero
// ya no forman parte de la regla de completitud.
const { getTemariosTable, getProyectosTable, isTableNotFound } = require("../src/cursos-tables");
const { getCursosTable, getRecursosTable } = require("../src/recursos-tables");
const { parseTemaIds, proyectoCubierto } = require("../src/cursos-calc");
const { HERRAMIENTAS } = require("../src/herramientas");

const { JSON_HEADERS } = require("../src/http");
const TIPOS = ["manual", "caso", "plantilla", "skill", "extra"];

module.exports = async function (context, req) {
  try {
    // Temarios Estándar de todas las herramientas, indexados por "herramienta::id"
    const temariosPorClave = {};
    try {
      for await (const t of getTemariosTable().listEntities()) {
        temariosPorClave[`${t.partitionKey}::${t.rowKey}`] = t;
      }
    } catch (err) {
      if (!isTableNotFound(err)) throw err;
    }

    // Proyectos, agrupados por herramienta
    const proyectosPorHerramienta = {};
    HERRAMIENTAS.forEach((h) => { proyectosPorHerramienta[h] = []; });
    try {
      for await (const p of getProyectosTable().listEntities()) {
        if (!proyectosPorHerramienta[p.partitionKey]) continue;
        proyectosPorHerramienta[p.partitionKey].push({ nombre: p.nombre || "", temaIds: parseTemaIds(p.temaIds) });
      }
    } catch (err) {
      if (!isTableNotFound(err)) throw err;
    }

    // Cursos de Recursos (código de descarga), agrupados por herramienta — solo publicados
    const cursosPorHerramienta = {};
    HERRAMIENTAS.forEach((h) => { cursosPorHerramienta[h] = []; });
    for await (const c of getCursosTable().listEntities()) {
      if (!cursosPorHerramienta[c.partitionKey]) continue;
      if (c.estado !== "publicado") continue;
      cursosPorHerramienta[c.partitionKey].push({ id: c.rowKey, nombre: c.nombre || "", temarioId: (c.temarioId || "").trim() });
    }

    // Recursos, contados por "herramienta_cursoId" y tipo
    const conteoPorCurso = {};
    for await (const r of getRecursosTable().listEntities()) {
      const clave = r.partitionKey; // "<herramienta>_<cursoId>"
      if (!conteoPorCurso[clave]) conteoPorCurso[clave] = {};
      const tipo = r.tipo;
      conteoPorCurso[clave][tipo] = (conteoPorCurso[clave][tipo] || 0) + 1;
    }

    const resumen = {};
    HERRAMIENTAS.forEach((h) => {
      const cursos = cursosPorHerramienta[h].map((curso) => {
        const temario = curso.temarioId ? temariosPorClave[`${h}::${curso.temarioId}`] : null;
        const temaIds = temario ? parseTemaIds(temario.temaIds) : [];
        const temaIdsSet = new Set(temaIds);
        const proyectos = proyectosPorHerramienta[h]
          .filter((p) => proyectoCubierto(p.temaIds, temaIdsSet))
          .map((p) => p.nombre);
        const conteo = conteoPorCurso[`${h}_${curso.id}`] || {};
        const recursos = {};
        TIPOS.forEach((tipo) => { recursos[tipo] = conteo[tipo] || 0; });
        const completo = recursos.manual >= 1;

        return { id: curso.id, nombre: curso.nombre, temarioId: curso.temarioId, temas: temaIds.length, proyectos, recursos, completo };
      });

      const cursosCompletos = cursos.filter((c) => c.completo).length;
      const pctCompleto = cursos.length ? Math.round((cursosCompletos / cursos.length) * 100) : 0;

      resumen[h] = { pctCompleto, cursosCompletos, cursosPublicados: cursos.length, cursos };
    });

    context.res = { status: 200, headers: JSON_HEADERS, body: resumen };
  } catch (err) {
    context.log.error("Error consultando el resumen de completitud:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar el resumen: " + err.message } };
  }
};
