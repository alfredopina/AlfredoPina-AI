// getModeloEstadisticas/index.js
// Function protegida (rol "admin"): filas + última fecha por cada tabla del
// modelo de datos completo (Azure SQL + Table Storage), para el panel Modelo
// del admin. Solo lectura, no toca ninguna tabla de negocio real más allá de
// SELECT/listEntities. Se dispara nada más al pulsar "Actualizar" en el panel
// — a propósito no se llama sola al abrir el panel, mismo criterio que
// Tarifas/Respaldos en Configuración: evita despertar la base SQL serverless
// o recorrer las 8 tablas de Table Storage (sin COUNT nativo, hay que listar
// todas las entidades) solo por entrar a ver el diagrama.
const { getPool } = require("../src/backoffice-db");
const { TableClient } = require("@azure/data-tables");
const { JSON_HEADERS } = require("../src/http");

// tabla SQL → columna de fecha real más útil para "último registro". Varias
// tablas (Cliente, TarifaHerramienta, Alumno, EncuestaPregunta,
// EncuestaRespuestaDetalle, DiagnosticoRespuestaDetalle) no tienen ninguna
// columna de fecha en su esquema — se listan con NULL explícito en vez de
// inventar una. Los nombres de tabla son constantes fijas de este archivo
// (nunca vienen del request), así que interpolarlos directo en el SQL es
// seguro — no hay superficie de inyección.
const SQL_TABLAS = [
  { tabla: "Cliente", fechaCol: null },
  { tabla: "Contacto", fechaCol: "fecha_creacion" },
  { tabla: "TarifaHerramienta", fechaCol: null },
  { tabla: "Solicitud", fechaCol: "fecha_creacion" },
  { tabla: "Cotizacion", fechaCol: "fecha_creacion" },
  { tabla: "Grupo", fechaCol: "fecha_creacion" },
  { tabla: "GrupoFaseHistorial", fechaCol: "fecha" },
  { tabla: "Alumno", fechaCol: null },
  { tabla: "Diploma", fechaCol: "fecha_generacion" },
  { tabla: "EncuestaPregunta", fechaCol: null },
  { tabla: "EncuestaRespuesta", fechaCol: "fecha_envio" },
  { tabla: "EncuestaRespuestaDetalle", fechaCol: null },
  { tabla: "DiagnosticoPregunta", fechaCol: "fecha_creacion" },
  { tabla: "DiagnosticoRespuesta", fechaCol: "fecha_envio" },
  { tabla: "DiagnosticoRespuestaDetalle", fechaCol: null },
];

// Tablas de Azure Table Storage — todas viven en la misma cuenta
// (RECURSOS_STORAGE_CONNECTION). "última" aquí es el Timestamp de sistema de
// Table Storage (última escritura, no forzosamente "creación" — ej. archivar
// un Pendiente actualiza su Timestamp aunque no sea una fila nueva); el
// front lo etiqueta "última actividad" para no confundirlo con la fecha real
// de creación que sí reportan las tablas SQL.
const STORAGE_TABLAS = ["Temas", "TemariosEstandar", "Proyectos", "Cursos", "Recursos", "IntentosCodigo", "Pendientes", "AdminActividad"];

function isTableNotFound(err) {
  if (!err || err.statusCode !== 404) return false;
  return /TableNotFound/i.test(err.code || "") || /table.*not.*found/i.test(err.message || "");
}

async function contarTablaStorage(nombre) {
  try {
    const conn = process.env.RECURSOS_STORAGE_CONNECTION;
    const table = TableClient.fromConnectionString(conn, nombre);
    let filas = 0;
    let ultima = null;
    for await (const e of table.listEntities()) {
      filas++;
      const ts = e.timestamp;
      if (ts && (!ultima || ts > ultima)) ultima = ts;
    }
    return { tabla: nombre, filas, ultima };
  } catch (err) {
    if (isTableNotFound(err)) return { tabla: nombre, filas: 0, ultima: null };
    return { tabla: nombre, filas: null, ultima: null };
  }
}

module.exports = async function (context, req) {
  const resultado = { generado: new Date().toISOString(), sql: [], storage: [] };

  try {
    const pool = await getPool();
    const sqlSelects = SQL_TABLAS.map(
      (t) =>
        `SELECT '${t.tabla}' AS tabla, COUNT(*) AS filas, ${
          t.fechaCol ? `MAX(${t.fechaCol})` : "CAST(NULL AS DATETIME2)"
        } AS ultima FROM ${t.tabla}`
    ).join(" UNION ALL ");
    const r = await pool.request().query(sqlSelects);
    resultado.sql = r.recordset.map((row) => ({ tabla: row.tabla, filas: row.filas, ultima: row.ultima }));
  } catch (err) {
    context.log.error("Error leyendo tablas SQL del modelo:", err.message);
    resultado.sqlError = "No se pudo leer Azure SQL: " + err.message;
  }

  try {
    resultado.storage = await Promise.all(STORAGE_TABLAS.map(contarTablaStorage));
  } catch (err) {
    context.log.error("Error leyendo Table Storage del modelo:", err.message);
    resultado.storageError = "No se pudo leer Table Storage: " + err.message;
  }

  context.res = { status: 200, headers: JSON_HEADERS, body: resultado };
};
