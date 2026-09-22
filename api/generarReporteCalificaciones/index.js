// generarReporteCalificaciones/index.js
// Function protegida (rol "admin"): arma el snapshot del Reporte de
// Resultados — o de UN grupo exacto (`grupoId`, el botón "Reporte" de cada
// fila de Resultados, acceso directo) o de los mismos filtros que Alfredo ve
// en Resultados (Empresa/Herramienta/Curso/Instructor/Fechas) — y lo guarda
// en Table Storage con un token opaco nuevo. La página pública solo lee ese
// snapshot, nunca vuelve a tocar SQL. Cada clic crea un token nuevo (mismo
// criterio que generarReporteEncuesta): un reporte ya generado no cambia
// aunque después se editen o borren calificaciones — hay que regenerarlo.
const { getPool } = require("../src/backoffice-db");
const { leerCalificacionesFiltradas } = require("../src/calificaciones-reporte-consulta");
const { calcularSnapshot } = require("../src/calificaciones-reporte-calc");
const { getCalificacionesReportesTable, nuevoToken, guardarReporteCalificaciones } = require("../src/calificaciones-reportes");
const { JSON_HEADERS } = require("../src/http");

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const ETIQUETA_MAX = 80;

module.exports = async function (context, req) {
  const body = req.body || {};
  const texto = (v) => (typeof v === "string" ? v.trim() : "");
  const grupoId = Number(body.grupoId) || null;
  const filtros = grupoId
    ? {}
    : {
        empresa: texto(body.empresa),
        herramienta: texto(body.herramienta),
        curso: texto(body.curso),
        instructor: texto(body.instructor),
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
    const filas = await leerCalificacionesFiltradas(pool, { grupoId, ...filtros });
    if (!filas.length) {
      context.res = { status: 400, headers: JSON_HEADERS, body: { error: grupoId ? "Ese grupo no tiene calificaciones cargadas." : "No hay calificaciones con esos filtros." } };
      return;
    }

    const filtrosLimpios = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
    const snapshot = calcularSnapshot({ filas, filtros: filtrosLimpios, etiqueta, ahora: new Date() });

    const token = nuevoToken();
    await guardarReporteCalificaciones(getCalificacionesReportesTable(), { token, snapshot });
    context.res = { status: 200, headers: JSON_HEADERS, body: { token, n: snapshot.n, nGrupos: snapshot.nGrupos } };
  } catch (err) {
    context.log.error("Error generando el reporte de calificaciones:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo generar el reporte: " + err.message } };
  }
};
