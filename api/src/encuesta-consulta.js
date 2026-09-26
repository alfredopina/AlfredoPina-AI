// Consulta compartida de respuestas de Encuestas con filtros — la usan
// listRespuestasEncuesta (pestaña Resultados) y generarReporteEncuesta (el
// Reporte se arma con EXACTAMENTE los mismos filtros y las mismas filas que
// Alfredo ve en Resultados, así que no puede haber dos criterios distintos).
//
// Filtros: instructor/curso/modalidad exactos, herramienta = contiene el slug
// en el JSON de herramientas del grupo (mismo criterio que listGruposAdmin),
// fechas contra r.fecha (día de envío en hora de México). Herramienta y
// Modalidad solo existen en respuestas del link por grupo — las del link
// genérico no entran cuando se filtra por ellas.
const { getEncuestaPreguntasTable, listarTodas, bancoVigente, CATEGORIAS, COMENTARIO_ID } = require("./encuesta-tables");
const { errorSeguro } = require("./encuesta-logic");

const HERRAMIENTA_RE = /^[a-z]{2,20}$/;

// Nombres por default de las 2 preguntas de escala de Globales cuando Alfredo
// no les puso "nombre corto" (Resultados y Reporte usan los mismos).
const GLOBALES_DEFAULT = ["Satisfacción", "Recomendación"];

function construirFiltros(sql, { cliente, instructor, curso, modalidad, herramienta, desde, hasta } = {}) {
  const condiciones = [];
  // r.cliente_id → Cliente: las consultas que usan estas condiciones deben hacer JOIN Cliente c
  if (cliente) condiciones.push("c.nombre = @cliente");
  if (instructor) condiciones.push("r.instructor = @instructor");
  if (curso) condiciones.push("r.curso = @curso");
  if (modalidad) condiciones.push("r.modalidad = @modalidad");
  if (herramienta) {
    if (!HERRAMIENTA_RE.test(herramienta)) throw errorSeguro("Herramienta inválida.", 400);
    condiciones.push("r.herramientas LIKE @herramienta");
  }
  if (desde) condiciones.push("r.fecha >= @desde");
  if (hasta) condiciones.push("r.fecha <= @hasta");
  return {
    where: condiciones.length ? "WHERE " + condiciones.join(" AND ") : "",
    whereGrupos: "WHERE " + condiciones.concat("r.grupo_id IS NOT NULL").join(" AND "),
    aplicar(request) {
      if (cliente) request.input("cliente", sql.NVarChar, cliente);
      if (instructor) request.input("instructor", sql.NVarChar, instructor);
      if (curso) request.input("curso", sql.NVarChar, curso);
      if (modalidad) request.input("modalidad", sql.NVarChar, modalidad);
      if (herramienta) request.input("herramienta", sql.NVarChar, `%"${herramienta}"%`);
      if (desde) request.input("desde", sql.Date, new Date(desde));
      if (hasta) request.input("hasta", sql.Date, new Date(hasta));
      return request;
    },
  };
}

// Las 2 preguntas de escala de Globales, en orden, con su nombre corto.
function globalesDelBanco(entidades) {
  return bancoVigente(entidades)
    .filter((e) => e.partitionKey === "Globales" && e.rowKey !== COMENTARIO_ID && (e.tipo || "escala") === "escala")
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .slice(0, 2)
    .map((e, i) => ({ id: e.rowKey, texto: e.texto || "", nombreCorto: (e.nombreCorto || "").trim() || GLOBALES_DEFAULT[i] }));
}

// Respuestas filtradas con su detalle. El texto de cada pregunta es el VIGENTE
// del banco (Alfredo edita las redacciones y quiere ver la nueva); si la
// pregunta ya no existe se usa su copia congelada.
async function leerRespuestasFiltradas(pool, sql, filtros) {
  const f = construirFiltros(sql, filtros);
  const result = await f.aplicar(pool.request()).query(`
    SELECT r.id AS respuesta_id, r.nombre, r.correo, c.nombre AS cliente, r.curso, r.instructor, r.fecha, r.fecha_envio,
           r.grupo_id, r.herramientas, r.modalidad, r.horas, r.link_generado_en, r.autoriza_testimonio,
           d.pregunta_id, d.valor, d.pregunta_texto, d.categoria, d.tipo
    FROM EncuestaRespuesta r
    JOIN Cliente c ON c.id = r.cliente_id
    JOIN EncuestaRespuestaDetalle d ON d.respuesta_id = r.id
    ${f.where}
    ORDER BY r.fecha_envio DESC, r.id, d.id
  `);

  const entidades = await listarTodas(getEncuestaPreguntasTable());
  const bancoPorId = new Map(entidades.map((e) => [e.rowKey, e]));

  const porId = new Map();
  for (const row of result.recordset) {
    if (!porId.has(row.respuesta_id)) {
      let herramientas = [];
      try { herramientas = row.herramientas ? JSON.parse(row.herramientas) : []; } catch (e) { herramientas = []; }
      porId.set(row.respuesta_id, {
        id: row.respuesta_id, nombre: row.nombre, correo: row.correo, cliente: row.cliente, curso: row.curso, instructor: row.instructor,
        fecha: row.fecha, fecha_envio: row.fecha_envio, grupo_id: row.grupo_id, herramientas, modalidad: row.modalidad,
        horas: row.horas, link_generado_en: row.link_generado_en, autoriza_testimonio: Boolean(row.autoriza_testimonio), filas: [],
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
  const respuestas = Array.from(porId.values());
  for (const r of respuestas) r.filas.sort((a, b) => (CATEGORIAS.indexOf(a.categoria) - CATEGORIAS.indexOf(b.categoria)) || (a.orden - b.orden));

  return { respuestas, entidades, globales: globalesDelBanco(entidades), filtrosSql: f };
}

module.exports = { HERRAMIENTA_RE, GLOBALES_DEFAULT, construirFiltros, globalesDelBanco, leerRespuestasFiltradas };
