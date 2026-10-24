// actualizarEstatusCotizacion/index.js
// Function protegida (rol "admin"): cambia el estatus de una Cotización. Si
// el nuevo estatus es "Enviada" y todavía no tenía fecha_envio, la pone a
// ahora. Igual con fecha_cierre cuando el nuevo estatus es Ganada/Perdida —
// api/src/cliente-actividad.js (Días Inactivo) depende de que esta fecha sea
// real, no aproximada. Usada también por getResumenCotizacionesAdmin/tiempo
// de cierre de forma indirecta (ver esa Function para ese otro criterio).
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { esMotivoValido } = require("../src/cotizacion-motivos");
const { crearCuentaDeCotizacion } = require("../src/cobranza-db");
const { contarHermanasAbiertas, descartarAlternativasAbiertas } = require("../src/cotizacion-alternativas");

const ESTATUS_VALIDOS = ["Borrador", "Enviada", "En negociación", "Ganada", "Perdida", "Expirada", "Reemplazada", "Descartada"];

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = Number(body.id);
  const estatus = (body.estatus || "").trim();
  // al marcar Perdida, el admin manda el motivo (lista fija) y una nota opcional; en cualquier otro estatus se limpian
  const motivo = estatus === "Perdida" && body.motivo ? String(body.motivo).trim() : null;
  const nota = estatus === "Perdida" && body.nota ? String(body.nota).trim().slice(0, 500) : null;

  if (!id || !ESTATUS_VALIDOS.includes(estatus)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id o el estatus no es válido." } };
    return;
  }

  if (motivo && !esMotivoValido(motivo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El motivo de pérdida no es válido." } };
    return;
  }

  // El UPDATE y el nacimiento de la cuenta por cobrar (si pasa a Ganada) van en una transacción: o quedan ambos o ninguno.
  let transaction;
  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    // alternativas (una misma oportunidad con varias cotizaciones): Descartada solo existe dentro de un grupo, y una cotización
    // con alternativas abiertas se DESCARTA en vez de marcarse Perdida (la oportunidad solo se pierde con la última)
    const actual = await new sql.Request(transaction).input("id", sql.Int, id).query("SELECT alternativa_grupo FROM Cotizacion WHERE id = @id");
    const enGrupo = actual.recordset.length && actual.recordset[0].alternativa_grupo != null;
    const rechaza = async (msg) => {
      await transaction.rollback();
      context.res = { status: 400, headers: JSON_HEADERS, body: { error: msg } };
    };
    if (estatus === "Descartada" && !enGrupo) return rechaza("Solo se descarta una cotización que tiene alternativas; si no, márcala Perdida.");
    if (estatus === "Perdida" && enGrupo && (await contarHermanasAbiertas(() => new sql.Request(transaction), id)) > 0) {
      return rechaza("Esta cotización tiene una alternativa abierta: descártala (no es una pérdida) o cierra primero la otra.");
    }
    const result = await new sql.Request(transaction)
      .input("id", sql.Int, id)
      .input("estatus", sql.NVarChar, estatus)
      .input("motivo", sql.NVarChar, motivo)
      .input("nota", sql.NVarChar, nota)
      .query(
        `UPDATE Cotizacion SET
           fecha_estatus = CASE WHEN estatus <> @estatus THEN SYSUTCDATETIME() ELSE fecha_estatus END,
           estatus = @estatus,
           motivo_perdida = @motivo,
           nota_cierre = @nota,
           fecha_envio = CASE WHEN @estatus = 'Enviada' AND fecha_envio IS NULL THEN SYSUTCDATETIME() ELSE fecha_envio END,
           fecha_cierre = CASE WHEN @estatus IN ('Ganada', 'Perdida') THEN COALESCE(fecha_cierre, CAST(SYSUTCDATETIME() AS DATE)) ELSE NULL END
         WHERE id = @id`
      );
    if (!result.rowsAffected[0]) {
      await transaction.rollback();
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa cotización ya no existe." } };
      return;
    }
    // Ganada → nace su cuenta por cobrar (idempotente: marcarla Ganada otra vez, o regresarla y volver, no duplica)
    const cuenta = estatus === "Ganada" ? await crearCuentaDeCotizacion(() => new sql.Request(transaction), id) : null;
    // ganó una alternativa: las demás abiertas de su grupo quedan Descartadas
    const descartadas = estatus === "Ganada" && enGrupo ? await descartarAlternativasAbiertas(() => new sql.Request(transaction), id) : 0;
    await transaction.commit();
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, cuentaCobranza: cuenta, descartadas } };
  } catch (err) {
    try { if (transaction) await transaction.rollback(); } catch (_) { /* ya cerrada */ }
    context.log.error("Error actualizando el estatus:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo actualizar el estatus." } };
  }
};
