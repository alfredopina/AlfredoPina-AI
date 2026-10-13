// enviarRespuesta/index.js
// Function pública: recibe un envío completo de encuesta.html (cabecera + respuestas), lo valida y lo deja en la COLA
// (Table Storage) — NUNCA toca SQL: contestar la encuesta no despierta ni mantiene despierta la base (ver
// api/src/encuesta-cola.js y cola-tabla.js). El envío pasa a SQL cuando Alfredo abre el panel Encuestas o pulsa
// "Importar ahora" (importarEncuestasPendientes).
//
// SOLO con token (link o QR por grupo, 2026-10-13): el cliente/curso/instructor/herramientas/horas/modalidad salen del snapshot
// guardado en Table Storage al generar el link — el navegador NO manda ni puede alterar esos datos — y se guarda grupo_id. Si el
// link está cerrado se rechaza aquí (no solo en la pantalla). Ese snapshot se COPIA a la fila al encolar. Ya no existe el link
// genérico (la persona tecleaba su empresa y eso exigía una búsqueda pública de clientes): sin token → 400.
//
// Las respuestas se validan contra el banco REAL de Table Storage (encuesta-logic.js/validarRespuestas): todas las de escala
// con un entero 1-5, ningún id que no exista, y el texto/categoría/tipo que se guarda como copia congelada en cada renglón
// sale del banco, nunca del navegador.
//
// `envioId` (UUID que genera el navegador UNA vez por clic en "Enviar" y reusa en cada reintento) es la llave de la fila: si el
// primer intento sí se guardó pero la confirmación se perdió, el reintento choca y se responde ok sin volver a encolar ni contar.
//
// Los contadores en vivo (Table Storage) suman al ENCOLAR (mejor esfuerzo — si falla, el envío YA quedó guardado y no se le
// avisa error a quien contestó); importar a SQL no vuelve a sumar.
//
// Sin protección anti-spam/anti-duplicados en el servidor — sigue siendo intencional (link controlado por QR en vivo; la encuesta
// es anónima); el aviso suave de "ya contestaste" vive en el navegador (localStorage), no bloquea.
const crypto = require("crypto");
const { getEncuestaPreguntasTable, listarTodas, bancoVigente } = require("../src/encuesta-tables");
const { getEncuestaLinksTable, leerLink, ajustarContadores } = require("../src/encuesta-links");
const { validarRespuestas, errorSeguro, fechaMexico, CORREO_RE, esInstructorMarca } = require("../src/encuesta-logic");
const { getColaTable, encolar } = require("../src/encuesta-cola");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const token = (body.token || "").trim();
  const nombre = (body.nombre || "").trim().slice(0, 200) || null;
  const correo = (body.correo || "").trim().slice(0, 200) || null;
  const envioId = /^[A-Za-z0-9_-]{8,40}$/.test(String(body.envioId || "")) ? String(body.envioId) : crypto.randomUUID();

  try {
    if (correo && !CORREO_RE.test(correo)) throw errorSeguro("El correo no se ve válido — revísalo o déjalo en blanco.");

    // 1. Datos del grupo (token) o del formulario (genérico)
    if (!token) throw errorSeguro("Esta encuesta se contesta con el link o el QR de tu grupo — pídeselo a tu instructor.", 400);
    const link = await leerLink(getEncuestaLinksTable(), token);
    if (!link) throw errorSeguro("Este link no es válido — pide de nuevo el link o el QR a tu instructor.", 404);
    if (!link.abierta) throw errorSeguro("Esta encuesta ya cerró — gracias por tu interés.", 403);
    const curso = link.curso;
    const instructor = link.instructor;

    // 2. Respuestas contra el banco real
    const banco = bancoVigente(await listarTodas(getEncuestaPreguntasTable()));
    const detalle = validarRespuestas(banco, body.respuestas);

    // Permiso de testimonio (sql/027): solo vale si de verdad hay comentario, hay nombre para firmarlo y el instructor es Alfredo —
    // lo demás es un navegador desactualizado o un envío manipulado.
    const hayComentario = detalle.some((d) => d.tipo === "texto" && String(d.valor || "").trim());
    const autorizaTestimonio = body.autorizaTestimonio === true && Boolean(nombre) && hayComentario && esInstructorMarca(instructor);

    // 3. Cola (Table Storage)
    const ahora = new Date();
    const datos = {
      token,
      linkSnap: { grupoId: link.grupoId, clienteId: link.clienteId, clienteNombre: link.clienteNombre, herramientas: link.herramientas, modalidad: link.modalidad, horas: link.horas, generadoEn: link.generadoEn },
      empresa: null, curso: curso.slice(0, 200), instructor: instructor.slice(0, 120), nombre, correo, autorizaTestimonio, fecha: fechaMexico(ahora),
      detalle: detalle.map((d) => ({ preguntaId: d.preguntaId, valor: d.valor, texto: String(d.texto || "").slice(0, 500), categoria: d.categoria, tipo: d.tipo })),
    };
    const r = await encolar(getColaTable(), envioId, datos, ahora);

    if (r.nueva) {
      try {
        await ajustarContadores(getEncuestaLinksTable(), { token, delta: 1 });
      } catch (err) {
        context.log.warn("La respuesta se guardó pero no se pudo sumar al contador en vivo:", err.message);
      }
    }

    context.res = { status: 200, headers: JSON_HEADERS, body: r.nueva ? { ok: true } : { ok: true, duplicada: true } };
  } catch (err) {
    if (err.safe) {
      context.res = { status: err.status || 400, headers: JSON_HEADERS, body: { error: err.message } };
      return;
    }
    context.log.error("Error guardando la respuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar tu respuesta en este momento." } };
  }
};
