// reservarCursoAbierto/index.js
// Function PÚBLICA: la inscripción de 1 a 3 personas a un grupo de Cursos Abiertos (/cursos-abiertos). NO toca SQL: reserva los lugares en el contador
// atómico (Table Storage), deja la inscripción en la COLA (InscripcionesAbiertasPendientes) y responde en ~1 s; el admin la importa después
// (Alumno + Inscripción + cuenta por cobrar). Mismo patrón y mismas reglas que crearSolicitudPublica:
//   · honeypot `web`, tiempo mínimo `tf`, límite por IP y por persona (api/src/antispam-solicitud.js).
//   · idempotente por `idempotency_key` (UUID del navegador): un reintento no duplica la fila ni gasta lugares.
//   · los montos los calcula el SERVIDOR con la foto publicada; lo que mande el navegador no cuenta.
//   · 400/409 = definitivos (el navegador no reintenta); 429 = demasiados envíos; 503 = reintentable.
const cal = require("../src/calendario-abiertos");
const colas = require("../src/cursos-abiertos-cola");
const antispam = require("../src/antispam-solicitud");
const { JSON_HEADERS } = require("../src/http");

const LIMITE_IP = { max: 6, ventanaMs: 60 * 60 * 1000 };
const LIMITE_PERSONA = { max: 4, ventanaMs: 24 * 60 * 60 * 1000 };
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

const res = (context, status, body) => { context.res = { status, headers: JSON_HEADERS, body }; };
const limpio = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

module.exports = async function (context, req) {
  const b = req.body || {};
  if (limpio(b.web, 10)) return res(context, 200, { ok: true }); // honeypot: un humano nunca lo llena

  const bad = (m) => res(context, 400, { error: m });
  const clave = limpio(b.idempotency_key, 80);
  if (!colas.CLAVE_OK.test(clave)) return bad("No pudimos validar tu envío. Recarga la página e inténtalo de nuevo.");
  const codigo = limpio(b.grupo, 30).toUpperCase();
  const paga = b.paga === "empresa" ? "empresa" : b.paga === "yo" ? "yo" : null;
  if (!paga) return bad("Indica quién paga.");
  if (b.acepta_aviso_privacidad !== true) return bad("Acepta el Aviso de Privacidad para continuar.");

  const personas = [];
  for (const p of (Array.isArray(b.personas) ? b.personas : []).slice(0, 10)) {
    const nombre = limpio(p && p.nombre, 200), correo = limpio(p && p.correo, 200).toLowerCase(), wa = limpio(p && p.whatsapp, 40);
    if (!nombre) return bad("Falta el nombre de una persona.");
    if (!CORREO.test(correo)) return bad("El correo de " + nombre + " no parece válido.");
    if (wa && (wa.replace(/\D/g, "").length < 8 || wa.replace(/\D/g, "").length > 15)) return bad("El WhatsApp de " + nombre + " no parece válido (incluye la lada).");
    personas.push({ nombre, correo, whatsapp: wa || null });
  }
  if (!personas.length) return bad("Agrega al menos una persona.");
  if (!personas[0].whatsapp) return bad("Déjanos un WhatsApp de contacto (con lada).");

  const f = b.factura || {};
  const factura = { requiere: f.requiere === true, rfc: null, razon_social: null };
  if (factura.requiere) {
    factura.rfc = limpio(f.rfc, 13).toUpperCase();
    factura.razon_social = limpio(f.razon_social, 200);
    if (!RFC.test(factura.rfc)) return bad("El RFC no parece válido (12 o 13 caracteres).");
    if (!factura.razon_social) return bad("Escribe la razón social para la factura.");
  }

  const errSenales = antispam.validarSenales({ tf: b.tf, nombre: personas.map((p) => p.nombre).join(" "), empresa: factura.razon_social || "", comentarios: "" });
  if (errSenales) return bad(errSenales);

  const o = b.origen || {};
  const origen = { utm_source: limpio(o.utm_source, 120), utm_medium: limpio(o.utm_medium, 120), utm_campaign: limpio(o.utm_campaign, 120) };

  try {
    const tablaCal = cal.getTable();
    const r = await cal.leerFoto(tablaCal);
    const g = r && r.foto.grupos.find((x) => x.codigo === codigo);
    if (!g || !cal.esReservable(g)) return res(context, 409, { error: "Este grupo ya no está disponible. Elige otra fecha o pide que te avisemos." });
    const max = r.foto.ajustes.max_personas_por_inscripcion || 3;
    if (personas.length > max) return bad("Máximo " + max + " personas por inscripción. Para grupos más grandes escríbenos.");

    // reintento del mismo envío: contesta ok sin gastar lugares ni contar de nuevo
    const colaT = colas.inscripciones.getTable();
    if (await colas.inscripciones.leer(colaT, clave)) return res(context, 200, { ok: true, duplicada: true });

    const tabla = antispam.getTabla();
    const ip = antispam.ipDe(req);
    const claveIp = ip ? antispam.hashClave("abiertos-ip|" + ip) : "";
    const clavePersona = antispam.claveContacto(personas[0].correo, personas[0].whatsapp);
    const [ipExcede, perExcede] = await Promise.all([
      antispam.excede(tabla, "ip-abiertos", claveIp, LIMITE_IP, context),
      antispam.excede(tabla, "persona-abiertos", clavePersona, LIMITE_PERSONA, context),
    ]);
    if (ipExcede || perExcede) return res(context, 429, { error: "Recibimos varias inscripciones desde tu conexión. Inténtalo más tarde o escríbenos a alfredo.pina@lifezen.com.mx." });

    const reserva = await cal.reservarLugares(tablaCal, codigo, personas.length);
    if (!reserva.ok) {
      return res(context, 409, { error: reserva.libres > 0 ? "Solo quedan " + reserva.libres + " lugares en este grupo." : "Este grupo se acaba de llenar. Pide que te avisemos del próximo.", libres: reserva.libres, lleno: reserva.libres === 0 });
    }

    const montos = cal.totalesInscripcion(g, personas.length, paga, r.foto.ajustes);
    const horas = r.foto.ajustes.horas_vigencia_apartado || 48;
    const recibidoEn = new Date();
    const datos = {
      tipo: "inscripcion_abierta", grupo: codigo, programa_id: g.programa_id, personas, num_personas: personas.length, paga, factura,
      monto_estimado: montos, estado_pago: "pendiente", apartado_hasta: new Date(recibidoEn.getTime() + horas * 3600 * 1000).toISOString(), origen,
    };
    let guardada;
    try {
      guardada = await colas.inscripciones.encolar(colaT, clave, { datos: JSON.stringify(datos), grupo: codigo, nombre: personas[0].nombre, lugares: personas.length }, recibidoEn);
    } catch (err) {
      await cal.liberarLugares(tablaCal, codigo, personas.length);
      context.log.error("No se pudo encolar la inscripción abierta:", err.message);
      return res(context, 503, { error: "No se pudo registrar tu inscripción, inténtalo de nuevo." });
    }
    if (!guardada.nueva) { // otro envío con la misma llave ganó la carrera
      await cal.liberarLugares(tablaCal, codigo, personas.length);
      return res(context, 200, { ok: true, duplicada: true });
    }
    await Promise.all([
      antispam.registrar(tabla, "ip-abiertos", claveIp, LIMITE_IP, context),
      antispam.registrar(tabla, "persona-abiertos", clavePersona, LIMITE_PERSONA, context),
    ]);
    return res(context, 200, { ok: true, referencia: "AB-" + clave.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase(), monto: montos, apartado_horas: horas });
  } catch (err) {
    context.log.error("Error en reservarCursoAbierto:", err.message);
    return res(context, 503, { error: "No se pudo registrar tu inscripción, inténtalo de nuevo." });
  }
};
