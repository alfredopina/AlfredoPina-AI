// Contador en vivo de Diagnósticos en Table Storage (tabla "DiagnosticoContador"),
// mismo patrón que Encuestas (encuesta-links.js): el admin lo consulta cada
// 10 s y NO debe despertar/mantener despierta la base SQL serverless (causa
// raíz del incidente de vCore-seconds de 2026-09-17). enviarDiagnostico ya toca
// SQL en ese momento, así que ahí mismo suma 1 acá; eliminarRespuestaDiagnostico
// resta 1.
//
// Una sola entidad: "contador" / "global" → total, excel, powerbi, sembrado.
// `sembrado` = true solo cuando los números salieron de un COUNT real de SQL.
// Sin ese candado, si el primer envío después del deploy creara la entidad con
// {total:1}, el contador diría 1 en vez de los N históricos y nadie lo
// notaría. Mientras no esté sembrado, la lectura la calcula desde SQL (una
// sola vez, o cuando Alfredo pulse "Recalcular desde SQL" por si se desfasó).
const { TableClient } = require("@azure/data-tables");
const { ensureTable, isTableNotFound, HERRAMIENTAS } = require("./diagnostico-tables");
const { actualizarConReintento } = require("./table-contador");

function getDiagnosticoContadorTable() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return TableClient.fromConnectionString(conn, "DiagnosticoContador");
}

// delta = +1 al enviar un diagnóstico, -1 al borrarlo. Nunca baja de 0.
async function ajustarContadorDiagnostico(table, herramienta, delta) {
  if (!HERRAMIENTAS.includes(herramienta)) return;
  await ensureTable(table);
  const suma = (e, campo) => Math.max(0, (e[campo] || 0) + (campo === herramienta || campo === "total" ? delta : 0));
  await actualizarConReintento(
    table, "contador", "global",
    (e) => ({ total: suma(e, "total"), excel: suma(e, "excel"), powerbi: suma(e, "powerbi") }),
    () => ({ total: Math.max(0, delta), excel: herramienta === "excel" ? Math.max(0, delta) : 0, powerbi: herramienta === "powerbi" ? Math.max(0, delta) : 0, sembrado: false })
  );
}

// null si no hay contador o todavía no se sembró desde SQL.
async function leerContadorDiagnostico(table) {
  try {
    const e = await table.getEntity("contador", "global");
    if (!e.sembrado) return null;
    return { total: e.total || 0, excel: e.excel || 0, powerbi: e.powerbi || 0 };
  } catch (err) {
    if (err.statusCode === 404 || isTableNotFound(err)) return null;
    throw err;
  }
}

// Reemplaza el contador con el conteo real de SQL (`conteo` = {total,excel,powerbi}).
async function sembrarContadorDiagnostico(table, conteo) {
  await ensureTable(table);
  await table.upsertEntity(
    { partitionKey: "contador", rowKey: "global", total: conteo.total, excel: conteo.excel, powerbi: conteo.powerbi, sembrado: true },
    "Replace"
  );
}

module.exports = { getDiagnosticoContadorTable, ajustarContadorDiagnostico, leerContadorDiagnostico, sembrarContadorDiagnostico };
