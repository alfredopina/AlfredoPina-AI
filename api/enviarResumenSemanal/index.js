// enviarResumenSemanal/index.js
// Function pública protegida por secreto (header x-backup-secret), disparada por el cron de GitHub Actions
// "Notificaciones programadas" los lunes 7:00 (hora de Monterrey). Manda el resumen de la semana a los destinatarios de
// Configuración → Notificaciones. Toda la lógica vive en api/src/notificaciones-resumen-envio.js (la comparte el botón
// "Enviar resumen ahora" del admin).
//   ?forzar=1 → modo prueba (workflow "Enviar resumen semanal ahora"): sin importar interruptores ni el anti-duplicado,
//   solo a NOTIFICACIONES_DESTINO, y sin mover el punto de comparación del resumen real.
// Si la base no despierta en ~35 s responde 503 {despertando:true} y el workflow vuelve a llamar cada 2 min.
const { autorizado } = require("../src/cron-secreto");
const { enviarResumen } = require("../src/notificaciones-resumen-envio");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  if (!autorizado(req)) {
    context.res = { status: 401, headers: JSON_HEADERS, body: { error: "No autorizado." } };
    return;
  }
  const manual = String((req.query && req.query.forzar) || "") === "1";
  const r = await enviarResumen({ context, manual });
  context.res = { status: r.status, headers: JSON_HEADERS, body: r.body };
};
