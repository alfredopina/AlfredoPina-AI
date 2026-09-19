// listRespuestasEncuesta/index.js
// Function protegida (rol "admin"): respuestas con filtros para la pestaña
// "Resultados". Cada respuesta regresa con su detalle, los promedios ya
// calculados (Curso / Instructor / Aprendizaje / General), los 2 valores de
// Globales, el comentario, y la marca de "fuera de sesión".
//
// Fase 2 (2026-09-19) — decisiones (ver CLAUDE_DETALLE.md → Encuestas):
// - Los promedios se calculan AQUÍ, al leer, a partir de las respuestas
//   congeladas (categoría + valor). No se guardan: si mañana cambia un
//   criterio, no hay nada que migrar.
// - La consulta (filtros + texto vigente del banco) vive en
//   src/encuesta-consulta.js porque generarReporteEncuesta usa la misma.
// - La mediana del grupo para "fuera de sesión" se calcula sobre TODAS las
//   respuestas de cada grupo presente en el resultado (no solo las filtradas).
const { getPool, sql } = require("../src/backoffice-db");
const { getEncuestaConfigTable, leerEscala } = require("../src/encuesta-tables");
const { promediosDeRespuesta, medianaMs, fueraDeSesion } = require("../src/encuesta-logic");
const { leerRespuestasFiltradas } = require("../src/encuesta-consulta");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const { instructor, curso, modalidad, herramienta, desde, hasta } = req.query;

  try {
    const pool = await getPool();
    const { respuestas, globales, filtrosSql } = await leerRespuestasFiltradas(pool, sql, { instructor, curso, modalidad, herramienta, desde, hasta });

    // hora de envío de TODAS las respuestas de los grupos presentes → mediana por grupo
    const grupos = await filtrosSql.aplicar(pool.request()).query(`
      SELECT grupo_id, fecha_envio FROM EncuestaRespuesta
      WHERE grupo_id IN (SELECT DISTINCT r.grupo_id FROM EncuestaRespuesta r ${filtrosSql.whereGrupos})
    `);
    const tiemposPorGrupo = new Map();
    for (const g of grupos.recordset) {
      if (!tiemposPorGrupo.has(g.grupo_id)) tiemposPorGrupo.set(g.grupo_id, []);
      tiemposPorGrupo.get(g.grupo_id).push(new Date(g.fecha_envio).getTime());
    }

    // opciones de los filtros de Instructor/Curso: los valores que existen de verdad
    const [instrs, cursos] = await Promise.all([
      pool.request().query("SELECT DISTINCT instructor FROM EncuestaRespuesta WHERE instructor IS NOT NULL ORDER BY instructor"),
      pool.request().query("SELECT DISTINCT curso FROM EncuestaRespuesta WHERE curso IS NOT NULL ORDER BY curso"),
    ]);
    const escala = await leerEscala(getEncuestaConfigTable());

    const lista = respuestas.map((r) => {
      const comentarioFila = r.filas.find((f) => f.tipo === "texto");
      const tiempos = r.grupo_id != null ? tiemposPorGrupo.get(r.grupo_id) || [] : [];
      const mediana = medianaMs(tiempos);
      const fuera = r.grupo_id != null ? fueraDeSesion(new Date(r.fecha_envio).getTime(), mediana, tiempos.length) : null;
      return {
        ...r,
        respuestas: r.filas.map(({ orden, ...resto }) => resto),
        filas: undefined,
        comentario: comentarioFila ? comentarioFila.valor : null,
        promedios: promediosDeRespuesta(r.filas),
        globales: globales.map((g) => {
          const f = r.filas.find((x) => x.pregunta_id === g.id);
          return f ? Number(f.valor) : null;
        }),
        fuera_sesion: fuera ? { dif_ms: fuera.difMs, mediana: new Date(mediana).toISOString() } : null,
      };
    });

    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: { respuestas: lista, escala, globales, opciones: { instructores: instrs.recordset.map((x) => x.instructor), cursos: cursos.recordset.map((x) => x.curso) } },
    };
  } catch (err) {
    if (err.safe) {
      context.res = { status: err.status || 400, headers: JSON_HEADERS, body: { error: err.message } };
      return;
    }
    context.log.error("Error listando respuestas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las respuestas: " + err.message } };
  }
};
