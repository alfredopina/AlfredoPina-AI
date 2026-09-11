// enviarDiagnostico/index.js
// Function pública: recibe un envío completo de diagnostico.html (nombre +
// empresa + herramienta + respuestas) y lo inserta en una transacción.
// Resuelve/da de alta el Cliente igual que enviarRespuesta (Encuestas) —
// duplicado a propósito, mismo criterio de encapsular por módulo que ya usa
// el proyecto.
//
// fue_correcta se calcula AQUÍ, comparando contra opcion_correcta de
// DiagnosticoPregunta en este momento — es una foto: si la pregunta se edita
// después, esta respuesta ya guardada no se recalcula (mismo espíritu que el
// resto del historial del proyecto). nivel también se guarda en el detalle
// (no solo en la pregunta) para poder tallar por banda aunque la pregunta se
// borre después.
//
// Sin protección anti-duplicados/anti-spam — igual que Encuestas: se
// comparte en vivo por QR durante la sesión, no es un link difundido.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

const HERRAMIENTAS = ["excel", "powerbi"];
const OPCIONES = ["A", "B", "C", "D"];

function limpiarCodigo(codigo) {
  return (codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function errorSeguro(mensaje) {
  const err = new Error(mensaje);
  err.safe = true;
  return err;
}

async function resolverCliente(pool, empresa) {
  const clienteId = empresa.clienteId ? Number(empresa.clienteId) : null;

  if (clienteId) {
    const r = await pool.request().input("id", sql.Int, clienteId).query("SELECT id, nombre, codigo FROM Cliente WHERE id = @id");
    if (!r.recordset.length) throw errorSeguro("El cliente seleccionado ya no existe.");
    return r.recordset[0];
  }

  const nombre = (empresa.nombre || "").trim();
  const codigo = limpiarCodigo(empresa.codigo);
  if (!nombre || !codigo) throw errorSeguro("Falta el nombre o el código de la empresa nueva.");

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
  const nombre = (body.nombre || "").trim();
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const empresa = body.empresa || {};
  const respuestas = Array.isArray(body.respuestas) ? body.respuestas : [];

  if (!nombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta tu nombre." } };
    return;
  }
  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
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
    context.res = {
      status: 400,
      headers: JSON_HEADERS,
      body: { error: err.safe ? err.message : "No se pudo procesar la empresa. Intenta de nuevo." },
    };
    return;
  }

  // preguntas reales de esta herramienta, para calcular fue_correcta y nivel
  // en este momento — nunca se confía en lo que mande el cliente para esto.
  let preguntasPorId;
  try {
    const result = await pool
      .request()
      .input("herramienta", sql.VarChar, herramienta)
      .query("SELECT id, nivel, opcion_correcta FROM DiagnosticoPregunta WHERE herramienta = @herramienta");
    preguntasPorId = new Map(result.recordset.map((p) => [p.id, p]));
  } catch (err) {
    context.log.error("Error leyendo el banco de preguntas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo procesar tu envío en este momento." } };
    return;
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const insertRespuesta = await new sql.Request(transaction)
      .input("nombre", sql.NVarChar, nombre)
      .input("clienteId", sql.Int, cliente.id)
      .input("herramienta", sql.VarChar, herramienta)
      .query(
        `INSERT INTO DiagnosticoRespuesta (nombre, cliente_id, herramienta)
         OUTPUT INSERTED.id
         VALUES (@nombre, @clienteId, @herramienta)`
      );
    const respuestaId = insertRespuesta.recordset[0].id;

    for (const r of respuestas) {
      const preguntaId = Number(r.preguntaId);
      const opcionSeleccionada = (r.opcionSeleccionada || "").trim().toUpperCase();
      if (!preguntaId || !OPCIONES.includes(opcionSeleccionada)) continue;
      const pregunta = preguntasPorId.get(preguntaId);
      if (!pregunta) continue; // pregunta borrada entre que se cargó el form y se envió — se omite, no truena el envío

      const fueCorrecta = opcionSeleccionada === pregunta.opcion_correcta;
      await new sql.Request(transaction)
        .input("respuestaId", sql.Int, respuestaId)
        .input("preguntaId", sql.Int, preguntaId)
        .input("nivel", sql.TinyInt, pregunta.nivel)
        .input("opcionSeleccionada", sql.Char, opcionSeleccionada)
        .input("fueCorrecta", sql.Bit, fueCorrecta ? 1 : 0)
        .query(
          `INSERT INTO DiagnosticoRespuestaDetalle (respuesta_id, pregunta_id, nivel, opcion_seleccionada, fue_correcta)
           VALUES (@respuestaId, @preguntaId, @nivel, @opcionSeleccionada, @fueCorrecta)`
        );
    }

    await transaction.commit();
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      context.log.error("Error haciendo rollback:", rollbackErr.message);
    }
    context.log.error("Error guardando el diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar tu diagnóstico en este momento." } };
  }
};
