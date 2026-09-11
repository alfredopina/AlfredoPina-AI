// listRespuestasDiagnosticoAdmin/index.js
// Function protegida (rol "admin"): envíos del Diagnóstico con filtros, para
// la pestaña "Resultados". Cada envío regresa con tallies por nivel (aciertos
// sobre el total de preguntas de esa banda que en verdad se contestaron — no
// se hardcodea "5", así sigue siendo correcto aunque el banco de preguntas
// cambie de tamaño con el tiempo) + el detalle de las 15 respuestas ya
// resuelto (LEFT JOIN contra DiagnosticoPregunta — una pregunta borrada no
// tumba la consulta, mismo patrón que listRespuestasEncuesta).
//
// Solo se guarda/muestra el dato crudo (aciertos por banda + detalle) — el
// nivel final interpretativo es una síntesis que arma Alfredo por fuera, no
// se calcula aquí (ver CLAUDE.md).
const { getPool, sql } = require("../src/backoffice-db");
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
             d.pregunta_id, d.nivel, d.opcion_seleccionada, d.fue_correcta,
             ISNULL(p.texto, '(pregunta eliminada)') AS pregunta_texto, p.imagen_url,
             p.opcion_a, p.opcion_b, p.opcion_c, p.opcion_d, p.opcion_correcta
      FROM DiagnosticoRespuesta r
      JOIN Cliente c ON c.id = r.cliente_id
      JOIN DiagnosticoRespuestaDetalle d ON d.respuesta_id = r.id
      LEFT JOIN DiagnosticoPregunta p ON p.id = d.pregunta_id
      ${where}
      ORDER BY r.fecha_envio DESC, r.id, d.id
    `);

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
      r.detalle.push({
        pregunta_id: row.pregunta_id,
        nivel: row.nivel,
        texto: row.pregunta_texto,
        imagen_url: row.imagen_url,
        opcion_a: row.opcion_a,
        opcion_b: row.opcion_b,
        opcion_c: row.opcion_c,
        opcion_d: row.opcion_d,
        opcion_correcta: row.opcion_correcta,
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
