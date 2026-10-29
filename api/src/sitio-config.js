// api/src/sitio-config.js — lo que Alfredo cambia desde admin → Personalizar SIN tocar código (2026-10-28).
// Cuatro secciones: linkedin (la publicación de la portada), contacto (correo y WhatsApp del pie), perfiles (ligas a redes) y aviso (franja
// con vencimiento). Viven en Table Storage (tabla ConfiguracionNotificaciones, renglón config/sitio): NUNCA SQL, porque las lee el sitio
// PÚBLICO (getConfiguracionSitio) y lo público no despierta la base. Cada sección se guarda como JSON en su propia columna.
// Regla de oro: una sección que NO se ha guardado no existe aquí, y el sitio usa los valores que ya trae su HTML. Todo se valida en el
// servidor (el panel valida de cortesía, pero nada se confía del navegador) porque estos textos terminan dentro de páginas públicas.
const { TableClient } = require("@azure/data-tables");

const TABLA = "ConfiguracionNotificaciones";
const PK = "config";
const RK = "sitio";
const SECCIONES = ["linkedin", "contacto", "perfiles", "aviso"];
const VIDA_CACHE_MS = 30 * 1000;
const cache = { datos: null, en: 0 };

function getTabla() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  return conn ? TableClient.fromConnectionString(conn, TABLA) : null;
}

class ErrorValidacion extends Error {}
const mal = (m) => { throw new ErrorValidacion(m); };
const limpiar = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

// ── LinkedIn ──
// LinkedIn da, en "Insertar esta publicación", un <iframe src="https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:123…" height="…">.
// Se acepta ese código completo o solo la liga; la liga se valida con una expresión estricta (solo el dominio www.linkedin.com, ruta de embed).
const EMBED_RE = /^https:\/\/www\.linkedin\.com\/embed\/feed\/update\/urn:li:(ugcPost|share|activity):\d{10,25}(\?[A-Za-z0-9=&_-]{0,60})?$/;
function extraerEmbed(texto) {
  const t = String(texto || "").trim();
  if (!t) return { embed: "", alto: null };
  const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(t);
  const h = /\bheight\s*=\s*["']?(\d{2,4})/i.exec(t);
  const embed = (src ? src[1] : t).trim().replace(/&amp;/g, "&");
  return { embed, alto: h ? Number(h[1]) : null };
}
function validarLinkedin(d = {}) {
  const mostrar = d.mostrar !== false && d.mostrar !== "false";
  const { embed, alto } = extraerEmbed(d.codigo != null ? d.codigo : d.embed);
  if (!embed) {
    if (mostrar) mal("Pega el código de inserción de LinkedIn (o apaga \"Mostrar la sección\").");
    return { mostrar: false, embed: "", alto: 560 };
  }
  if (!EMBED_RE.test(embed)) mal("Esa liga no es una publicación incrustada de LinkedIn. En LinkedIn: ⋯ de la publicación → Insertar esta publicación.");
  let a = d.alto != null && d.alto !== "" ? Number(d.alto) : alto != null ? alto : 560;
  if (!isFinite(a)) mal("El alto debe ser un número.");
  a = Math.min(1200, Math.max(300, Math.round(a)));
  return { mostrar, embed, alto: a };
}

// ── Contacto ──
function validarContacto(d = {}) {
  const correo = limpiar(d.correo, 120).toLowerCase();
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(correo)) mal("Escribe un correo válido.");
  let w = String(d.whatsapp == null ? "" : d.whatsapp).replace(/\D+/g, "");
  if (w.length === 10) w = "52" + w; // número mexicano sin lada del país
  if (w.length < 11 || w.length > 15) mal("El WhatsApp debe llevar la lada del país y el número (por ejemplo +52 81 1234 5678).");
  return { correo, whatsapp: w };
}

// ── Perfiles ──
const PERFILES = {
  linkedinPersonal: { hosts: ["www.linkedin.com"], ruta: /^\/in\/[A-Za-z0-9\-_%]{2,100}\/?$/, nombre: "LinkedIn personal (debe ser linkedin.com/in/tu-nombre)" },
  linkedinEmpresa: { hosts: ["www.linkedin.com"], ruta: /^\/company\/[A-Za-z0-9\-_%]{2,100}\/?$/, nombre: "LinkedIn de la empresa (debe ser linkedin.com/company/…)" },
  youtube: { hosts: ["www.youtube.com", "youtube.com", "youtu.be"], ruta: /^\/[A-Za-z0-9@\-_./]{2,120}$/, nombre: "YouTube" },
};
function validarPerfiles(d = {}) {
  const r = {};
  for (const [k, def] of Object.entries(PERFILES)) {
    const v = limpiar(d[k], 200);
    if (!v) { r[k] = ""; continue; }
    let u;
    try { u = new URL(v); } catch (e) { mal(def.nombre + ": escribe la liga completa (con https://)."); }
    if (u.protocol !== "https:" || u.username || u.password || !def.hosts.includes(u.hostname) || !def.ruta.test(u.pathname)) mal(def.nombre + ": esa liga no es válida.");
    r[k] = u.origin + u.pathname.replace(/\/$/, "");
  }
  return r;
}

// ── Aviso (franja del sitio) ──
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
function validarAviso(d = {}) {
  const activo = d.activo === true || d.activo === "true";
  const texto = limpiar(d.texto, 120);
  let enlace = limpiar(d.enlace, 200);
  const hasta = limpiar(d.hasta, 10);
  if (activo && !texto) mal("Escribe el texto del aviso (o apágalo).");
  if (texto.length > 120) mal("El texto del aviso admite hasta 120 caracteres.");
  if (enlace) {
    if (enlace.startsWith("/")) { if (enlace.startsWith("//") || enlace.includes("\\")) mal("El enlace del aviso no es válido."); }
    else {
      let u;
      try { u = new URL(enlace); } catch (e) { mal("El enlace del aviso debe empezar con / (una página del sitio) o con https://."); }
      if (u.protocol !== "https:" || u.username || u.password) mal("El enlace del aviso debe ser https:// o una página del sitio (/…).");
      enlace = u.href;
    }
  }
  if (hasta && (!FECHA_RE.test(hasta) || isNaN(Date.parse(hasta + "T00:00:00Z")))) mal("La fecha de vencimiento debe verse como 2026-11-03.");
  return { activo, texto, enlace, hasta };
}

const VALIDADORES = { linkedin: validarLinkedin, contacto: validarContacto, perfiles: validarPerfiles, aviso: validarAviso };

// hoy en Monterrey (UTC-6 todo el año) como "YYYY-MM-DD": el aviso vence al terminar el día "hasta"
function hoyMonterrey(ahora = new Date()) { return new Date(ahora.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 10); }
const avisoVigente = (a, ahora) => Boolean(a && a.activo && a.texto && (!a.hasta || a.hasta >= hoyMonterrey(ahora)));

// Lee todo lo guardado: { linkedin?, contacto?, perfiles?, aviso?, meta:{seccion:{en,por}} }. Nunca lanza (sin tabla = nada guardado).
async function leerTodo({ ahora = Date.now(), usarCache = true } = {}) {
  if (usarCache && cache.datos && ahora - cache.en < VIDA_CACHE_MS) return cache.datos;
  const salida = { meta: {} };
  const tabla = getTabla();
  if (tabla) {
    try {
      const e = await tabla.getEntity(PK, RK);
      for (const s of SECCIONES) {
        if (typeof e[s] !== "string" || !e[s]) continue;
        try { salida[s] = JSON.parse(e[s]); salida.meta[s] = { en: e[s + "_en"] || null, por: e[s + "_por"] || null }; } catch (err) { /* sección dañada: se ignora y manda el valor del HTML */ }
      }
    } catch (err) { /* sin renglón todavía */ }
  }
  cache.datos = salida; cache.en = ahora;
  return salida;
}

// Lo que ve el PÚBLICO: solo las secciones guardadas, sin quién ni cuándo, y el aviso solo si sigue vigente.
function paraPublico(todo, ahora = new Date()) {
  const p = {};
  for (const s of SECCIONES) if (todo[s]) p[s] = todo[s];
  if (p.aviso && !avisoVigente(p.aviso, ahora)) delete p.aviso;
  return p;
}

// seccion + datos → valida, guarda y devuelve la sección ya normalizada. `usuario` = correo verificado por Azure (no el que mande el navegador).
async function guardarSeccion(seccion, datos, usuario, ahora = new Date()) {
  if (!SECCIONES.includes(seccion)) mal("Esa sección no existe.");
  const limpio = VALIDADORES[seccion](datos || {});
  const tabla = getTabla();
  if (!tabla) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  try { await tabla.createTable(); } catch (err) { if (err.statusCode !== 409) throw err; }
  await tabla.upsertEntity({ partitionKey: PK, rowKey: RK, [seccion]: JSON.stringify(limpio), [seccion + "_en"]: ahora.toISOString(), [seccion + "_por"]: limpiar(usuario, 120) }, "Merge");
  cache.datos = null; cache.en = 0;
  return limpio;
}

function _reiniciarCache() { cache.datos = null; cache.en = 0; }

module.exports = { SECCIONES, EMBED_RE, ErrorValidacion, extraerEmbed, validarLinkedin, validarContacto, validarPerfiles, validarAviso, avisoVigente, hoyMonterrey, leerTodo, paraPublico, guardarSeccion, _reiniciarCache };
