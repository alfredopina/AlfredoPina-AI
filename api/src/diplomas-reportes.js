// api/src/diplomas-reportes.js
// Snapshot público de los diplomas de UN grupo — Table Storage (tabla
// "DiplomasGrupo"), mismo patrón que calificaciones-reportes.js: la página
// pública nunca toca SQL, así no depende de que apcweb-backoffice esté
// despierta. Diferencia clave con los Reportes de Calificaciones: ahí cada
// clic en "Generar" crea un token nuevo (snapshot inmutable). Aquí el link es
// UNO SOLO por grupo, reusado siempre — el token vive en Grupo.diploma_token
// (SQL) y este snapshot se vuelve a escribir (Replace) cada vez que se
// generan diplomas nuevos de ese grupo o se anula uno, para que el mismo link
// ya compartido con el cliente siempre refleje el estado vigente.
const { TableClient } = require("@azure/data-tables");
const { actualizarConReintento } = require("./table-contador");

const TROZO = 30000;
const MAX_TROZOS = 30;

function getConexion() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}
function getDiplomasGrupoTable() {
  return TableClient.fromConnectionString(getConexion(), "DiplomasGrupo");
}

async function ensureTable(table) {
  try {
    await table.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err;
  }
  return table;
}
function isTableNotFound(err) {
  if (!err || err.statusCode !== 404) return false;
  return /TableNotFound/i.test(err.code || "") || /table.*not.*found/i.test(err.message || "");
}

function partirEnTrozos(texto) {
  const partes = {};
  const n = Math.ceil(texto.length / TROZO) || 1;
  if (n > MAX_TROZOS) throw new Error("El grupo tiene demasiados alumnos para publicarse de una vez.");
  for (let i = 0; i < n; i++) partes["snap" + i] = texto.slice(i * TROZO, (i + 1) * TROZO);
  return { partes, n };
}
function unirTrozos(entidad) {
  let texto = "";
  for (let i = 0; i < (entidad.snapPartes || 0); i++) texto += entidad["snap" + i] || "";
  return texto;
}

// snapshot: { grupoId, actualizadoEn, cliente, clienteFinal, curso, herramientas,
//             instructor, modalidad, fechaInicio, fechaFin, horas, alumnos:[...] }
async function guardarDiplomasGrupo(table, { token, snapshot }) {
  await ensureTable(table);
  const { partes, n } = partirEnTrozos(JSON.stringify(snapshot));
  await table.upsertEntity(
    { partitionKey: "diplomas", rowKey: token, grupoId: snapshot.grupoId, actualizadoEn: snapshot.actualizadoEn, snapPartes: n, ...partes },
    "Replace"
  );
}

async function leerDiplomasGrupo(table, token) {
  try {
    const e = await table.getEntity("diplomas", token);
    return JSON.parse(unirTrozos(e));
  } catch (err) {
    if (err.statusCode === 404 || isTableNotFound(err)) return null;
    throw err;
  }
}

// contador de vistas del link público — mismo patrón que Reportes/Diagnóstico/
// Encuestas (lectura-modificación-escritura con ETag y reintento)
async function registrarVistaDiplomasGrupo(table, token) {
  await actualizarConReintento(
    table,
    "diplomas",
    token,
    (entidad) => ({ vistas: (entidad.vistas || 0) + 1 }),
    () => ({ vistas: 1 })
  );
}

module.exports = { getDiplomasGrupoTable, guardarDiplomasGrupo, leerDiplomasGrupo, registrarVistaDiplomasGrupo };
