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
// - El texto de cada pregunta es el VIGENTE del banco (Alfredo edita las
//   redacciones y quiere ver la nueva); si la pregunta ya no existe se usa su
//   copia congelada en vez de "(pregunta eliminada)".
// - Filtros: instructor/curso/modalidad exactos, herramienta = contiene el slug
//   en el JSON de herramientas del grupo (mismo criterio que listGruposAdmin),
//   fechas contra r.fecha (día de envío en hora de México). Herramienta y
//   Modalidad solo existen en respuestas del link por grupo — las del link
//   genérico no entran cuando se filtra por ellas.
// - La mediana del grupo para "fuera de sesión" se calcula sobre TODAS las
//   respuestas de cada grupo presente en el resultado (no solo las filtradas).
const { getPool, sql } = require("../src/backoffice-db");
const { getEncuestaPreguntasTable, getEncuestaConfigTable, listarTodas, bancoVigente, leerEscala, CATEGORIAS, COMENTARIO_ID } = require("../src/encuesta-tables");
const { promediosDeRespuesta, medianaMs, fueraDeSesion } = require("../src/encuesta-logic");
const { JSON_HEADERS } = require("../src/http");

const HERRAMIENTA_RE = /^[a-z]{2,20}$/;

module.exports = async function (context, req) {
  const { instructor, curso, modalidad, herramienta, desde, hasta } = req.query;

  try {
    const pool = await getPool();
    const condiciones = [];
    const aplicarFiltros = (request) => {
      if (instructor) request.input("instructor", sql.NVarChar, instructor);
      if (curso) request.input("curso", sql.NVarChar, curso);
      if (modalidad) request.input("modalidad", sql.NVarChar, modalidad);
      if (herramienta) request.input("herramienta", sql.NVarChar, `%"${herramienta}"%`);
      if (desde) request.input("desde", sql.Date, new Date(desde));
      if (hasta) request.input("hasta", sql.Date, new Date(hasta));
      return request;
    };

    if (instructor) condiciones.push("r.instructor = @instructor");
    if (curso) condiciones.push("r.curso = @curso");
    if (modalidad) condiciones.push("r.modalidad = @modalidad");
    if (herramienta) {
      if (!HERRAMIENTA_RE.test(herramienta)) {
        context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
        return;
      }
      condiciones.push("r.herramientas LIKE @herramienta");
    }
    if (desde) condiciones.push("r.fecha >= @desde");
    if (hasta) condiciones.push("r.fecha <= @hasta");
    const where = condiciones.length ? "WHERE " + condiciones.join(" AND ") : "";
    const whereGrupos = "WHERE " + condiciones.concat("r.grupo_id IS NOT NULL").join(" AND ");

    const result = await aplicarFiltros(pool.request()).query(`
      SELECT r.id AS respuesta_id, r.nombre, r.correo, c.nombre AS cliente, r.curso, r.instructor, r.fecha, r.fecha_envio,
             r.grupo_id, r.herramientas, r.modalidad, r.horas, r.link_generado_en,
             d.pregunta_id, d.valor, d.pregunta_texto, d.categoria, d.tipo
      FROM EncuestaRespuesta r
      JOIN Cliente c ON c.id = r.cliente_id
      JOIN EncuestaRespuestaDetalle d ON d.respuesta_id = r.id
      ${where}
      ORDER BY r.fecha_envio DESC, r.id, d.id
    `);

    // hora de envío de TODAS las respuestas de los grupos presentes → mediana por grupo
    const grupos = await aplicarFiltros(pool.request()).query(`
      SELECT grupo_id, fecha_envio FROM EncuestaRespuesta
      WHERE grupo_id IN (SELECT DISTINCT r.grupo_id FROM EncuestaRespuesta r ${whereGrupos})
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

    // banco vigente (texto actual) + escala + las 2 preguntas de Globales
    const entidades = await listarTodas(getEncuestaPreguntasTable());
    const bancoPorId = new Map(entidades.map((e) => [e.rowKey, e]));
    const globales = bancoVigente(entidades)
      .filter((e) => e.partitionKey === "Globales" && e.rowKey !== COMENTARIO_ID && (e.tipo || "escala") === "escala")
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .slice(0, 2)
      .map((e, i) => ({ id: e.rowKey, texto: e.texto || "", nombreCorto: (e.nombreCorto || "").trim() || `Global ${i + 1}` }));
    const escala = await leerEscala(getEncuestaConfigTable());

    const porId = new Map();
    for (const row of result.recordset) {
      if (!porId.has(row.respuesta_id)) {
        let herramientas = [];
        try { herramientas = row.herramientas ? JSON.parse(row.herramientas) : []; } catch (e) { herramientas = []; }
        porId.set(row.respuesta_id, {
          id: row.respuesta_id, nombre: row.nombre, correo: row.correo, cliente: row.cliente, curso: row.curso, instructor: row.instructor,
          fecha: row.fecha, fecha_envio: row.fecha_envio, grupo_id: row.grupo_id, herramientas, modalidad: row.modalidad,
          horas: row.horas, link_generado_en: row.link_generado_en, filas: [],
        });
      }
      const viva = bancoPorId.get(row.pregunta_id);
      porId.get(row.respuesta_id).filas.push({
        pregunta_id: row.pregunta_id,
        texto: viva ? viva.texto || "" : row.pregunta_texto || "(pregunta eliminada)",
        categoria: row.categoria || (viva ? viva.partitionKey : null),
        tipo: row.tipo || (viva ? viva.tipo || "escala" : "escala"),
        orden: viva && typeof viva.orden === "number" ? viva.orden : 999,
        valor: row.valor,
      });
    }

    const lista = Array.from(porId.values()).map((r) => {
      r.filas.sort((a, b) => (CATEGORIAS.indexOf(a.categoria) - CATEGORIAS.indexOf(b.categoria)) || (a.orden - b.orden));
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
    context.log.error("Error listando respuestas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las respuestas: " + err.message } };
  }
};
