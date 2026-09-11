// Tabla "AdminActividad" — registro de accesos al panel /admin, un renglón
// por correo. Reusa el Storage Account apcwebrecursos (misma Application
// Setting RECURSOS_STORAGE_CONNECTION que Cursos/Recursos/Diplomas). Se
// auto-crea sola la primera vez que se escribe, igual que IntentosCodigo —
// no requiere que Alfredo toque el portal.
const { TableClient } = require("@azure/data-tables");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

async function getActividadTable() {
  const table = TableClient.fromConnectionString(getConnectionString(), "AdminActividad");
  try {
    await table.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err; // 409 = la tabla ya existe
  }
  return table;
}

// "veces" se lee-incrementa-escribe (no hay un contador atómico nativo en
// Table Storage) — con solo 2-3 administradores entrando de vez en cuando el
// riesgo real de una carrera (2 tabs abriéndose exactamente al mismo
// milisegundo) es despreciable, no se justifica una transacción más compleja.
async function registrarAcceso(correo) {
  const table = await getActividadTable();
  let veces = 0;
  try {
    const existente = await table.getEntity("admin", correo);
    veces = existente.veces || 0;
  } catch (err) {
    if (err.statusCode !== 404) throw err;
  }
  const ahora = new Date().toISOString();
  await table.upsertEntity({ partitionKey: "admin", rowKey: correo, veces: veces + 1, ultimaVez: ahora }, "Merge");
}

async function listActividad() {
  const table = await getActividadTable();
  const items = [];
  for await (const entity of table.listEntities({ queryOptions: { filter: "PartitionKey eq 'admin'" } })) {
    items.push({ correo: entity.rowKey, veces: entity.veces || 0, ultimaVez: entity.ultimaVez || null });
  }
  return items;
}

module.exports = { registrarAcceso, listActividad };
