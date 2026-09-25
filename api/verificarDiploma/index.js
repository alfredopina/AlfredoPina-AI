// verificarDiploma/index.js
// Function PÚBLICA: la página /verificar consulta aquí un diploma, ya sea por
// CÓDIGO (?c=, el del QR: 8 caracteres no adivinables → nombre completo) o por
// FOLIO (?f=, tecleado a mano: el folio es consecutivo y se podría recorrer
// para juntar nombres → nombre abreviado, el código NO se devuelve y cada IP
// tiene candado de intentos). Nunca toca SQL: lee el registro de Table
// Storage que escribe reconstruirSnapshotGrupo. Calificación y asistencia no
// viven en ese registro — no hay forma de exponerlas por aquí.
const crypto = require("crypto");
const { getDiplomasVerifTable, getVerifLimiteTable, ensureTable, leerPorCodigo, leerPorFolio, registrarVista, abreviarNombre } = require("../src/diplomas-verif");
const { checarBloqueo, registrarIntentoFallido } = require("../src/rate-limit");
const { esAdmin, esBot } = require("../src/verif-cliente");
const { CODIGO_CORTO_RE } = require("../src/codigo-corto");
const { JSON_HEADERS } = require("../src/http");

const FOLIO_RE = /^[A-Z0-9]{3,12}-\d{3,8}$/;

// Del candado de intentos solo se guarda una huella cifrada de la IP (SHA-256
// con sal), nunca la IP: sirve para frenar el abuso, no para identificar a nadie.
function ipDe(req) {
  const h = String((req.headers && (req.headers["x-forwarded-for"] || req.headers["x-azure-clientip"])) || "unknown");
  const ip = h.split(",")[0].trim() || "unknown";
  return crypto.createHash("sha256").update("verif|" + ip).digest("hex").slice(0, 32);
}

module.exports = async function (context, req) {
  const codigo = String(req.query.c || "").trim().toLowerCase();
  const folio = String(req.query.f || "").trim().toUpperCase();
  const porCodigo = Boolean(codigo);
  if (porCodigo ? !CODIGO_CORTO_RE.test(codigo) : !FOLIO_RE.test(folio)) {
    // formato imposible: se trata como "no encontrado" sin gastar lectura
    context.res = { status: 404, headers: JSON_HEADERS, body: { error: "No encontrado." } };
    return;
  }

  try {
    const table = getDiplomasVerifTable();
    if (!porCodigo) {
      // cada búsqueda por folio cuenta (acierte o no): recorrer folios
      // consecutivos que SÍ existen también es el abuso que se quiere frenar
      const limiteTable = getVerifLimiteTable();
      await ensureTable(limiteTable);
      const pkLimite = "ip_" + ipDe(req);
      const bloqueadoHasta = await checarBloqueo(limiteTable, pkLimite, context);
      if (bloqueadoHasta) {
        context.res = { status: 429, headers: JSON_HEADERS, body: { error: "Demasiadas búsquedas seguidas. Espera unos minutos e intenta de nuevo." } };
        return;
      }
      await registrarIntentoFallido(limiteTable, pkLimite, context);
    }

    const r = porCodigo ? await leerPorCodigo(table, codigo) : await leerPorFolio(table, folio);
    if (!r) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "No encontrado." } };
      return;
    }

    // no cuenta al admin ni a robots; ?r=li lo manda la página cuando el visitante llegó desde LinkedIn
    if (!esAdmin(req) && !esBot(req)) {
      registrarVista(table, r.datos.codigo, { porCodigo, desdeLinkedin: String(req.query.r || "") === "li" }).catch((err) => context.log.error("Error registrando verificación:", err.message));
    }
    const d = { ...r.datos };
    if (!porCodigo) {
      d.nombre = abreviarNombre(d.nombre);
      delete d.codigo;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ...d, porCodigo, verificadoEn: new Date().toISOString() } };
  } catch (err) {
    context.log.error("Error verificando diploma:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo verificar en este momento. Intenta de nuevo." } };
  }
};
