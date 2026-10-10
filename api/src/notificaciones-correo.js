// Avisos por correo a Alfredo (hoy: solicitud nueva del sitio). Es el ÚNICO lugar que sabe CÓMO sale un correo:
// proveedor actual = Azure Communication Services Email (puente). Microsoft anunció (sept-2026) que ACS Email se
// retira el 2028-09-30; cuando la migración a Microsoft 365 esté lista, el cambio es reescribir SOLO
// `enviarCorreo` (Microsoft Graph sendMail desde un buzón compartido) — nadie más se entera.
//
// Application Settings (en el recurso Web-AlfredoPina):
//   ACS_EMAIL_CONNECTION      cadena de conexión del recurso Communication Services (secreta)
//   NOTIFICACIONES_REMITENTE  p. ej. notificaciones@alfredopina.ai (debe existir en MailFrom addresses del dominio)
//   NOTIFICACIONES_DESTINO    a dónde llegan los avisos (uno o varios correos separados por coma)
// Sin los tres, todo queda apagado (no falla, no envía): el sitio nunca debe romperse por un aviso.
const ajustes = require("./notificaciones-ajustes");

const TIMEOUT_MS = 6000;

// `destinoExtra` (lista) reemplaza a NOTIFICACIONES_DESTINO cuando viene con correos (p. ej. el resumen semanal)
function configuracion(destinoExtra) {
  const conexion = process.env.ACS_EMAIL_CONNECTION;
  const remitente = process.env.NOTIFICACIONES_REMITENTE;
  const destino = destinoExtra && destinoExtra.length
    ? destinoExtra
    : (process.env.NOTIFICACIONES_DESTINO || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!conexion || !remitente || !destino.length) return null;
  return { conexion, remitente, destino };
}

// nunca lanza: regresa { enviado, motivo? }
// `tipo` (opcional) = uno de notificaciones-ajustes.TIPOS: si el interruptor general o el de ese tipo está apagado en
// Configuración → Notificaciones, no sale nada (motivo "desactivado"). `destino` (opcional) = lista de correos.
async function enviarCorreo({ asunto, texto, html, tipo, destino }) {
  if (tipo && !(await ajustes.activo(tipo))) return { enviado: false, motivo: "desactivado" };
  const cfg = configuracion(destino);
  if (!cfg) return { enviado: false, motivo: "sin configurar" };
  try {
    const { EmailClient } = require("@azure/communication-email");
    const cliente = new EmailClient(cfg.conexion);
    const envio = cliente.beginSend({
      senderAddress: cfg.remitente,
      content: { subject: asunto, plainText: texto, html },
      recipients: { to: cfg.destino.map((address) => ({ address })) },
    });
    // beginSend solo ACEPTA el mensaje (la entrega la sigue Azure); no se espera a que termine
    await Promise.race([envio, new Promise((_, rechazar) => setTimeout(() => rechazar(new Error("tiempo de espera agotado")), TIMEOUT_MS))]);
    return { enviado: true };
  } catch (err) {
    console.warn("No se pudo enviar el aviso por correo:", err.message);
    return { enviado: false, motivo: err.message };
  }
}

const esc = (s) => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Solicitud creada desde el formulario público. `d` = { id, nombre, empresa, correo, telefono, programa, herramienta,
// horas, participantes, modalidad, comentarios }
async function notificarSolicitudNueva(d) {
  const empresa = d.empresa && d.empresa !== d.nombre ? d.empresa : "";
  const filas = [
    ["Programa", d.programa + (d.horas ? ` (${d.horas} hr)` : "")],
    ["Herramienta", d.herramienta],
    ["Nombre", d.nombre],
    ["Empresa", empresa],
    ["Correo", d.correo],
    ["WhatsApp", d.telefono],
    ["Participantes", d.participantes],
    ["Modalidad", d.modalidad],
    ["Comentarios", d.comentarios],
  ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "");
  const asunto = `Nueva solicitud: ${d.programa} — ${empresa || d.nombre}`.slice(0, 150);
  const enlace = "https://www.alfredopina.ai/admin";
  const texto = filas.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\nRevísala en el admin (Solicitudes): ${enlace}`;
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#181c24;max-width:560px">` +
    `<h2 style="margin:0 0 12px;font-size:18px">Nueva solicitud desde el sitio</h2>` +
    `<table style="border-collapse:collapse;width:100%;font-size:14px">` +
    filas.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#5b6270;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;white-space:pre-line">${esc(v)}</td></tr>`).join("") +
    `</table>` +
    `<p style="margin:18px 0 0"><a href="${enlace}" style="color:#1f5fe0">Abrir el admin (Solicitudes)</a></p>` +
    `</div>`;
  return enviarCorreo({ asunto, texto, html, tipo: "nuevaSolicitud" });
}

// Aviso con tabla etiqueta/valor y un enlace (mismo estilo que los de arriba). `filas` = [[etiqueta, valor], …]; los
// vacíos se omiten. Regresa { texto, html } listos para enviarCorreo.
function armarAviso({ titulo, filas, enlace, textoEnlace }) {
  const f = (filas || []).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "");
  const texto = f.map(([k, v]) => `${k}: ${v}`).join("\n") + (enlace ? `\n\n${textoEnlace || "Abrir"}: ${enlace}` : "");
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#181c24;max-width:560px"><h2 style="margin:0 0 12px;font-size:18px">${esc(titulo)}</h2>` +
    `<table style="border-collapse:collapse;width:100%;font-size:14px">` +
    f.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#5b6270;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;white-space:pre-line">${esc(v)}</td></tr>`).join("") +
    `</table>` +
    (enlace ? `<p style="margin:18px 0 0"><a href="${esc(enlace)}" style="color:#1f5fe0">${esc(textoEnlace || "Abrir")}</a></p>` : "") +
    `</div>`;
  return { texto, html };
}

// "2026-10-12T15:04:00.000Z" → "12 oct 2026, 9:04 a.m." en hora de Monterrey
function fechaLocal(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("es-MX", { timeZone: "America/Monterrey", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

module.exports = { enviarCorreo, notificarSolicitudNueva, configuracion, armarAviso, fechaLocal, esc };
