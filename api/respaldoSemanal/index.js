// respaldoSemanal/index.js
// Timer trigger (v3 clásico): corre cada lunes 00:00 hora de México (06:00 UTC,
// NCRONTAB "0 0 6 * * 1") y genera un respaldo automático de las 5 tablas de
// Table Storage que no tienen ningún otro mecanismo de backup.
const { generarRespaldo } = require("../src/backup-tables");

module.exports = async function (context, myTimer) {
  try {
    const { nombreBlob, conteos } = await generarRespaldo("auto");
    context.log(`Respaldo automático generado: ${nombreBlob}`, conteos);
  } catch (err) {
    context.log.error("Error generando el respaldo automático:", err.message);
  }
};
