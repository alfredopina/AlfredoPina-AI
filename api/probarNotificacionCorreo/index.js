// probarNotificacionCorreo/index.js
// Function protegida (rol "admin"): los 2 botones de prueba de Configuración → Notificaciones.
//   { accion: "prueba" }  → manda un correo de prueba corto (verifica que Azure Communication Services, el remitente y el
//                           destino funcionan). No respeta los interruptores: es una acción explícita.
//   { accion: "resumen" } → manda el resumen semanal ahora, como prueba, solo a NOTIFICACIONES_DESTINO (ver
//                           api/src/notificaciones-resumen-envio.js). Si la base está dormida responde 503.
const { enviarCorreo, armarAviso, fechaLocal, configuracion } = require("../src/notificaciones-correo");
const { enviarResumen } = require("../src/notificaciones-resumen-envio");
const { JSON_HEADERS } = require("../src/http");

const FALTA = "Faltan configuraciones de correo en Azure (ACS_EMAIL_CONNECTION, NOTIFICACIONES_REMITENTE y NOTIFICACIONES_DESTINO).";

module.exports = async function (context, req) {
  const accion = String((req.body && req.body.accion) || "");
  const responder = (status, body) => { context.res = { status, headers: JSON_HEADERS, body }; };
  try {
    if (accion === "prueba") {
      const cfg = configuracion();
      if (!cfg) return responder(400, { error: FALTA });
      const aviso = armarAviso({
        titulo: "Correo de prueba",
        filas: [["Desde", cfg.remitente], ["Para", cfg.destino.join(", ")], ["Enviado", fechaLocal(new Date().toISOString())]],
        enlace: "https://www.alfredopina.ai/admin",
        textoEnlace: "Abrir el admin",
      });
      const r = await enviarCorreo({ asunto: "Correo de prueba — notificaciones del sitio", ...aviso });
      if (!r.enviado) return responder(502, { error: "Azure no aceptó el correo: " + (r.motivo || "motivo desconocido") });
      return responder(200, { ok: true, destino: cfg.destino });
    }
    if (accion === "resumen") {
      const r = await enviarResumen({ context, manual: true });
      if (r.status === 503) return responder(503, { error: "La base de datos sigue despertando. Intenta de nuevo en un minuto." });
      if (r.status === 400) return responder(400, { error: FALTA });
      if (r.status >= 400) return responder(r.status, { error: r.body.error || "No se pudo enviar el resumen (" + (r.body.motivo || r.status) + ")." });
      return responder(200, { ok: true });
    }
    responder(400, { error: "Acción desconocida." });
  } catch (err) {
    context.log.error("Error en la prueba de notificaciones:", err.message);
    responder(500, { error: "No se pudo enviar la prueba." });
  }
};
