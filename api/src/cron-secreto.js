// api/src/cron-secreto.js
// Las Functions que dispara un cron de GitHub Actions (no hay sesión de admin) se protegen con el MISMO secreto compartido
// que el respaldo semanal: header x-backup-secret contra la Application Setting BACKUP_CRON_SECRET (ya existe en Azure y
// en GitHub). Nunca hardcodeado, nunca en el repo.
function autorizado(req) {
  const esperado = process.env.BACKUP_CRON_SECRET;
  const recibido = req && req.headers && req.headers["x-backup-secret"];
  return Boolean(esperado) && recibido === esperado;
}

module.exports = { autorizado };
