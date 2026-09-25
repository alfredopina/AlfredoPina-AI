// registrarEventoDiploma/index.js
// Function PÚBLICA: suma 1 al contador de "clics en Agregar a LinkedIn" de un
// diploma (la página /verificar lo manda con sendBeacon al hacer clic).
// Identifica el diploma por código (?c) o por folio (?f, cuando se llegó
// tecleándolo). Solo cuenta si el diploma existe, y no cuenta al admin ni a
// robots. No guarda nada personal — es solo un número.
const { getDiplomasVerifTable, leerPorCodigo, leerPorFolio, registrarEvento } = require("../src/diplomas-verif");
const { esAdmin, esBot } = require("../src/verif-cliente");
const { CODIGO_CORTO_RE } = require("../src/codigo-corto");
const { JSON_HEADERS } = require("../src/http");

const FOLIO_RE = /^[A-Z0-9]{3,12}-\d{3,8}$/;

module.exports = async function (context, req) {
  const b = req.body || {};
  const codigo = String(b.c || "").trim().toLowerCase();
  const folio = String(b.f || "").trim().toUpperCase();
  const evento = String(b.e || "");
  const valido = evento === "linkedin" && (CODIGO_CORTO_RE.test(codigo) || FOLIO_RE.test(folio));
  if (!valido) {
    context.res = { status: 204, headers: JSON_HEADERS };
    return;
  }
  if (esAdmin(req) || esBot(req)) {
    context.res = { status: 204, headers: JSON_HEADERS };
    return;
  }
  try {
    const table = getDiplomasVerifTable();
    const r = CODIGO_CORTO_RE.test(codigo) ? await leerPorCodigo(table, codigo) : await leerPorFolio(table, folio);
    if (r) await registrarEvento(table, r.datos.codigo, evento);
  } catch (err) {
    context.log.error("Error registrando el evento del diploma:", err.message);
  }
  context.res = { status: 204, headers: JSON_HEADERS };
};
