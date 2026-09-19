// generarLinkEncuesta/index.js
// Function protegida (rol "admin"): genera (o refresca) el link de encuesta de
// un Grupo activo. Lee el Grupo de SQL (esta es la ÚNICA lectura de SQL de
// todo el flujo de links — la página pública solo lee el snapshot que se
// guarda aquí en Table Storage) y guarda un snapshot con cliente, curso,
// instructor, herramientas, horas, modalidad y fechas.
//
// Reglas (confirmadas por Alfredo):
// - Solo grupos NO cerrados (cualquier fase, "activo" = estatus_cierre distinto
//   de 'Cerrado', mismo criterio que listGruposAdmin?vista=activos).
// - Sin instructor o nombre de curso no se genera: enviarRespuesta los exige
//   (instructor/curso son NOT NULL en EncuestaRespuesta) y el reporte agrupa
//   por instructor — mejor pedir que se completen en Grupos que encuestar a
//   ciegas. Modalidad y horas faltantes sí se toleran ("—").
// - Cliente de la respuesta = cliente FINAL si el grupo lo tiene (revendedor/
//   intermediario), si no el contratante — quienes contestan trabajan en el
//   cliente final.
// - Un solo token por grupo, siempre el mismo (el QR impreso no caduca);
//   volver a generar solo refresca el snapshot.
const { getPool, sql } = require("../src/backoffice-db");
const { getEncuestaLinksTable, guardarLinkDeGrupo } = require("../src/encuesta-links");
const { JSON_HEADERS } = require("../src/http");

function isoFecha(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

module.exports = async function (context, req) {
  const grupoId = Number((req.body || {}).grupoId);
  if (!Number.isInteger(grupoId) || grupoId <= 0) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el grupo." } };
    return;
  }

  try {
    const pool = await getPool();
    const r = await pool.request().input("id", sql.Int, grupoId).query(`
      SELECT g.id, g.cliente_id, g.cliente_final_id, c.nombre AS cliente, cf.nombre AS cliente_final,
             g.nombre_curso, g.instructor, g.herramientas, g.horas, g.modalidad,
             g.fecha_inicio, g.fecha_fin, g.estatus_cierre
      FROM Grupo g
      JOIN Cliente c ON c.id = g.cliente_id
      LEFT JOIN Cliente cf ON cf.id = g.cliente_final_id
      WHERE g.id = @id
    `);
    const g = r.recordset[0];
    if (!g) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese grupo ya no existe." } };
      return;
    }
    if (g.estatus_cierre === "Cerrado") {
      context.res = { status: 409, headers: JSON_HEADERS, body: { error: "Ese grupo ya está cerrado — solo se generan links de grupos activos." } };
      return;
    }
    const faltan = [];
    if (!(g.nombre_curso || "").trim()) faltan.push("nombre del curso");
    if (!(g.instructor || "").trim()) faltan.push("instructor");
    if (faltan.length) {
      context.res = { status: 409, headers: JSON_HEADERS, body: { error: `A este grupo le falta ${faltan.join(" y ")} — complétalo en Grupos y vuelve a intentar.` } };
      return;
    }

    const clienteId = g.cliente_final_id || g.cliente_id;
    const clienteNombre = g.cliente_final_id ? g.cliente_final : g.cliente;

    const link = await guardarLinkDeGrupo(getEncuestaLinksTable(), {
      grupoId: g.id,
      clienteId,
      clienteNombre,
      curso: g.nombre_curso.trim(),
      instructor: g.instructor.trim(),
      herramientas: g.herramientas,
      horas: g.horas,
      modalidad: g.modalidad,
      fechaInicio: isoFecha(g.fecha_inicio),
      fechaFin: isoFecha(g.fecha_fin),
    });
    context.res = { status: 200, headers: JSON_HEADERS, body: link };
  } catch (err) {
    context.log.error("Error generando el link de encuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo generar el link: " + err.message } };
  }
};
