// Número de WhatsApp (wa.me) a partir de lo que Alfredo escribe a mano ("81 1234 5678", "+52 (81) 1234-5678", "5218112345678"…).
// wa.me quiere solo dígitos con lada de país y sin "+": 10 dígitos = México (se antepone 52); el formato viejo 521 + 10 dígitos
// se lleva a 52 + 10; otro número con lada de país (11 a 15 dígitos) se respeta tal cual.
// Regresa { vacio: true } | { valido: true, wa, texto } | { valido: false }.
function parseTelefonoWa(raw) {
  const texto = String(raw == null ? "" : raw).trim().slice(0, 30);
  if (!texto) return { vacio: true };
  const d = texto.replace(/\D/g, "");
  if (d.length === 10) return { valido: true, wa: "52" + d, texto };
  if (d.length === 13 && d.startsWith("521")) return { valido: true, wa: "52" + d.slice(3), texto };
  if (d.length >= 11 && d.length <= 15) return { valido: true, wa: d, texto };
  return { valido: false };
}

module.exports = { parseTelefonoWa };
