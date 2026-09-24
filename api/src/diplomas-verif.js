// api/src/diplomas-verif.js
// Registro público de verificación de diplomas — Table Storage, tabla
// "DiplomasVerif" (misma razón que el resto de snapshots: la página pública
// /verificar nunca toca SQL, así funciona aunque apcweb-backoffice esté
// dormida). Dos tipos de fila:
//   d / {codigo}  → los datos del diploma (JSON en `datos`) + contador `vistas`
//   f / {folio}   → apunta al código, para buscar tecleando el folio
// El QR del diploma lleva el CÓDIGO (8 caracteres, no adivinable); el folio es
// consecutivo, por eso una búsqueda por folio muestra el nombre abreviado y
// tiene candado de intentos (ver verificarDiploma).
// Se escribe con "Merge" para no borrar el contador de vistas al refrescar.
const { TableClient } = require("@azure/data-tables");
const { actualizarConReintento } = require("./table-contador");

function getConexion() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}
const getDiplomasVerifTable = () => TableClient.fromConnectionString(getConexion(), "DiplomasVerif");
const getVerifLimiteTable = () => TableClient.fromConnectionString(getConexion(), "DiplomasVerifLimite");

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

async function enLotes(items, tamano, fn) {
  for (let i = 0; i < items.length; i += tamano) await Promise.all(items.slice(i, i + tamano).map(fn));
}

// registros: [{ folio, codigo, datos }]
async function guardarRegistros(table, registros) {
  if (!registros.length) return;
  await ensureTable(table);
  await enLotes(registros, 8, async (r) => {
    await table.upsertEntity({ partitionKey: "d", rowKey: r.codigo, folio: r.folio, estatus: r.datos.estatus, datos: JSON.stringify(r.datos) }, "Merge");
    await table.upsertEntity({ partitionKey: "f", rowKey: r.folio, codigo: r.codigo }, "Replace");
  });
}

async function eliminarRegistros(table, registros) {
  await enLotes(registros, 8, async (r) => {
    for (const [pk, rk] of [["d", r.codigo], ["f", r.folio]]) {
      if (!rk) continue;
      try {
        await table.deleteEntity(pk, rk);
      } catch (err) {
        if (err.statusCode !== 404 && !isTableNotFound(err)) throw err;
      }
    }
  });
}

async function leerPorCodigo(table, codigo) {
  try {
    const e = await table.getEntity("d", codigo);
    return { datos: JSON.parse(e.datos), vistas: e.vistas || 0 };
  } catch (err) {
    if (err.statusCode === 404 || isTableNotFound(err)) return null;
    throw err;
  }
}

async function leerPorFolio(table, folio) {
  try {
    const f = await table.getEntity("f", folio);
    return await leerPorCodigo(table, f.codigo);
  } catch (err) {
    if (err.statusCode === 404 || isTableNotFound(err)) return null;
    throw err;
  }
}

async function registrarVista(table, codigo) {
  await actualizarConReintento(table, "d", codigo, (e) => ({ vistas: (e.vistas || 0) + 1 }), () => ({ vistas: 1 }));
}

// "Ana María Pérez García" → "Ana María P. G." (con 2 palabras o menos se deja igual)
function abreviarNombre(nombre) {
  const p = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  if (p.length <= 2) return p.join(" ");
  const apellidos = p.slice(-2).map((a) => a[0].toUpperCase() + ".");
  return [...p.slice(0, -2), ...apellidos].join(" ");
}

module.exports = { getDiplomasVerifTable, getVerifLimiteTable, ensureTable, guardarRegistros, eliminarRegistros, leerPorCodigo, leerPorFolio, registrarVista, abreviarNombre };
