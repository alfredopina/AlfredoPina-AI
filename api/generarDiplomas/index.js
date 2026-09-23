// generarDiplomas/index.js
// Function protegida (rol "admin"): genera los diplomas de UN grupo ya
// calificado (botón "Crear Diplomas" de la fila en Resultados de
// Calificaciones) — un diploma por cada alumno con resultado Aprobado o
// Participó (No Aprobado nunca lleva diploma). Reintentable: si un alumno ya
// tiene un diploma vigente para ese grupo, se omite (no duplica folio); así
// un segundo clic solo genera lo que falte (ej. alguien que se corrigió de
// "No Aprobado" a "Aprobado" después del primer lote).
//
// El diploma CONGELA los datos del grupo/alumno al momento de generar
// (folio, herramientas, curso, nivel, fechas, instructor, horas, resultado) —
// no es un JOIN en vivo. Si luego editas la calificación, el diploma ya
// emitido no cambia solo; la corrección es anularlo y volver a generar.
//
// El link público es UNO por grupo (Grupo.diploma_token), no por alumno — se
// crea la primera vez y se reusa siempre. Cada vez que se generan diplomas
// nuevos se reescribe el snapshot completo en Table Storage (todos los
// vigentes del grupo), para que ese mismo link refleje lo último.
const crypto = require("crypto");
const { getPool, sql } = require("../src/backoffice-db");
const { leerCalificacionesFiltradas } = require("../src/calificaciones-reporte-consulta");
const { siguienteConsecutivo, anioCorto, nivelTexto } = require("../src/diploma-folio");
const { getDiplomasGrupoTable, guardarDiplomasGrupo } = require("../src/diplomas-reportes");
const { JSON_HEADERS } = require("../src/http");

const RESULTADOS_CON_DIPLOMA = ["Aprobado", "Participó"];

module.exports = async function (context, req) {
  const grupoId = Number((req.body || {}).grupoId);
  if (!grupoId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el grupo." } };
    return;
  }

  let pool;
  try {
    pool = await getPool();
  } catch (err) {
    context.log.error("Error conectando a la base:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo conectar a la base: " + err.message } };
    return;
  }

  let filas;
  try {
    filas = await leerCalificacionesFiltradas(pool, { grupoId });
  } catch (err) {
    context.log.error("Error leyendo calificaciones del grupo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo leer el grupo: " + err.message } };
    return;
  }

  if (!filas.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Este grupo no tiene calificaciones cargadas." } };
    return;
  }

  const elegibles = filas.filter((f) => RESULTADOS_CON_DIPLOMA.includes(f.resultado));
  if (!elegibles.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Ningún alumno de este grupo aprobó o participó — no hay diplomas que generar." } };
    return;
  }

  const g = filas[0];
  const yy = anioCorto();

  try {
    const yaVigentes = await pool.request().input("grupoId", sql.Int, grupoId).query("SELECT alumno_id FROM Diploma WHERE grupo_id = @grupoId AND estatus = 'vigente'");
    const alumnosConDiploma = new Set(yaVigentes.recordset.map((r) => r.alumno_id));

    const pendientes = elegibles.filter((f) => !alumnosConDiploma.has(f.alumno_id));
    let consecutivo = pendientes.length ? await siguienteConsecutivo(pool, g.cliente_id, yy) : 0;
    const nivel = nivelTexto(g.niveles);
    const generados = [];

    for (const f of pendientes) {
      const folio = `AP_${g.cliente_codigo}_${yy}-${consecutivo}`;
      consecutivo += 1;
      await pool
        .request()
        .input("folio", sql.NVarChar, folio)
        .input("alumnoId", sql.Int, f.alumno_id)
        .input("clienteId", sql.Int, g.cliente_id)
        .input("grupoId", sql.Int, grupoId)
        .input("herramientas", sql.NVarChar, g.herramientas)
        .input("curso", sql.NVarChar, g.nombre_curso || "")
        .input("nivel", sql.NVarChar, nivel)
        .input("fechaInicio", sql.Date, g.fecha_inicio)
        .input("fechaFin", sql.Date, g.fecha_fin)
        .input("resultado", sql.NVarChar, f.resultado)
        .input("instructor", sql.NVarChar, g.instructor || "")
        .input("horas", sql.Int, g.horas ? Math.round(g.horas) : null)
        .query(
          `INSERT INTO Diploma (folio, alumno_id, cliente_id, grupo_id, herramientas, curso, nivel, fecha_inicio, fecha_fin, resultado, instructor, horas)
           VALUES (@folio, @alumnoId, @clienteId, @grupoId, @herramientas, @curso, @nivel, @fechaInicio, @fechaFin, @resultado, @instructor, @horas)`
        );
      generados.push({ folio, alumno: f.alumno, resultado: f.resultado });
    }

    // token del grupo: se crea una sola vez, se reusa siempre
    const grupoRow = await pool.request().input("grupoId", sql.Int, grupoId).query("SELECT diploma_token FROM Grupo WHERE id = @grupoId");
    let token = grupoRow.recordset[0] && grupoRow.recordset[0].diploma_token;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "");
      await pool.request().input("grupoId", sql.Int, grupoId).input("token", sql.NVarChar, token).query("UPDATE Grupo SET diploma_token = @token WHERE id = @grupoId");
    }

    // snapshot completo de todos los diplomas vigentes/anulados del grupo, para el link público
    const todos = await pool
      .request()
      .input("grupoId", sql.Int, grupoId)
      .query(
        `SELECT d.folio, a.nombre_completo AS nombre, a.correo, d.resultado, d.estatus, d.motivo_anulacion, d.fecha_generacion
         FROM Diploma d JOIN Alumno a ON a.id = d.alumno_id
         WHERE d.grupo_id = @grupoId ORDER BY a.nombre_completo`
      );

    const snapshot = {
      grupoId,
      actualizadoEn: new Date().toISOString(),
      cliente: g.cliente_final || g.cliente,
      clienteVia: g.cliente_final ? g.cliente : null,
      curso: g.nombre_curso || "",
      herramientas: g.herramientas,
      nivel,
      instructor: g.instructor || "",
      modalidad: g.modalidad || "",
      fechaInicio: g.fecha_inicio,
      fechaFin: g.fecha_fin,
      horas: g.horas,
      alumnos: todos.recordset,
    };
    await guardarDiplomasGrupo(getDiplomasGrupoTable(), { token, snapshot });

    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: { token, generados: generados.length, yaExistian: elegibles.length - pendientes.length, detalle: generados },
    };
  } catch (err) {
    context.log.error("Error generando diplomas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron generar los diplomas: " + err.message } };
  }
};
