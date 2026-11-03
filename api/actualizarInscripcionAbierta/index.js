// actualizarInscripcionAbierta/index.js
// Function protegida (rol "admin"): acciones sobre UNA inscripción de un grupo abierto.
//   · confirmar → apartada pasa a confirmada y pagada (para un pago que se recibió fuera de Cobranza; el pago normal lo registra Cobranza, que confirma solo).
//   · cancelar  → la inscripción queda cancelada y el lugar se DEVUELVE al contador del sitio (liberar un apartado vencido o dar de baja a alguien).
// Nunca borra nada. Si la persona ya había pagado, el pago queda como estaba: el reembolso se resuelve en Cobranza.
const { getPool, sql } = require("../src/backoffice-db");
const cal = require("../src/calendario-abiertos");
const { JSON_HEADERS } = require("../src/http");

const res = (context, status, body) => { context.res = { status, headers: JSON_HEADERS, body }; };

module.exports = async function (context, req) {
  const b = req.body || {};
  const id = Number(b.id), accion = String(b.accion || "");
  if (!Number.isInteger(id) || id < 1) return res(context, 400, { error: "Falta la inscripción." });
  if (!["confirmar", "cancelar"].includes(accion)) return res(context, 400, { error: "Acción inválida." });
  try {
    const pool = await getPool();
    const r = await pool.request().input("id", sql.Int, id).query("SELECT i.estado, g.grupo_codigo FROM Inscripcion i JOIN Grupo g ON g.id = i.grupo_id WHERE i.id = @id");
    if (!r.recordset.length) return res(context, 404, { error: "Esa inscripción ya no existe." });
    const { estado, grupo_codigo: codigo } = r.recordset[0];
    if (estado === "cancelada") return res(context, 409, { error: "Esa inscripción ya está cancelada." });
    if (accion === "confirmar") {
      if (estado !== "apartada") return res(context, 409, { error: "Solo se confirma una inscripción apartada." });
      await pool.request().input("id", sql.Int, id).query("UPDATE Inscripcion SET estado = 'confirmada', estado_pago = 'pagado', fecha_estado = SYSUTCDATETIME() WHERE id = @id");
      return res(context, 200, { ok: true, estado: "confirmada" });
    }
    await pool.request().input("id", sql.Int, id).query("UPDATE Inscripcion SET estado = 'cancelada', fecha_estado = SYSUTCDATETIME() WHERE id = @id");
    let liberado = true;
    try { await cal.liberarLugares(cal.getTable(), codigo, 1); } catch (err) { liberado = false; context.log.error("No se pudo devolver el lugar al contador:", err.message); }
    return res(context, 200, { ok: true, estado: "cancelada", lugar_devuelto: liberado });
  } catch (err) {
    context.log.error("Error actualizando la inscripción:", err.message);
    return res(context, 500, { error: "No se pudo actualizar la inscripción." });
  }
};
