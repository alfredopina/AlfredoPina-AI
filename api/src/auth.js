// Lee la identidad real del usuario desde el header que Azure Static Web Apps
// inyecta automáticamente en cada request a una ruta protegida por
// staticwebapp.config.json (x-ms-client-principal, JSON en base64). Se usa
// para Actividad — nunca confiar en un correo que mande el propio cliente
// (alguien podría mandar cualquier valor), esto es lo que Azure ya verificó.
function getUserFromRequest(req) {
  const header = req.headers && (req.headers["x-ms-client-principal"] || req.headers["X-MS-CLIENT-PRINCIPAL"]);
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, "base64").toString("utf8");
    const principal = JSON.parse(decoded);
    if (!principal || !principal.userDetails) return null;
    return { correo: principal.userDetails, roles: principal.userRoles || [] };
  } catch (err) {
    return null;
  }
}

module.exports = { getUserFromRequest };
