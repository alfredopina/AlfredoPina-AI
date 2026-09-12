// listNombresCursoAdmin/index.js
// Function protegida (rol "admin"): nombres de curso ya usados en Grupos
// anteriores, para sugerir (datalist) en "Nombre del curso" al dar de alta
// uno nuevo — sigue siendo texto libre, esto solo evita variaciones de
// espacios/acentos del mismo curso ya capturado antes. Crece solo conforme
// Alfredo va dando de alta Grupos, no depende de ningún catálogo aparte
// (Cursos/TemariosEstandar es un módulo independiente, sin relación con
// Grupo — ver CLAUDE.md).
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT DISTINCT nombre_curso FROM Grupo WHERE nombre_curso IS NOT NULL AND LTRIM(RTRIM(nombre_curso)) <> '' ORDER BY nombre_curso");
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset.map((r) => r.nombre_curso) };
  } catch (err) {
    context.log.error("Error listando nombres de curso:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los nombres de curso." } };
  }
};
