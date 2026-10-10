// responderPropuesta/index.js
// Function PÚBLICA: el cliente pulsa "Aceptar propuesta" en propuesta.html. Solo la PRIMERA aceptación queda guardada
// (Table Storage) y dispara un aviso por correo a Alfredo; las siguientes responden OK sin repetir nada. Nunca toca
// SQL (puede estar dormida): Alfredo decide en el admin si la cotización pasa a Ganada. Si quien responde es el admin
// (probando su propia propuesta) no se guarda nada.
const { getPropuestasTable, registrarAceptacion } = require("../src/propuestas");
const { CODIGO_CORTO_RE } = require("../src/codigo-corto");
const { esAdmin } = require("../src/verif-cliente");
const { enviarCorreo } = require("../src/notificaciones-correo");
const { JSON_HEADERS } = require("../src/http");

const esc = (s) => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = async function (context, req) {
  const body = req.body || {};
  const codigo = String(body.codigo || "").trim().toLowerCase();
  const nombre = String(body.nombre || "").trim();
  const comentario = String(body.comentario || "").trim();
  const contacto = String(body.contacto || "").trim();
  const adicionales = Array.isArray(body.adicionales) ? body.adicionales.slice(0, 10) : [];

  if (String(body.web || "").trim()) { // honeypot: los robots llenan este campo, la gente no lo ve
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
    return;
  }
  if (!CODIGO_CORTO_RE.test(codigo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el código de la propuesta." } };
    return;
  }
  if (nombre.length < 2 || nombre.length > 120) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Escribe tu nombre." } };
    return;
  }
  if (comentario.length > 1000) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El comentario es muy largo (máximo 1000 caracteres)." } };
    return;
  }
  if (contacto.length > 120) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El correo o teléfono es muy largo." } };
    return;
  }
  if (esAdmin(req)) {
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, simulado: true } };
    return;
  }

  try {
    const r = await registrarAceptacion(getPropuestasTable(), codigo, { nombre, comentario, adicionales, contacto });
    if (!r) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa propuesta no existe o ya no está disponible." } };
      return;
    }
    if (r.primera) {
      const s = r.snapshot;
      const enlace = `https://www.alfredopina.ai/propuesta/${codigo}`;
      const filas = [["Propuesta", `${s.folio} — ${s.programa}`], ["Cliente", s.cliente], ["Aceptó", nombre], ["Contacto", r.contacto], ["Adicionales que agregó", (r.adicionales || []).map((a) => a.n).join(", ")], ["Comentarios", comentario]].filter(([, v]) => v && String(v).trim());
      await enviarCorreo({
        asunto: `Propuesta aceptada: ${s.folio} — ${s.cliente}`.slice(0, 150),
        texto: filas.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\nVer la propuesta: ${enlace}`,
        html:
          `<div style="font-family:Arial,Helvetica,sans-serif;color:#181c24;max-width:560px"><h2 style="margin:0 0 12px;font-size:18px">Aceptaron una propuesta</h2>` +
          `<table style="border-collapse:collapse;width:100%;font-size:14px">` +
          filas.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#5b6270;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;white-space:pre-line">${esc(v)}</td></tr>`).join("") +
          `</table><p style="margin:18px 0 0"><a href="${enlace}" style="color:#1f5fe0">Abrir la propuesta</a></p></div>`,
      });
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error registrando la aceptación:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo registrar tu respuesta, intenta de nuevo." } };
  }
};
