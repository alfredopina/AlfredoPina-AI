// api/src/cliente-resolver.js
// Una sola versión de "dame el Cliente de esta empresa" (antes copiada en 6
// Functions: crearSolicitud, crearCotizacion, crearGrupo, editarGrupo,
// enviarDiagnostico y enviarRespuesta). Reglas de negocio en un solo lugar:
//   - Si llega clienteId, ese Cliente debe existir.
//   - Si no, la empresa se identifica por su código; si ya existe se reusa.
//   - Una empresa que NO existe nace como `tipoNuevo` (Prospecto por default;
//     crearGrupo/editarGrupo la crean Directo/Indirecto porque ya tiene Grupo).
//   - La Encuesta abierta NO crea empresas (resolverClienteExistente).
//
// `exec` puede ser el pool (pool.request()) o una función que devuelva un
// Request ligado a una transacción, p. ej. () => new sql.Request(transaction):
// así la empresa nueva se revierte junto con el resto si el guardado falla.
const { sql } = require("./backoffice-db");

function limpiarCodigo(codigo) {
  return (codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function nuevaRequestDe(exec) {
  return typeof exec === "function" ? exec : () => exec.request();
}

// opciones.crearError(mensaje): para Functions que distinguen errores "seguros"
// de mostrar al usuario (enviarDiagnostico); por default un Error normal.
async function resolverCliente(exec, empresa, tipoNuevo = "Prospecto", opciones = {}) {
  if (!empresa) return null;
  const nuevaRequest = nuevaRequestDe(exec);
  const crearError = opciones.crearError || ((m) => new Error(m));
  const clienteId = empresa.clienteId ? Number(empresa.clienteId) : null;

  if (clienteId) {
    const r = await nuevaRequest().input("id", sql.Int, clienteId).query("SELECT id, nombre, codigo FROM Cliente WHERE id = @id");
    if (!r.recordset.length) throw crearError("El cliente seleccionado ya no existe.");
    return r.recordset[0];
  }

  const nombre = (empresa.nombre || "").trim();
  const codigo = limpiarCodigo(empresa.codigo);
  if (!nombre || !codigo) throw crearError("Falta el nombre o el código de la empresa nueva.");

  const existente = await nuevaRequest().input("codigo", sql.NVarChar, codigo).query("SELECT id, nombre, codigo FROM Cliente WHERE codigo = @codigo");
  if (existente.recordset.length) return existente.recordset[0];

  const insert = await nuevaRequest()
    .input("nombre", sql.NVarChar, nombre)
    .input("codigo", sql.NVarChar, codigo)
    .input("tipo", sql.NVarChar, tipoNuevo)
    .query("INSERT INTO Cliente (nombre, codigo, tipo_cliente) OUTPUT INSERTED.id, INSERTED.nombre, INSERTED.codigo VALUES (@nombre, @codigo, @tipo)");
  return insert.recordset[0];
}

// Encuesta abierta (sin link de Grupo): solo acepta un Cliente que ya existe y
// que no sea Prospecto. Nunca crea empresas.
async function resolverClienteExistente(exec, empresa, crearError = (m) => new Error(m)) {
  const clienteId = empresa && empresa.clienteId ? Number(empresa.clienteId) : null;
  if (!clienteId) throw crearError("Selecciona tu empresa de la lista — si no aparece, pídele el link o el QR a tu instructor.");

  const r = await nuevaRequestDe(exec)()
    .input("id", sql.Int, clienteId)
    .query("SELECT id, nombre, codigo FROM Cliente WHERE id = @id AND tipo_cliente <> 'Prospecto'");
  if (!r.recordset.length) throw crearError("El cliente seleccionado ya no existe.");
  return r.recordset[0];
}

module.exports = { resolverCliente, resolverClienteExistente, limpiarCodigo };
