// listRespuestasDiagnosticoAdmin/index.js
// Function protegida (rol "admin"): envíos del Diagnóstico con filtros, para
// la pestaña "Resultados". Cada envío regresa con tallies por nivel (aciertos
// sobre el total de preguntas de esa banda que en verdad se contestaron — no
// se hardcodea "5", así sigue siendo correcto aunque el banco de preguntas
// cambie de tamaño con el tiempo) + el detalle de las 15 respuestas ya
// resuelto contra el banco de preguntas — una pregunta borrada no tumba la
// consulta, mismo espíritu que listRespuestasEncuesta (ahí sí es un LEFT
// JOIN de SQL porque su banco sigue en SQL; aquí es una resolución en
// memoria, ver más abajo).
//
// Solo se guarda/muestra el dato crudo (aciertos por banda + detalle) — el
// nivel final interpretativo es una síntesis que arma Alfredo por fuera, no
// se calcula aquí (ver CLAUDE.md).
//
// El texto/imagen/opciones de cada pregunta ya no salen de un JOIN a SQL
// (2026-09-13, el banco vive en Table Storage) — se resuelven aparte, una
// consulta por herramienta presente en el resultado, y se pegan en memoria.
const { getPool, sql } = require("../src/backoffice-db");
const { getDiagnosticoPreguntasTable, listarPreguntas } = require("../src/diagnostico-tables");
const { JSON_HEADERS } = require("../src/http");

const NIVEL_NOMBRE = { 1: "basico", 2: "intermedio", 3: "avanzado" };

module.exports = async function (context, req) {
  const { herramienta, clienteId, desde, hasta } = req.query;

  try {
    const pool = await getPool();
    const request = pool.request();
    const condiciones = [];

    if (herramienta) {
      condiciones.push("r.herramienta = @herramienta");
      request.input("herramienta", sql.VarChar, herramienta);
    }
    if (clienteId) {
      condiciones.push("r.cliente_id = @clienteId");
      request.input("clienteId", sql.Int, Number(clienteId));
    }
    if (desde) {
      condiciones.push("CAST(r.fecha_envio AS DATE) >= @desde");
      request.input("desde", sql.Date, new Date(desde));
    }
    if (hasta) {
      condiciones.push("CAST(r.fecha_envio AS DATE) <= @hasta");
      request.input("hasta", sql.Date, new Date(hasta));
    }

    const where = condiciones.length ? "WHERE " + condiciones.join(" AND ") : "";
    const result = await request.query(`
      SELECT r.id AS respuesta_id, r.nombre, r.cliente_id, c.nombre AS cliente, r.herramienta, r.fecha_envio,
             d.pregunta_id, d.nivel, d.opcion_seleccionada, d.fue_correcta
      FROM DiagnosticoRespuesta r
      JOIN Cliente c ON c.id = r.cliente_id
      JOIN DiagnosticoRespuestaDetalle d ON d.respuesta_id = r.id
      ${where}
      ORDER BY r.fecha_envio DESC, r.id, d.id
    `);

    // banco de preguntas por herramienta, solo para las herramientas que
    // realmente aparecen en este resultado — como máximo 2 consultas (excel,
    // powerbi), nunca una por fila.
    const herramientasUsadas = [...new Set(result.recordset.map((row) => row.herramienta))];
    const table = getDiagnosticoPreguntasTable();
    const preguntasPorHerramienta = {};
    for (const h of herramientasUsadas) {
      const entidades = await listarPreguntas(table, h);
      preguntasPorHerramienta[h] = new Map(entidades.map((e) => [e.rowKey, e]));
    }

    const porId = new Map();
    for (const row of result.recordset) {
      if (!porId.has(row.respuesta_id)) {
        porId.set(row.respuesta_id, {
          id: row.respuesta_id,
          nombre: row.nombre,
          cliente_id: row.cliente_id,
          cliente: row.cliente,
          herramienta: row.herramienta,
          fecha_envio: row.fecha_envio,
          detalle: [],
          tallies: { basico: { aciertos: 0, total: 0 }, intermedio: { aciertos: 0, total: 0 }, avanzado: { aciertos: 0, total: 0 } },
        });
      }
      const r = porId.get(row.respuesta_id);
      const pregunta = (preguntasPorHerramienta[row.herramienta] || new Map()).get(row.pregunta_id);
      r.detalle.push({
        pregunta_id: row.pregunta_id,
        nivel: row.nivel,
        texto: pregunta ? pregunta.texto : "(pregunta eliminada)",
        imagen_url: pregunta ? pregunta.imagen_url : null,
        opcion_a: pregunta ? pregunta.opcion_a : null,
        opcion_b: pregunta ? pregunta.opcion_b : null,
        opcion_c: pregunta ? pregunta.opcion_c : null,
        opcion_d: pregunta ? pregunta.opcion_d : null,
        opcion_correcta: pregunta ? pregunta.opcion_correcta : null,
        opcion_seleccionada: row.opcion_seleccionada,
        fue_correcta: row.fue_correcta,
      });
      const banda = NIVEL_NOMBRE[row.nivel];
      if (banda) {
        r.tallies[banda].total++;
        if (row.fue_correcta) r.tallies[banda].aciertos++;
      }
    }

    const lista = Array.from(porId.values()).map((r) => {
      const totalAciertos = r.tallies.basico.aciertos + r.tallies.intermedio.aciertos + r.tallies.avanzado.aciertos;
      const totalPreguntas = r.tallies.basico.total + r.tallies.intermedio.total + r.tallies.avanzado.total;
      return { ...r, total: { aciertos: totalAciertos, total: totalPreguntas } };
    });

    context.res = { status: 200, headers: JSON_HEADERS, body: lista };
  } catch (err) {
    context.log.error("Error listando respuestas del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron listar las respuestas: " + err.message } };
  }
};
