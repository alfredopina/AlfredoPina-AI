// api/src/dashboard-foto.js
// "Foto diaria" del Dashboard → Resumen: guarda, una vez por día, el estado de hoy de las tarjetas que no se pueden reconstruir por fechas
// (Pipeline, Grupos Activos/Directos, Completos, Contactos, Clientes Activos). Con ellas esas tarjetas van armando línea y comparación.
// Table Storage (tabla DashboardFotos, se crea sola), SOLO admin: la escribe getDashboardResumenAdmin al abrir el Resumen. NO es SQL y nada
// público la toca. Una por día (idempotente: la primera apertura del día fija la foto) y nunca lanza: si falla, el Resumen sigue.
const { TableClient } = require("@azure/data-tables");

const TABLA = "DashboardFotos";
const PK = "foto";

async function getTabla() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) return null;
  const tabla = TableClient.fromConnectionString(conn, TABLA);
  try { await tabla.createTable(); } catch (err) { if (err.statusCode !== 409) throw err; }
  return tabla;
}

// Guarda la foto de `fecha` ("YYYY-MM-DD", hora de Monterrey) si todavía no existe. Regresa true solo si la creó.
async function guardarFotoDelDia(fecha, datos, tabla) {
  try {
    const t = tabla || (await getTabla());
    if (!t) return false;
    await t.createEntity({ partitionKey: PK, rowKey: fecha, datos: JSON.stringify(datos), guardada: new Date().toISOString() });
    return true;
  } catch (err) {
    return false; // 409 = ya había una de hoy (lo normal); cualquier otro error tampoco debe romper el Resumen
  }
}

// Fotos desde `desdeFecha` ("YYYY-MM-DD") en adelante → [{ fecha, datos }]. Nunca lanza.
async function leerFotos(desdeFecha, tabla) {
  try {
    const t = tabla || (await getTabla());
    if (!t) return [];
    const salida = [];
    for await (const e of t.listEntities({ queryOptions: { filter: `PartitionKey eq '${PK}' and RowKey ge '${desdeFecha}'` } })) {
      try { salida.push({ fecha: e.rowKey, datos: JSON.parse(e.datos) }); } catch (_) { /* foto dañada: se ignora */ }
    }
    return salida;
  } catch (err) {
    return [];
  }
}

module.exports = { guardarFotoDelDia, leerFotos, TABLA };
