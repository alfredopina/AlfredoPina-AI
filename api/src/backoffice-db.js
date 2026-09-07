// Cliente compartido de Azure SQL para el bloque nuevo del backoffice. Diplomas
// es el primer módulo que lo usa; Cotizaciones/Grupos/Alumnos (Fase 1/2) van a
// EXTENDER estas mismas tablas, no crear otras — por eso el nombre genérico de
// la Application Setting (BACKOFFICE_SQL_CONNECTION, no "DIPLOMAS_...").
//
// La cadena de conexión se parsea a mano (formato simple "clave=valor;...",
// ver sql/001_backoffice_diplomas.sql y CLAUDE.md) en vez de dejársela al
// parser de cadenas de `mssql` — así no dependemos de qué alias de claves
// soporte esa versión del paquete.
const sql = require("mssql");

let poolPromise = null;

function parseConnectionString(str) {
  const partes = {};
  str.split(";").forEach((par) => {
    const idx = par.indexOf("=");
    if (idx === -1) return;
    const clave = par.slice(0, idx).trim().toLowerCase();
    const valor = par.slice(idx + 1).trim();
    if (clave) partes[clave] = valor;
  });
  return partes;
}

function getConfig() {
  const conn = process.env.BACKOFFICE_SQL_CONNECTION;
  if (!conn) throw new Error("BACKOFFICE_SQL_CONNECTION no está configurada.");

  const partes = parseConnectionString(conn);
  const server = partes["server"];
  const database = partes["database"];
  const user = partes["user id"] || partes["uid"];
  const password = partes["password"] || partes["pwd"];

  if (!server || !database || !user || !password) {
    throw new Error(
      "BACKOFFICE_SQL_CONNECTION tiene un formato inválido (se espera Server=...;Database=...;User Id=...;Password=...)."
    );
  }

  return {
    server,
    database,
    user,
    password,
    options: { encrypt: true, trustServerCertificate: false },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    // La base es serverless (tier gratis) y se auto-pausa tras 1h sin uso —
    // la primera conexión después de una pausa "despierta" la base, lo cual
    // puede tardar más que el default de 15s de la librería. 60s le da
    // margen sin dejar la Function esperando indefinidamente.
    connectionTimeout: 60000,
    requestTimeout: 60000,
  };
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(getConfig()).catch((err) => {
      poolPromise = null; // si falla la conexión, permite reintentar en la siguiente llamada
      throw err;
    });
  }
  return poolPromise;
}

module.exports = { getPool, sql };
