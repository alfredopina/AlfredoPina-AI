// api/src/cron-secreto.js
// Las Functions que dispara un cron de GitHub Actions (no hay sesión de admin) se protegen con el MISMO secreto compartido
// que el respaldo semanal: header x-backup-secret contra la Application Setting BACKUP_CRON_SECRET (ya existe en Azure y
// en GitHub). Nunca hardcodeado, nunca en el repo.
//
// La comparación es en TIEMPO CONSTANTE (crypto.timingSafeEqual sobre el SHA-256 de cada lado): `===` corta en el primer
// carácter distinto y el tiempo de respuesta filtraría cuántos aciertos lleva quien lo intenta (auditoría A01-007). Al comparar
// hashes, que siempre miden lo mismo, tampoco se revela la longitud del secreto.
const crypto = require("crypto");

const huella = (s) => crypto.createHash("sha256").update(String(s)).digest();

function autorizado(req) {
  const esperado = process.env.BACKUP_CRON_SECRET;
  const recibido = req && req.headers && req.headers["x-backup-secret"];
  if (!esperado || typeof recibido !== "string") return false;
  return crypto.timingSafeEqual(huella(esperado), huella(recibido));
}

module.exports = { autorizado };
