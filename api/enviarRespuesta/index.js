// enviarRespuesta/index.js
// Function pública: recibe un envío completo de encuesta.html (cabecera +
// respuestas) y lo inserta en una transacción.
//
// Dos modos (Fase 1 de Encuestas, 2026-09-19):
// - CON token (link por grupo): el cliente/curso/instructor/herramientas/
//   horas/modalidad salen del snapshot guardado en Table Storage al generar
//   el link — el navegador NO manda ni puede alterar esos datos — y se guarda
//   grupo_id. Si el link está cerrado se rechaza aquí (no solo en la pantalla).
// - SIN token (link genérico): igual que antes — empresa (autocomplete o
//   nueva), curso e instructor los teclea la persona, sin grupo_id.
//
// Las respuestas se validan contra el banco REAL de Table Storage (ver
// encuesta-logic.js/validarRespuestas): todas las de escala con un entero 1-5,
// ningún id que no exista, y el texto/categoría/tipo que se guarda como copia
// congelada en cada renglón sale del banco, nunca del navegador.
//
// Después del commit se suma 1 en los contadores de Table Storage (mejor
// esfuerzo — si eso falla, la respuesta YA quedó guardada y no se le avisa un
// error a quien contestó).
//
// Sin protección anti-spam/anti-duplicados en el servidor — sigue siendo
// intencional (link controlado por QR en vivo); el aviso suave de "ya
// contestaste" vive en el navegador (localStorage), no bloquea.
const { getPool, sql } = require("../src/backoffice-db");
const { getEncuestaPreguntasTable, listarTodas, bancoVigente } = require("../src/encuesta-tables");
const { getEncuestaLinksTable, leerLink, ajustarContadores } = require("../src/encuesta-links");
const { validarRespuestas, errorSeguro, fechaMexico, CORREO_RE } = require("../src/encuesta-logic");
const { JSON_HEADERS } = require("../src/http");

function limpiarCodigo(codigo) {
  return (codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
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
  const token = (body.token || "").trim();
  const nombre = (body.nombre || "").trim().slice(0, 200) || null;
  const correo = (body.correo || "").trim().slice(0, 200) || null;

  try {
    if (correo && !CORREO_RE.test(correo)) throw errorSeguro("El correo no se ve válido — revísalo o déjalo en blanco.");

    // 1. Datos del grupo (token) o del formulario (genérico)
    let link = null;
    let curso, instructor;
    if (token) {
      link = await leerLink(getEncuestaLinksTable(), token);
      if (!link) throw errorSeguro("Este link no es válido — pide de nuevo el link o el QR a tu instructor.", 404);
      if (!link.abierta) throw errorSeguro("Esta encuesta ya cerró — gracias por tu interés.", 403);
      curso = link.curso;
      instructor = link.instructor;
    } else {
      curso = (body.curso || "").trim();
      instructor = (body.instructor || "").trim();
      if (!curso || !instructor) throw errorSeguro("Faltan datos (curso o instructor).");
    }

    // 2. Respuestas contra el banco real
    const banco = bancoVigente(await listarTodas(getEncuestaPreguntasTable()));
    const detalle = validarRespuestas(banco, body.respuestas);

    // 3. SQL
    const pool = await getPool();
    const clienteId = link ? Number(link.clienteId) : (await resolverCliente(pool, body.empresa || {})).id;

    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      const insertRespuesta = await new sql.Request(transaction)
        .input("nombre", sql.NVarChar, nombre)
        .input("clienteId", sql.Int, clienteId)
        .input("curso", sql.NVarChar, curso.slice(0, 200))
        .input("instructor", sql.NVarChar, instructor.slice(0, 120))
        .input("fecha", sql.Date, new Date(fechaMexico(new Date())))
        .input("grupoId", sql.Int, link ? Number(link.grupoId) : null)
        .input("correo", sql.NVarChar, correo)
        .input("herramientas", sql.NVarChar, link ? link.herramientas : null)
        .input("modalidad", sql.NVarChar, link ? link.modalidad : null)
        .input("horas", sql.Decimal(6, 1), link ? link.horas : null)
        .input("linkGeneradoEn", sql.DateTime2, link ? new Date(link.generadoEn) : null)
        .query(
          `INSERT INTO EncuestaRespuesta (nombre, cliente_id, curso, instructor, fecha, grupo_id, correo, herramientas, modalidad, horas, link_generado_en)
           OUTPUT INSERTED.id
           VALUES (@nombre, @clienteId, @curso, @instructor, @fecha, @grupoId, @correo, @herramientas, @modalidad, @horas, @linkGeneradoEn)`
        );
      const respuestaId = insertRespuesta.recordset[0].id;

      for (const d of detalle) {
        await new sql.Request(transaction)
          .input("respuestaId", sql.Int, respuestaId)
          .input("preguntaId", sql.NVarChar, d.preguntaId)
          .input("valor", sql.NVarChar, d.valor)
          .input("texto", sql.NVarChar, d.texto.slice(0, 500))
          .input("categoria", sql.NVarChar, d.categoria)
          .input("tipo", sql.NVarChar, d.tipo)
          .query(
            `INSERT INTO EncuestaRespuestaDetalle (respuesta_id, pregunta_id, valor, pregunta_texto, categoria, tipo)
             VALUES (@respuestaId, @preguntaId, @valor, @texto, @categoria, @tipo)`
          );
      }

      await transaction.commit();
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        context.log.error("Error haciendo rollback:", rollbackErr.message);
      }
      throw err;
    }

    try {
      await ajustarContadores(getEncuestaLinksTable(), { token: link ? token : null, delta: 1 });
    } catch (err) {
      context.log.warn("La respuesta se guardó pero no se pudo sumar al contador en vivo:", err.message);
    }

    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    if (err.safe) {
      context.res = { status: err.status || 400, headers: JSON_HEADERS, body: { error: err.message } };
      return;
    }
    context.log.error("Error guardando la respuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar tu respuesta en este momento." } };
  }
};
