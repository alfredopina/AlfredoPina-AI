// enviarRespuesta/index.js
// Function pública: recibe un envío completo de encuesta.html (cabecera +
// respuestas) y lo inserta en una transacción. Da de alta el Cliente si no
// existe — misma idea que resolverCliente en generarDiplomas/index.js, pero
// duplicada aquí a propósito (mismo criterio de encapsular por módulo que ya
// usa el proyecto entre Cursos/Recursos, ver CLAUDE.md) en vez de acoplar
// Diplomas y Encuestas por un helper compartido.
//
// Sin protección anti-duplicados/anti-spam — es intencional: el link se
// comparte de forma controlada (QR en vivo durante la sesión de cierre), no
// es un link público difundido.
const { getPool, sql } = require("../src/backoffice-db");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function limpiarCodigo(codigo) {
  return (codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function resolverCliente(pool, empresa) {
  const clienteId = empresa.clienteId ? Number(empresa.clienteId) : null;

  if (clienteId) {
    const r = await pool.request().input("id", sql.Int, clienteId).query("SELECT id, nombre, codigo FROM Cliente WHERE id = @id");
    if (!r.recordset.length) throw new Error("El cliente seleccionado ya no existe.");
    return r.recordset[0];
  }

  const nombre = (empresa.nombre || "").trim();
  const codigo = limpiarCodigo(empresa.codigo);
  if (!nombre || !codigo) throw new Error("Falta el nombre o el código de la empresa nueva.");

  const existente = await pool.request().input("codigo", sql.NVarChar, codigo).query("SELECT id, nombre, codigo FROM Cliente WHERE codigo = @codigo");
  if (existente.recordset.length) return existente.recordset[0];

  const insert = await pool
    .request()
    .input("nombre", sql.NVarChar, nombre)
    .input("codigo", sql.NVarChar, codigo)
    .query("INSERT INTO Cliente (nombre, codigo) OUTPUT INSERTED.id, INSERTED.nombre, INSERTED.codigo VALUES (@nombre, @codigo)");
  return insert.recordset[0];
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const nombre = (body.nombre || "").trim() || null;
  const curso = (body.curso || "").trim();
  const instructor = (body.instructor || "").trim();
  const fecha = (body.fecha || "").trim();
  const empresa = body.empresa || {};
  const respuestas = Array.isArray(body.respuestas) ? body.respuestas : [];

  if (!curso || !instructor || !fecha) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (curso, instructor o fecha)." } };
    return;
  }
  if (!respuestas.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No hay respuestas que guardar." } };
    return;
  }

  let pool, cliente;
  try {
    pool = await getPool();
    cliente = await resolverCliente(pool, empresa);
  } catch (err) {
    context.log.error("Error resolviendo el cliente:", err.message);
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: err.message } };
    return;
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const insertRespuesta = await new sql.Request(transaction)
      .input("nombre", sql.NVarChar, nombre)
      .input("clienteId", sql.Int, cliente.id)
      .input("curso", sql.NVarChar, curso)
      .input("instructor", sql.NVarChar, instructor)
      .input("fecha", sql.Date, new Date(fecha))
      .query(
        `INSERT INTO EncuestaRespuesta (nombre, cliente_id, curso, instructor, fecha)
         OUTPUT INSERTED.id
         VALUES (@nombre, @clienteId, @curso, @instructor, @fecha)`
      );
    const respuestaId = insertRespuesta.recordset[0].id;

    for (const r of respuestas) {
      const preguntaId = Number(r.preguntaId);
      const valor = (r.valor || "").toString().trim();
      if (!preguntaId || !valor) continue;
      await new sql.Request(transaction)
        .input("respuestaId", sql.Int, respuestaId)
        .input("preguntaId", sql.Int, preguntaId)
        .input("valor", sql.NVarChar, valor)
        .query("INSERT INTO EncuestaRespuestaDetalle (respuesta_id, pregunta_id, valor) VALUES (@respuestaId, @preguntaId, @valor)");
    }

    await transaction.commit();
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      context.log.error("Error haciendo rollback:", rollbackErr.message);
    }
    context.log.error("Error guardando la respuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar tu respuesta: " + err.message } };
  }
};
