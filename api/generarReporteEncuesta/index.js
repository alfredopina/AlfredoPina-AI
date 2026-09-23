// generarReporteEncuesta/index.js
// Function protegida (rol "admin"): arma el snapshot de un Reporte de
// Encuestas con los MISMOS filtros que Alfredo ve en Resultados (Instructor,
// Herramienta, Curso, Modalidad, fechas — ver src/encuesta-consulta.js) y lo
// guarda en Table Storage con un token opaco nuevo. La página pública solo lee
// ese snapshot, nunca vuelve a tocar SQL. Cada clic crea un token nuevo.
//
// Entran TODAS las respuestas y TODOS los comentarios (decisión de Alfredo):
// si un comentario es ofensivo para un instructor, se borra la respuesta en
// Resultados antes de generar. Un reporte ya generado NO cambia si después se
// borra una respuesta — hay que eliminarlo y volver a generarlo.
const { getPool, sql } = require("../src/backoffice-db");
const { leerRespuestasFiltradas } = require("../src/encuesta-consulta");
const { getEncuestaConfigTable, leerEscala } = require("../src/encuesta-tables");
const { calcularSnapshot } = require("../src/encuesta-reporte-calc");
const { getEncuestaReportesTable, leerReporteEncuesta, guardarReporteEncuesta } = require("../src/encuesta-reportes");
const { codigoCortoUnico } = require("../src/codigo-corto");
const { JSON_HEADERS } = require("../src/http");

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const ETIQUETA_MAX = 80;

module.exports = async function (context, req) {
  const body = req.body || {};
  const texto = (v) => (typeof v === "string" ? v.trim() : "");
  const filtros = {
    cliente: texto(body.cliente),
    instructor: texto(body.instructor),
    curso: texto(body.curso),
    modalidad: texto(body.modalidad),
    herramienta: texto(body.herramienta),
    desde: texto(body.desde),
    hasta: texto(body.hasta),
  };
  for (const campo of ["desde", "hasta"]) {
    if (filtros[campo] && !FECHA_RE.test(filtros[campo])) {
      context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Fecha inválida en los filtros." } };
      return;
    }
  }
  const etiqueta = texto(body.etiqueta).slice(0, ETIQUETA_MAX);

  try {
    const pool = await getPool();
    const { respuestas, globales } = await leerRespuestasFiltradas(pool, sql, filtros);
    if (!respuestas.length) {
      context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No hay respuestas con esos filtros." } };
      return;
    }

    const escala = await leerEscala(getEncuestaConfigTable());
    const filtrosLimpios = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
    const snapshot = calcularSnapshot({ respuestas, globales, escala, filtros: filtrosLimpios, etiqueta, ahora: new Date() });

    const table = getEncuestaReportesTable();
    const token = await codigoCortoUnico(async (candidato) => Boolean(await leerReporteEncuesta(table, candidato)));
    await guardarReporteEncuesta(table, { token, snapshot });
    context.res = { status: 200, headers: JSON_HEADERS, body: { token, n: snapshot.n } };
  } catch (err) {
    if (err.safe) {
      context.res = { status: err.status || 400, headers: JSON_HEADERS, body: { error: err.message } };
      return;
    }
    context.log.error("Error generando el reporte de encuestas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo generar el reporte: " + err.message } };
  }
};
