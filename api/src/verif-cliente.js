// api/src/verif-cliente.js
// Quién NO debe contar como una verificación real de un diploma: el propio
// admin (Alfredo/Viridiana probando, con sesión de /admin — Azure SWA manda la
// sesión en el header x-ms-client-principal) y los robots de vista previa de
// links (WhatsApp, LinkedIn, Slack…). Así los números del panel son de gente
// de verdad: alumnos, RH y reclutadores.
function esAdmin(req) {
  try {
    const h = req.headers && req.headers["x-ms-client-principal"];
    if (!h) return false;
    const p = JSON.parse(Buffer.from(String(h), "base64").toString("utf8"));
    return Array.isArray(p.userRoles) && p.userRoles.includes("admin");
  } catch (e) {
    return false;
  }
}

const BOT_RE = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slack|telegram|linkedinbot|embedly|headless/i;
function esBot(req) {
  return BOT_RE.test(String((req.headers && req.headers["user-agent"]) || ""));
}

module.exports = { esAdmin, esBot };
