// alternativasCotizacion/index.js
// Function protegida (rol "admin", cerrada por defecto): vincula / desvincula cotizaciones como ALTERNATIVAS de una misma oportunidad.
//   { accion: "vincular", id, otro_id } → las dos quedan en el mismo grupo (si una ya tenía grupo, la otra entra a él; si ambas
//     tenían uno distinto, se funden). Deben ser del mismo cliente (y mismo cliente final) y estar abiertas.
//   { accion: "desvincular", id } → la saca del grupo; si el grupo queda con una sola, esa también se libera.
// Ver api/src/cotizacion-alternativas.js para las reglas de ganar / descartar / pipeline.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { ABIERTAS } = require("../src/cotizacion-alternativas");

const falla = (status, msg) => Object.assign(new Error(msg), { status });

module.exports = async function (context, req) {
  const body = req.body || {};
  const accion = String(body.accion || "");
  const id = Number(body.id);
  const otroId = Number(body.otro_id);
  if (!id || !["vincular", "desvincular"].includes(accion) || (accion === "vincular" && (!otroId || otroId === id))) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos o no son válidos." } };
    return;
  }
  let transaction;
  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const nueva = () => new sql.Request(transaction);
    const leer = async (cid) => {
      const r = await nueva().input("id", sql.Int, cid).query("SELECT id, cliente_id, cliente_final_id, estatus, alternativa_grupo FROM Cotizacion WHERE id = @id");
      return r.recordset[0] || null;
    };
    const a = await leer(id);
    if (!a) throw falla(404, "Esa cotización ya no existe.");

    if (accion === "desvincular") {
      if (a.alternativa_grupo == null) throw falla(400, "Esa cotización no tiene alternativas.");
      const g = a.alternativa_grupo;
      await nueva().input("id", sql.Int, id).query("UPDATE Cotizacion SET alternativa_grupo = NULL WHERE id = @id");
      // un grupo de una sola no es un grupo: se libera la que queda
      await nueva().input("g", sql.Int, g).query(
        "UPDATE Cotizacion SET alternativa_grupo = NULL WHERE alternativa_grupo = @g AND (SELECT COUNT(*) FROM Cotizacion WHERE alternativa_grupo = @g) = 1"
      );
    } else {
      const b = await leer(otroId);
      if (!b) throw falla(404, "La otra cotización ya no existe.");
      if (a.cliente_id !== b.cliente_id || (a.cliente_final_id || null) !== (b.cliente_final_id || null)) throw falla(400, "Las alternativas deben ser del mismo cliente.");
      if (!ABIERTAS.includes(a.estatus) || !ABIERTAS.includes(b.estatus)) throw falla(400, "Solo se vinculan cotizaciones abiertas (Borrador, Enviada o En negociación).");
      const grupo = a.alternativa_grupo != null ? a.alternativa_grupo : b.alternativa_grupo != null ? b.alternativa_grupo : Math.min(a.id, b.id);
      if (b.alternativa_grupo != null && b.alternativa_grupo !== grupo) {
        await nueva().input("viejo", sql.Int, b.alternativa_grupo).input("g", sql.Int, grupo).query("UPDATE Cotizacion SET alternativa_grupo = @g WHERE alternativa_grupo = @viejo");
      }
      await nueva().input("a", sql.Int, a.id).input("b", sql.Int, b.id).input("g", sql.Int, grupo).query("UPDATE Cotizacion SET alternativa_grupo = @g WHERE id IN (@a, @b)");
    }
    await transaction.commit();
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    try { if (transaction) await transaction.rollback(); } catch (_) { /* ya cerrada */ }
    if (err.status) { context.res = { status: err.status, headers: JSON_HEADERS, body: { error: err.message } }; return; }
    context.log.error("Error con las alternativas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo actualizar las alternativas." } };
  }
};
