// avisarCursoAbierto/index.js
// Function PÚBLICA: «Avísame» / lista de espera de Cursos Abiertos (grupo lleno, sin fecha, filtro sin resultados o cierre de /cursos-abiertos).
// NO toca SQL: deja el envío en la COLA (ListaEsperaAbiertaPendientes) y el admin lo importa. Mismas defensas que reservarCursoAbierto
// (honeypot `web`, tiempo mínimo `tf`, límite por IP y por persona, idempotente por `idempotency_key`).
const colas = require("../src/cursos-abiertos-cola");
const antispam = require("../src/antispam-solicitud");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");

const LIMITE_IP = { max: 6, ventanaMs: 60 * 60 * 1000 };
const LIMITE_PERSONA = { max: 4, ventanaMs: 24 * 60 * 60 * 1000 };
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CONTEXTOS = ["modal_avisame", "sin_resultados", "cierre_pagina", "inscripcion_sin_grupos"];

const res = (context, status, body) => { context.res = { status, headers: JSON_HEADERS, body }; };
const limpio = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

module.exports = async function (context, req) {
  const b = req.body || {};
  if (limpio(b.web, 10)) return res(context, 200, { ok: true });

  const bad = (m) => res(context, 400, { error: m });
  const clave = limpio(b.idempotency_key, 80);
  if (!colas.CLAVE_OK.test(clave)) return bad("No pudimos validar tu envío. Recarga la página e inténtalo de nuevo.");
  const nombre = limpio(b.nombre, 200), correo = limpio(b.correo, 200).toLowerCase();
  if (!nombre) return bad("Escribe tu nombre.");
  if (!CORREO.test(correo)) return bad("El correo no parece válido.");
  const interes = limpio(b.interes, 30);
  if (interes !== "otro" && !HERRAMIENTAS.includes(interes)) return bad("Elige el curso que te interesa.");
  const paga = b.paga === "empresa" ? "empresa" : b.paga === "yo" ? "yo" : null;
  if (!paga) return bad("Indica quién paga.");
  if (b.acepta_aviso_privacidad !== true) return bad("Acepta el Aviso de Privacidad para continuar.");
  const errSenales = antispam.validarSenales({ tf: b.tf, nombre, empresa: "", comentarios: "" });
  if (errSenales) return bad(errSenales);

  const contexto = CONTEXTOS.includes(b.contexto) ? b.contexto : "cierre_pagina";
  const grupoRef = /^[A-Za-z0-9-]{3,20}$/.test(String(b.grupo_referencia || "")) ? String(b.grupo_referencia).toUpperCase() : null;
  const o = b.origen || {};
  const origen = { utm_source: limpio(o.utm_source, 120), utm_medium: limpio(o.utm_medium, 120), utm_campaign: limpio(o.utm_campaign, 120) };

  try {
    const colaT = colas.espera.getTable();
    if (await colas.espera.leer(colaT, clave)) return res(context, 200, { ok: true, duplicada: true });

    const tabla = antispam.getTabla();
    const ip = antispam.ipDe(req);
    const claveIp = ip ? antispam.hashClave("espera-ip|" + ip) : "";
    const clavePersona = antispam.claveContacto(correo, null);
    const [ipExcede, perExcede] = await Promise.all([
      antispam.excede(tabla, "ip-espera", claveIp, LIMITE_IP, context),
      antispam.excede(tabla, "persona-espera", clavePersona, LIMITE_PERSONA, context),
    ]);
    if (ipExcede || perExcede) return res(context, 429, { error: "Recibimos varios registros desde tu conexión. Inténtalo más tarde o escríbenos a alfredo.pina@lifezen.com.mx." });

    const datos = { tipo: "lista_espera", nombre, correo, interes, paga, contexto, grupo_referencia: grupoRef, origen };
    let guardada;
    try {
      guardada = await colas.espera.encolar(colaT, clave, { datos: JSON.stringify(datos), nombre, interes });
    } catch (err) {
      context.log.error("No se pudo encolar la lista de espera:", err.message);
      return res(context, 503, { error: "No se pudo registrar tu solicitud, inténtalo de nuevo." });
    }
    if (!guardada.nueva) return res(context, 200, { ok: true, duplicada: true });
    await Promise.all([
      antispam.registrar(tabla, "ip-espera", claveIp, LIMITE_IP, context),
      antispam.registrar(tabla, "persona-espera", clavePersona, LIMITE_PERSONA, context),
    ]);
    return res(context, 200, { ok: true });
  } catch (err) {
    context.log.error("Error en avisarCursoAbierto:", err.message);
    return res(context, 503, { error: "No se pudo registrar tu solicitud, inténtalo de nuevo." });
  }
};
