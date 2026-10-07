// crearSolicitudPublica/index.js
// Function PÚBLICA (anonymous, sin rol — no listada en staticwebapp.config.json
// a propósito, igual que getCatalogoCursos): el formulario de cursos.html crea
// aquí la Solicitud real (ya es el ÚNICO canal del formulario: sin WhatsApp ni
// correo). Mismo contrato que crearSolicitud (admin), con estas diferencias:
//   - canal_origen siempre 'Sitio'.
//   - el form público no pide "código" de empresa (fricción innecesaria para
//     un prospecto frío) — se deriva uno de su nombre + sufijo random para no
//     chocar con un código real existente.
//   - pide un medio de contacto (correo y/o WhatsApp, campos separados; al menos uno) y crea el
//     Contacto real del prospecto: es la única forma en que Alfredo puede
//     responderle.
//   - antispam por capas (honeypot, tiempo mínimo, enlaces, límite por IP y por
//     contacto, tope de correos de aviso): ver api/src/antispam-solicitud.js.
//   - marca Solicitud.creo_prospecto cuando ESTA solicitud dio de alta a la
//     empresa (alimenta la tarjeta "Prospectos generados" del admin).
//
// COLA, NO SQL DIRECTO (2026-10-07): la base se duerme y despertarla tarda 30-60 s
// o más; con el formulario escribiendo directo a SQL el visitante esperaba (y a
// veces recibía error o cerraba la ventana y se perdía la solicitud). Ahora esta
// Function valida, aplica el antispam, guarda en Table Storage (cola) y responde
// en ~1 s; la solicitud pasa a SQL cuando el admin la lee (drenarConSql, ver
// api/src/solicitud-publica-cola.js). Idempotente: el mismo envío = la misma fila
// de la cola, así un reintento del navegador no crea otra. Los errores de
// validación son 400 (definitivos, el cliente no reintenta); un fallo al guardar
// en la cola es 503 (el cliente reintenta).
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");
const { notificarSolicitudNueva } = require("../src/notificaciones-correo");
const antispam = require("../src/antispam-solicitud");
const cola = require("../src/solicitud-publica-cola");

const MODALIDADES = ["Online", "Presencial", "Híbrido"];
// los rangos de participantes y su traducción de número a rango viven en solicitud-guardar.js (los usa también el admin)
const { mapearParticipantes } = require("../src/solicitud-guardar");

function bad(context, error) {
  context.res = { status: 400, headers: JSON_HEADERS, body: { error } };
}

module.exports = async function (context, req) {
  const body = req.body || {};

  // honeypot: un humano nunca llena este campo (oculto por CSS en el form)
  if ((body.web || "").trim()) {
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
    return;
  }

  const nombreContacto = (body.nombre || "").trim().slice(0, 200);
  const empresaNombre = ((body.empresa || "").trim() || nombreContacto).slice(0, 200);
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const temarioNombre = (body.temario_nombre || "").trim().slice(0, 200);
  const temas = Array.isArray(body.temas) ? body.temas : [];
  const horasTotales = Number(body.horas_totales);
  const fechaTentativa = null; // el formulario ya no los pide (se aclaran en la primera llamada)
  const ciudadSede = null;
  const participantesRaw = String(body.participantes === undefined || body.participantes === null ? "" : body.participantes).trim().slice(0, 60);
  const modalidad = (body.modalidad || "").trim() || null;
  const comentarios = (body.comentarios || "").trim().slice(0, 2000);
  // correo y WhatsApp van separados (al menos uno); "contacto" (un solo campo) se acepta por compatibilidad
  let correoRaw = (body.correo || "").trim().slice(0, 200);
  let whatsappRaw = (body.whatsapp || "").trim().slice(0, 40);
  const contactoLegacy = (body.contacto || "").trim().slice(0, 200);
  if (!correoRaw && !whatsappRaw && contactoLegacy) { if (contactoLegacy.includes("@")) correoRaw = contactoLegacy; else whatsappRaw = contactoLegacy; }

  if (!nombreContacto) return bad(context, "Falta tu nombre.");
  if (!correoRaw && !whatsappRaw) return bad(context, "Déjanos tu correo o tu WhatsApp para poder responderte.");
  if (!HERRAMIENTAS.includes(herramienta)) return bad(context, "Herramienta inválida.");
  if (!temarioNombre) return bad(context, "Falta el programa.");
  if (!Number.isFinite(horasTotales) || horasTotales <= 0) return bad(context, "Las horas no son válidas.");
  if (modalidad && !MODALIDADES.includes(modalidad)) return bad(context, "Modalidad inválida.");
  if (!participantesRaw) return bad(context, "Indica cuántas personas participarán.");
  const part = mapearParticipantes(participantesRaw);
  if (!part) return bad(context, "El número de participantes no es válido.");
  const participantes = part.columna;

  let correo = null;
  let telefono = null;
  if (correoRaw) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correoRaw)) return bad(context, "El correo no parece válido.");
    correo = correoRaw.toLowerCase();
  }
  if (whatsappRaw) {
    const digitos = whatsappRaw.replace(/\D/g, "");
    if (digitos.length < 8 || digitos.length > 15) return bad(context, "El WhatsApp no parece válido (incluye la lada).");
    telefono = whatsappRaw.slice(0, 30);
  }

  // antispam: señales del formulario y límites por IP / por contacto (los contadores fallan abiertos)
  const errSenales = antispam.validarSenales({ tf: body.tf, nombre: nombreContacto, empresa: empresaNombre, comentarios });
  if (errSenales) return bad(context, errSenales);
  const tabla = antispam.getTabla();
  const ip = antispam.ipDe(req);
  const claveIp = ip ? antispam.hashClave("ip|" + ip) : "";
  const claveCto = antispam.claveContacto(correo, telefono);
  const [ipExcede, ctoExcede] = await Promise.all([
    antispam.excede(tabla, "ip", claveIp, antispam.LIMITE_IP, context),
    antispam.excede(tabla, "contacto", claveCto, antispam.LIMITE_CONTACTO, context),
  ]);
  if (ipExcede || ctoExcede) {
    context.res = {
      status: 429,
      headers: JSON_HEADERS,
      body: { error: "Recibimos varias solicitudes desde tu conexión. Inténtalo más tarde o escríbenos a alfredo.pina@lifezen.com.mx." },
    };
    return;
  }

  const notas = [comentarios, part.nota].filter(Boolean).join("\n") || null;

  // La solicitud NO se escribe en SQL aquí: se guarda en la cola (Table Storage,
  // que nunca se duerme) y se contesta al instante. Pasa a SQL cuando Alfredo abre
  // el admin y la base está despierta — ver api/src/solicitud-publica-cola.js.
  const datos = {
    nombreContacto, empresaNombre, correo, telefono, herramienta, temarioNombre, temas, horasTotales,
    participantes, participantesRaw, modalidad, comentarios, notas,
  };
  const llave = cola.llaveDeEnvio(datos);

  let guardada;
  try {
    guardada = await cola.encolar(cola.getColaTable(), llave, datos);
  } catch (err) {
    context.log.error("Error guardando la solicitud pública en la cola:", err.message);
    context.res = { status: 503, headers: JSON_HEADERS, body: { error: "No se pudo registrar tu solicitud, inténtalo de nuevo." } };
    return;
  }

  // un reintento del mismo envío (ya estaba en la cola o ya pasó a SQL) responde ok sin contar ni avisar otra vez
  if (!guardada.nueva) {
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, duplicada: true } };
    return;
  }

  // solo una solicitud NUEVA cuenta para los límites
  await Promise.all([
    antispam.registrar(tabla, "ip", claveIp, antispam.LIMITE_IP, context),
    antispam.registrar(tabla, "contacto", claveCto, antispam.LIMITE_CONTACTO, context),
  ]);
  // aviso por correo a Alfredo (apagado si no hay configuración; nunca lanza ni retrasa más de unos segundos).
  // Sale AHORA, no cuando la solicitud llegue a SQL: así se entera aunque la base siga dormida.
  // Tope global por hora: pasado el tope la solicitud igual queda en la cola, solo no se manda más correo.
  if (await antispam.consumirCupo(tabla, "aviso", "global", antispam.LIMITE_AVISOS, context)) {
    await notificarSolicitudNueva({
      nombre: nombreContacto, empresa: empresaNombre, correo, telefono, programa: temarioNombre, herramienta,
      horas: horasTotales, participantes: participantesRaw, modalidad, comentarios,
    });
  } else {
    context.log.warn("Tope de correos de aviso por hora alcanzado: la solicitud " + llave + " no mandó correo.");
  }
  context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
};
