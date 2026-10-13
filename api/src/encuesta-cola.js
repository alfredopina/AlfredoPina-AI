// api/src/encuesta-cola.js
// Cola de envíos de la Encuesta (encuesta.html → enviarRespuesta), mismo esquema que el Diagnóstico (diagnostico-cola.js,
// ambos sobre cola-tabla.js): la persona SOLO escribe en Table Storage y el envío pasa a SQL cuando Alfredo abre el panel
// Encuestas o pulsa "Importar ahora". Así contestar la encuesta no despierta ni mantiene despierta la base.
//
// Diferencias con el Diagnóstico (a propósito):
//   · NO hay regla de "una persona no contesta dos veces": la encuesta es anónima (nombre opcional); el aviso suave de "ya
//     contestaste" vive en el navegador (localStorage). El reintento del navegador sí es idempotente (envioId = RowKey).
//   · Con link por grupo, los datos del grupo (cliente, grupo, herramientas, horas…) se copian al encolar desde el snapshot
//     del link: si después se cierra o cambia el link, lo contestado queda como estaba. Con link genérico la empresa
//     (clienteId elegido de la lista) se valida al IMPORTAR (solo clientes existentes que no sean Prospecto).
//   · La fecha de la respuesta (día en hora de México) se fija al ENCOLAR, no al importar.
//   · Los contadores en vivo (Table Storage) suman al encolar; descartar resta.
const { crearCola } = require("./cola-tabla");
const { errorSeguro } = require("./encuesta-logic");

const cola = crearCola({ tabla: "EncuestaPendientes" });
const getColaTable = cola.getTable;

// datos = { token|null, linkSnap:{grupoId,clienteId,clienteNombre,herramientas,modalidad,horas,generadoEn}|null, empresa:{clienteId,nombre}|null,
//           curso, instructor, nombre, correo, autorizaTestimonio, fecha:'YYYY-MM-DD', detalle:[{preguntaId,valor,texto,categoria,tipo}] }
function encolar(table, envioId, datos, ahora = new Date()) {
  const empresaTxt = datos.linkSnap ? datos.linkSnap.clienteNombre : (datos.empresa && (datos.empresa.nombre || (datos.empresa.clienteId ? "cliente #" + datos.empresa.clienteId : ""))) || "";
  return cola.encolar(table, envioId, {
    token: datos.token || "", nombre: String(datos.nombre || "").slice(0, 120), empresaTxt: String(empresaTxt || "").slice(0, 120),
    curso: String(datos.curso || "").slice(0, 120), fecha: datos.fecha, datos: JSON.stringify(datos),
  }, ahora);
}

// { total, errores, lista:[{id,nombre,empresa,curso,recibidoEn,intentos,error}] } — solo Table Storage (no despierta la base)
function resumenPendientes(table) {
  return cola.resumen(table, {
    select: ["nombre", "empresaTxt", "curso"],
    fila: (e) => ({ id: e.rowKey, nombre: e.nombre || "", empresa: e.empresaTxt, curso: e.curso, recibidoEn: e.recibidoEn, intentos: e.intentos || 0, error: e.ultimoError }),
  });
}

// Pasa UN envío de la cola a SQL en una transacción. Idempotente: el índice único de envio_id (sql/020) hace que, si una corrida
// anterior se cortó entre el COMMIT y el borrado de la fila, la repetición se reconozca como duplicada y no se vuelva a insertar.
async function insertarEnSql(pool, sql, resolverClienteExistente, envioId, datos, recibidoEn) {
  const link = datos.linkSnap;
  const clienteId = link ? Number(link.clienteId) : (await resolverClienteExistente(pool, datos.empresa || {}, errorSeguro)).id;

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const insertRespuesta = await new sql.Request(transaction)
      .input("envioId", sql.NVarChar, envioId)
      .input("autorizaTestimonio", sql.Bit, datos.autorizaTestimonio ? 1 : 0)
      .input("nombre", sql.NVarChar, datos.nombre || null)
      .input("clienteId", sql.Int, clienteId)
      .input("curso", sql.NVarChar, String(datos.curso || "").slice(0, 200))
      .input("instructor", sql.NVarChar, String(datos.instructor || "").slice(0, 120))
      .input("fecha", sql.Date, new Date(datos.fecha))
      .input("grupoId", sql.Int, link ? Number(link.grupoId) : null)
      .input("correo", sql.NVarChar, datos.correo || null)
      .input("herramientas", sql.NVarChar, link ? link.herramientas : null)
      .input("modalidad", sql.NVarChar, link ? link.modalidad : null)
      .input("horas", sql.Decimal(6, 1), link ? link.horas : null)
      .input("linkGeneradoEn", sql.DateTime2, link && link.generadoEn ? new Date(link.generadoEn) : null)
      .query(
        `INSERT INTO EncuestaRespuesta (nombre, cliente_id, curso, instructor, fecha, grupo_id, correo, herramientas, modalidad, horas, link_generado_en, envio_id, autoriza_testimonio)
         OUTPUT INSERTED.id
         VALUES (@nombre, @clienteId, @curso, @instructor, @fecha, @grupoId, @correo, @herramientas, @modalidad, @horas, @linkGeneradoEn, @envioId, @autorizaTestimonio)`
      );
    const respuestaId = insertRespuesta.recordset[0].id;

    for (const d of datos.detalle || []) {
      await new sql.Request(transaction)
        .input("respuestaId", sql.Int, respuestaId)
        .input("preguntaId", sql.NVarChar, d.preguntaId)
        .input("valor", sql.NVarChar, d.valor)
        .input("texto", sql.NVarChar, String(d.texto || "").slice(0, 500))
        .input("categoria", sql.NVarChar, d.categoria)
        .input("tipo", sql.NVarChar, d.tipo)
        .query(
          `INSERT INTO EncuestaRespuestaDetalle (respuesta_id, pregunta_id, valor, pregunta_texto, categoria, tipo)
           VALUES (@respuestaId, @preguntaId, @valor, @texto, @categoria, @tipo)`
        );
    }

    await transaction.commit();
    return { id: respuestaId, duplicada: false };
  } catch (err) {
    try { await transaction.rollback(); } catch (_) { /* ya cerrada */ }
    // 2601/2627 = violación del índice único de envio_id → ese envío ya se había importado
    if (err.number === 2601 || err.number === 2627) return { id: null, duplicada: true };
    throw err;
  }
}

function importarPendientes(table, insertar, context, opciones) {
  return cola.importar(table, insertar, context, opciones);
}

// Atajo para las Functions del admin: importa con la base real. Nunca lanza.
async function importarConSql(pool, context, opciones) {
  const { sql } = require("./backoffice-db");
  const { resolverClienteExistente } = require("./cliente-resolver");
  try {
    return await importarPendientes(getColaTable(), (id, datos, recibidoEn) => insertarEnSql(pool, sql, resolverClienteExistente, id, datos, recibidoEn), context, opciones);
  } catch (err) {
    if (context) context.log.error("Cola de encuestas: no se pudo iniciar la importación:", err.message);
    return { importadas: 0, errores: 0, restantes: 0 };
  }
}

// Descarta un pendiente (borrado real, con confirmación en el front). → { token, fecha } | null si ya no estaba.
async function descartar(table, envioId) {
  const fila = await cola.leer(table, envioId);
  if (!fila) return null;
  await cola.borrar(table, envioId);
  return { token: fila.token || null, fecha: fila.fecha || null };
}

module.exports = { getColaTable, encolar, resumenPendientes, insertarEnSql, importarPendientes, importarConSql, descartar };
