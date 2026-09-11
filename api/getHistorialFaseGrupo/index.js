// getHistorialFaseGrupo/index.js
// Function protegida (rol "admin"): historial completo de fase de un Grupo
// (?grupoId=), ordenado por fecha — lo que alimenta la variante "expandido
// con fechas" del stepper (window.FaseStepper) en la fila expandible de
// Consultar Grupos. Carga perezosa a propósito, solo al expandir una fila
// (mismo criterio que listContactosAdmin/getRecursosAdmin) — no tiene caso
// mandarlo dentro de listGruposAdmin para cada fila de la tabla.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const grupoId = Number(req.query.grupoId);
  if (!grupoId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el grupo." } };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("grupoId", sql.Int, grupoId)
      .query("SELECT fase, fecha FROM GrupoFaseHistorial WHERE grupo_id = @grupoId ORDER BY fecha ASC");
    context.res = { status: 200, headers: JSON_HEADERS, body: result.recordset };
  } catch (err) {
    context.log.error("Error obteniendo el historial de fase:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar el historial." } };
  }
};
