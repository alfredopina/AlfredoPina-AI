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
// IDEMPOTENTE (corrige el bug de 3 Solicitudes por un solo envío): con la base
// dormida, el primer intento tarda más que el límite de ~45 s de Static Web
// Apps (llega un 504 al navegador aunque esta Function sigue y termina
// insertando), y el cliente reintenta con pausas — cada reintento insertaba otra
// fila. Ahora todo corre en una transacción protegida por un applock
// (sp_getapplock) cuya llave es el hash del envío; dentro del lock se busca una
// Solicitud 'Sitio' igual (mismo contacto, empresa, programa y detalles) de los
// últimos 30 min y, si existe, se devuelve esa en vez de crear otra. El applock
// serializa los intentos concurrentes, así que tampoco hay carrera.
// Los errores de base de datos devuelven 503 (el cliente reintenta); solo los
// de validación son 400 (definitivos, el cliente no reintenta).
const crypto = require("crypto");
const { getPool, sql } = require("../src/backoffice-db");
const { resolverCliente } = require("../src/cliente-resolver");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");
const { notificarSolicitudNueva } = require("../src/notificaciones-correo");
const antispam = require("../src/antispam-solicitud");

const MODALIDADES = ["Online", "Presencial", "Híbrido"];
const PARTICIPANTES_OPCIONES = ["Solo yo", "5 a 10", "10 a 15", "Más de 15"];

// El formulario ofrece esos rangos y también deja escribir un número. La columna Solicitud.participantes
// solo acepta los 4 rangos (CHECK de sql/007), así que un número se traduce al rango que le toca y el dato
// exacto viaja en las notas. De 2 a 4 personas ningún rango aplica: la columna queda vacía y el número, en notas.
function mapearParticipantes(raw) {
  if (PARTICIPANTES_OPCIONES.includes(raw)) return { columna: raw, nota: null };
  const m = raw.match(/\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 5000) return null;
  const nota = "Participantes: " + n;
  if (n === 1) return { columna: "Solo yo", nota: null };
  if (n >= 5 && n <= 10) return { columna: "5 a 10", nota };
  if (n >= 11 && n <= 15) return { columna: "10 a 15", nota };
  if (n > 15) return { columna: "Más de 15", nota };
  return { columna: null, nota };
}
const VENTANA_DUPLICADO_MIN = 30;

function derivarCodigo(nombre) {
  const base = (nombre || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "EMPRESA";
  return base + Math.floor(100 + Math.random() * 900);
}

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

  // llave del envío: mismo contacto + empresa + programa + detalles = mismo envío
  const llave = crypto
    .createHash("sha1")
    .update([nombreContacto, correo, telefono, empresaNombre, herramienta, temarioNombre, participantesRaw, modalidad, comentarios].map((x) => (x || "").toString().toLowerCase()).join("|"))
    .digest("hex");

  let pool;
  try {
    pool = await getPool();
  } catch (err) {
    context.log.error("No se pudo conectar a la base (solicitud pública):", err.message);
    context.res = { status: 503, headers: JSON_HEADERS, body: { error: "El sistema está despertando, inténtalo de nuevo." } };
    return;
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const nuevaRequest = () => new sql.Request(transaction);

    // serializa los intentos del MISMO envío; se libera solo al terminar la transacción
    const lock = await nuevaRequest()
      .input("recurso", sql.NVarChar, "solpub_" + llave)
      .query("DECLARE @r INT; EXEC @r = sp_getapplock @Resource = @recurso, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 40000; SELECT @r AS r");
    if (lock.recordset[0].r < 0) throw new Error("No se obtuvo el candado del envío (código " + lock.recordset[0].r + ")");

    const previa = await nuevaRequest()
      .input("herramienta", sql.NVarChar, herramienta)
      .input("temarioNombre", sql.NVarChar, temarioNombre)
      .input("nombre", sql.NVarChar, nombreContacto)
      .input("correo", sql.NVarChar, correo || "")
      .input("telefono", sql.NVarChar, telefono || "")
      .input("empresa", sql.NVarChar, empresaNombre)
      .input("fecha", sql.NVarChar, fechaTentativa || "")
      .input("ciudad", sql.NVarChar, ciudadSede || "")
      .input("participantes", sql.NVarChar, participantes || "")
      .input("modalidad", sql.NVarChar, modalidad || "")
      .input("notas", sql.NVarChar, notas || "")
      .input("ventana", sql.Int, VENTANA_DUPLICADO_MIN)
      .query(
        `SELECT TOP 1 s.id
           FROM Solicitud s
           JOIN Contacto c ON c.id = s.contacto_id
           JOIN Cliente cl ON cl.id = s.cliente_id
          WHERE s.canal_origen = 'Sitio'
            AND s.fecha_creacion >= DATEADD(MINUTE, -@ventana, SYSUTCDATETIME())
            AND s.herramienta = @herramienta AND s.temario_nombre = @temarioNombre
            AND c.nombre = @nombre AND ISNULL(c.correo, '') = @correo AND ISNULL(c.telefono, '') = @telefono
            AND cl.nombre = @empresa
            AND ISNULL(s.fecha_tentativa, '') = @fecha AND ISNULL(s.ciudad_sede, '') = @ciudad
            AND ISNULL(s.participantes, '') = @participantes AND ISNULL(s.modalidad, '') = @modalidad
            AND ISNULL(s.notas, '') = @notas
          ORDER BY s.id`
      );
    if (previa.recordset.length) {
      await transaction.commit();
      context.res = { status: 200, headers: JSON_HEADERS, body: { id: previa.recordset[0].id, duplicada: true } };
      return;
    }

    const cliente = await resolverCliente(nuevaRequest, { nombre: empresaNombre, codigo: derivarCodigo(empresaNombre) });

    const insertContacto = await nuevaRequest()
      .input("clienteId", sql.Int, cliente.id)
      .input("nombre", sql.NVarChar, nombreContacto)
      .input("correo", sql.NVarChar, correo)
      .input("telefono", sql.NVarChar, telefono)
      .input("tieneWhatsapp", sql.Bit, telefono ? 1 : 0)
      .query(
        `INSERT INTO Contacto (cliente_id, nombre, correo, telefono, tiene_whatsapp, es_principal)
         OUTPUT INSERTED.id
         VALUES (@clienteId, @nombre, @correo, @telefono, @tieneWhatsapp, 1)`
      );

    const insert = await nuevaRequest()
      .input("clienteId", sql.Int, cliente.id)
      .input("contactoId", sql.Int, insertContacto.recordset[0].id)
      .input("herramienta", sql.NVarChar, herramienta)
      .input("temarioNombre", sql.NVarChar, temarioNombre)
      .input("temasJson", sql.NVarChar, JSON.stringify(temas))
      .input("horasTotales", sql.Decimal(6, 1), horasTotales)
      .input("notas", sql.NVarChar, notas)
      .input("fechaTentativa", sql.NVarChar, fechaTentativa)
      .input("ciudadSede", sql.NVarChar, ciudadSede)
      .input("participantes", sql.NVarChar, participantes)
      .input("modalidad", sql.NVarChar, modalidad)
      .input("creoProspecto", sql.Bit, cliente.creado ? 1 : 0)
      .query(
        `INSERT INTO Solicitud
          (cliente_id, contacto_id, herramienta, temario_tipo, temario_nombre, temas_json, horas_totales, canal_origen, notas,
           fecha_tentativa, ciudad_sede, participantes, modalidad, fecha_estatus, creo_prospecto)
         OUTPUT INSERTED.id
         VALUES
          (@clienteId, @contactoId, @herramienta, 'estandar', @temarioNombre, @temasJson, @horasTotales, 'Sitio', @notas,
           @fechaTentativa, @ciudadSede, @participantes, @modalidad, SYSUTCDATETIME(), @creoProspecto)`
      );

    await transaction.commit();
    // solo una solicitud NUEVA cuenta para los límites (un reintento idempotente regresa antes de llegar aquí)
    await Promise.all([
      antispam.registrar(tabla, "ip", claveIp, antispam.LIMITE_IP, context),
      antispam.registrar(tabla, "contacto", claveCto, antispam.LIMITE_CONTACTO, context),
    ]);
    // aviso por correo a Alfredo (apagado si no hay configuración; nunca lanza ni retrasa más de unos segundos).
    // Tope global por hora: pasado el tope la solicitud igual queda en el admin, solo no se manda más correo.
    if (await antispam.consumirCupo(tabla, "aviso", "global", antispam.LIMITE_AVISOS, context)) {
      await notificarSolicitudNueva({
        id: insert.recordset[0].id, nombre: nombreContacto, empresa: empresaNombre, correo, telefono, programa: temarioNombre, herramienta,
        horas: horasTotales, participantes: participantesRaw, modalidad, comentarios,
      });
    } else {
      context.log.warn("Tope de correos de aviso por hora alcanzado: la solicitud " + insert.recordset[0].id + " no mandó correo.");
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { id: insert.recordset[0].id } };
  } catch (err) {
    try { await transaction.rollback(); } catch (_) { /* ya cerrada */ }
    context.log.error("Error creando la solicitud pública:", err.message);
    context.res = { status: 503, headers: JSON_HEADERS, body: { error: "No se pudo registrar tu solicitud, inténtalo de nuevo." } };
  }
};
