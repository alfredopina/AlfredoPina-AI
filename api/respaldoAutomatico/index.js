// respaldoAutomatico/index.js
// Function pública (authLevel "anonymous", SIN entrada en staticwebapp.config.json
// a propósito): el respaldo semanal automático de Table Storage no puede usar un
// timerTrigger — las Functions "administradas" de Static Web Apps (tier Free)
// solo soportan httpTrigger; un timerTrigger hace que Oryx rechace el build
// completo del deploy (ver CLAUDE.md, "Ya resueltos"). En su lugar, un workflow
// de GitHub Actions con cron dispara esta Function por HTTP cada lunes.
//
// Como queda alcanzable sin rol admin (no puede exigir login interactivo, la
// dispara un workflow), la protección es un secreto compartido en el header
// x-backup-secret contra la Application Setting BACKUP_CRON_SECRET — nunca
// hardcodeado, nunca en el repo.
const { generarRespaldo } = require("../src/backup-tables");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const secretoEsperado = process.env.BACKUP_CRON_SECRET;
  const secretoRecibido = req.headers && req.headers["x-backup-secret"];

  if (!secretoEsperado || secretoRecibido !== secretoEsperado) {
    context.res = { status: 401, headers: JSON_HEADERS, body: { error: "No autorizado." } };
    return;
  }

  try {
    const { nombreBlob, conteos } = await generarRespaldo("auto");
    context.res = { status: 200, headers: JSON_HEADERS, body: { nombreBlob, conteos } };
  } catch (err) {
    context.log.error("Error generando el respaldo automático:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo generar el respaldo." } };
  }
};
