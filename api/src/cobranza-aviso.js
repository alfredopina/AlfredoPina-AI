// Aviso por correo "nueva cuenta por cobrar" (para quien factura). Se llama DESPUÉS de confirmar la transacción que creó la cuenta, solo cuando la
// cuenta nació de verdad (no al marcar Ganada otra vez ni al ligar una existente), y NUNCA lanza: un correo que falla jamás debe deshacer ni
// frenar el guardado de la cotización o del grupo. Los destinatarios y el interruptor se manejan en Configuración → Notificaciones.
const { getPool, sql } = require("./backoffice-db");
const { notificarCuentaCobranza } = require("./notificaciones-correo");

async function avisarCuentaNueva(cuentaId) {
  try {
    if (!cuentaId) return { enviado: false, motivo: "sin cuenta" };
    const pool = await getPool();
    const r = await pool.request().input("id", sql.Int, cuentaId).query(`
      SELECT x.concepto, x.total, COALESCE(c.nombre, x.razon_social) AS cliente, q.folio AS cotizacion_folio, g.grupo_codigo, g.nombre_curso
      FROM CuentaPorCobrar x
      LEFT JOIN Cliente c ON c.id = x.cliente_id
      LEFT JOIN Cotizacion q ON q.id = x.cotizacion_id
      LEFT JOIN Grupo g ON g.id = x.grupo_id
      WHERE x.id = @id`);
    if (!r.recordset.length) return { enviado: false, motivo: "no existe" };
    const x = r.recordset[0];
    const origen = x.cotizacion_folio ? "Cotización " + x.cotizacion_folio + " ganada" : x.grupo_codigo || x.nombre_curso ? "Grupo " + (x.grupo_codigo || x.nombre_curso) : "Alta manual";
    return await notificarCuentaCobranza({ cliente: x.cliente, concepto: x.concepto, total: Number(x.total), origen });
  } catch (err) {
    console.warn("No se pudo avisar de la cuenta nueva:", err.message);
    return { enviado: false, motivo: err.message };
  }
}

module.exports = { avisarCuentaNueva };
