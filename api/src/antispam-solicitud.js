// Antispam del formulario público de solicitudes (crearSolicitudPublica). Capas
// gratuitas, todas del lado del servidor, sin CAPTCHA a propósito: un script de
// terceros (Turnstile/reCAPTCHA) puede quedar bloqueado por el firewall
// corporativo de un cliente legítimo y perderíamos justo la solicitud que
// importa. Capas:
//   1. honeypot (campo "web", lo revisa la Function).
//   2. tiempo mínimo: el navegador manda cuántos ms pasaron desde que se abrió
//      el formulario; un humano tarda más de unos segundos en llenarlo.
//   3. enlaces: sin URLs en nombre/empresa y máximo 1 en los comentarios.
//   4. límite por IP (por hora) y por contacto (por día), en Table Storage.
//   5. tope global de correos de aviso por hora: más allá de eso la solicitud
//      igual entra al admin, pero no se manda más correo (un ataque no llena la
//      bandeja ni gasta Azure Communication Services).
// Todo lo que depende de Table Storage es fail-open: si el contador falla, la
// solicitud real se acepta — el contador no es la defensa principal.
const crypto = require("crypto");
const { TableClient } = require("@azure/data-tables");

const TIEMPO_MINIMO_MS = 2000;
const LIMITE_IP = { max: 8, ventanaMs: 60 * 60 * 1000 };
const LIMITE_CONTACTO = { max: 3, ventanaMs: 24 * 60 * 60 * 1000 };
const LIMITE_AVISOS = { max: 10, ventanaMs: 60 * 60 * 1000 };
const TABLA = "LimiteSolicitudes";

const HAY_ENLACE = /(https?:\/\/|www\.)\S+/i;
const CUENTA_ENLACES = /(https?:\/\/|www\.)\S+/gi;

// Devuelve el mensaje de error (400) o null si todo bien.
function validarSenales({ tf, nombre, empresa, comentarios }) {
  const t = Number(tf);
  if (tf === undefined || tf === null || tf === "" || !Number.isFinite(t)) {
    return "No pudimos validar tu envío. Recarga la página e inténtalo de nuevo.";
  }
  if (t < TIEMPO_MINIMO_MS) return "Enviaste el formulario muy rápido. Revisa tus datos e inténtalo de nuevo.";
  if (HAY_ENLACE.test(nombre || "") || HAY_ENLACE.test(empresa || "")) return "El nombre y la empresa no pueden llevar enlaces.";
  if (((comentarios || "").match(CUENTA_ENLACES) || []).length > 1) return "Los comentarios no pueden llevar más de un enlace.";
  return null;
}

// IP del visitante tal como la entrega Static Web Apps ("1.2.3.4:5678" o varias separadas por coma).
function ipDe(req) {
  const h = (req && req.headers) || {};
  const crudo = String(h["x-forwarded-for"] || h["x-azure-clientip"] || h["client-ip"] || "").split(",")[0].trim();
  if (!crudo) return "";
  if (crudo.startsWith("[")) return crudo.slice(1, crudo.indexOf("]")); // IPv6 con puerto
  return crudo.includes(".") ? crudo.split(":")[0] : crudo; // IPv4 con puerto → sin puerto
}

function hashClave(valor) {
  return crypto.createHash("sha256").update("sol|" + String(valor).toLowerCase()).digest("hex").slice(0, 32);
}

// Una persona = su correo, o su WhatsApp (solo dígitos) si no dejó correo.
function claveContacto(correo, telefono) {
  const base = correo || (telefono || "").replace(/\D/g, "");
  return base ? hashClave("contacto|" + base) : "";
}

function getTabla() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) return null;
  return TableClient.fromConnectionString(conn, TABLA);
}

let tablaLista = false;
async function asegurarTabla(table) {
  if (tablaLista) return;
  try {
    await table.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err;
  }
  tablaLista = true;
}

async function leer(table, particion, clave) {
  try {
    return await table.getEntity(particion, clave);
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

function conteoVigente(entidad, ahora, ventanaMs) {
  if (!entidad || !entidad.ventanaInicio) return 0;
  return ahora - new Date(entidad.ventanaInicio).getTime() < ventanaMs ? Number(entidad.conteo) || 0 : 0;
}

// ¿Ya llegó al máximo en la ventana? Solo lee. Fail-open.
async function excede(table, particion, clave, { max, ventanaMs }, context) {
  if (!table || !clave) return false;
  try {
    await asegurarTabla(table);
    return conteoVigente(await leer(table, particion, clave), Date.now(), ventanaMs) >= max;
  } catch (err) {
    if (context) context.log.error("Antispam: no se pudo leer el contador:", err.message);
    return false;
  }
}

// Suma 1 al contador (abre ventana nueva si la anterior ya venció). Nunca lanza.
async function registrar(table, particion, clave, { ventanaMs }, context) {
  if (!table || !clave) return;
  try {
    await asegurarTabla(table);
    const ahora = Date.now();
    const entidad = await leer(table, particion, clave);
    const vigente = entidad && conteoVigente(entidad, ahora, ventanaMs) > 0;
    await table.upsertEntity(
      {
        partitionKey: particion,
        rowKey: clave,
        conteo: (vigente ? Number(entidad.conteo) || 0 : 0) + 1,
        ventanaInicio: vigente ? entidad.ventanaInicio : new Date(ahora).toISOString(),
      },
      "Replace"
    );
  } catch (err) {
    if (context) context.log.error("Antispam: no se pudo registrar el envío:", err.message);
  }
}

// Revisa y cuenta de una vez (para el tope de avisos por correo). true = hay cupo.
async function consumirCupo(table, particion, clave, limite, context) {
  if (await excede(table, particion, clave, limite, context)) return false;
  await registrar(table, particion, clave, limite, context);
  return true;
}

module.exports = {
  validarSenales, ipDe, hashClave, claveContacto, getTabla, excede, registrar, consumirCupo,
  TIEMPO_MINIMO_MS, LIMITE_IP, LIMITE_CONTACTO, LIMITE_AVISOS,
};
