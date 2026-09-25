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
const { resolverClienteExistente } = require("../src/cliente-resolver");
const { getEncuestaPreguntasTable, listarTodas, bancoVigente } = require("../src/encuesta-tables");
const { getEncuestaLinksTable, leerLink, ajustarContadores } = require("../src/encuesta-links");
const { validarRespuestas, errorSeguro, fechaMexico, CORREO_RE } = require("../src/encuesta-logic");
const { JSON_HEADERS } = require("../src/http");


module.exports = async function (context, req) {
  const body = req.body || {};
  const token = (body.token || "").trim();
  const nombre = (body.nombre || "").trim().slice(0, 200) || null;
  const correo = (body.correo || "").trim().slice(0, 200) || null;
  // llave anti-duplicado (sql/020): la genera el navegador UNA vez por clic en
  // "Enviar" y la reusa en cada reintento — si el primer intento sí se guardó
  // pero la confirmación se perdió, el reintento choca contra el índice único
  // y se responde ok sin volver a insertar ni contar.
  const envioId = /^[A-Za-z0-9_-]{8,40}$/.test(String(body.envioId || "")) ? String(body.envioId) : null;

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
    const clienteId = link ? Number(link.clienteId) : (await resolverClienteExistente(pool, body.empresa || {}, errorSeguro)).id;

    const transaction = new sql.Transaction(pool);
    let duplicado = false;
    try {
      await transaction.begin();

      const insertRespuesta = await new sql.Request(transaction)
        .input("envioId", sql.NVarChar, envioId)
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
          `INSERT INTO EncuestaRespuesta (nombre, cliente_id, curso, instructor, fecha, grupo_id, correo, herramientas, modalidad, horas, link_generado_en, envio_id)
           OUTPUT INSERTED.id
           VALUES (@nombre, @clienteId, @curso, @instructor, @fecha, @grupoId, @correo, @herramientas, @modalidad, @horas, @linkGeneradoEn, @envioId)`
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
      // 2601/2627 = violación de índice/constraint único → ese envio_id ya se
      // guardó en un intento anterior: se responde ok (no es un error para
      // quien contestó) y NO se vuelve a contar.
      if (envioId && (err.number === 2601 || err.number === 2627)) duplicado = true;
      else throw err;
    }

    if (!duplicado) {
      try {
        await ajustarContadores(getEncuestaLinksTable(), { token: link ? token : null, delta: 1 });
      } catch (err) {
        context.log.warn("La respuesta se guardó pero no se pudo sumar al contador en vivo:", err.message);
      }
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
