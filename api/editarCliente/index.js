// editarCliente/index.js
// Function protegida (rol "admin"): edita nombre/código/notas de un Cliente
// existente. No se borran clientes — ver CLAUDE.md.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

function limpiarCodigo(codigo) {
  return (codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// undefined = valor inválido (el caller debe rechazar la petición), null = no capturado.
function anioONull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  const anioActual = new Date().getFullYear();
  if (!Number.isInteger(n) || n < 1990 || n > anioActual) return undefined;
  return n;
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = Number(body.id);
  const nombre = (body.nombre || "").trim();
  const codigo = limpiarCodigo(body.codigo);
  const notas = (body.notas || "").trim() || null;
  const clienteDesde = anioONull(body.cliente_desde);

  if (!id || !nombre || !codigo) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id, nombre o código del cliente." } };
    return;
  }
  if (clienteDesde === undefined) {
    context.res = {
      status: 400,
      headers: JSON_HEADERS,
      body: { error: `"Cliente desde" debe ser un año entre 1990 y ${new Date().getFullYear()}.` },
    };
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("nombre", sql.NVarChar, nombre)
      .input("codigo", sql.NVarChar, codigo)
      .input("notas", sql.NVarChar, notas)
      .input("clienteDesde", sql.Int, clienteDesde)
      .query("UPDATE Cliente SET nombre=@nombre, codigo=@codigo, notas=@notas, cliente_desde=@clienteDesde WHERE id=@id");
    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese cliente ya no existe." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    const codigoDuplicado = err.number === 2627 || err.number === 2601;
    context.log.error("Error editando el cliente:", err.message);
    context.res = {
      status: codigoDuplicado ? 409 : 500,
      headers: JSON_HEADERS,
      body: { error: codigoDuplicado ? "Ya existe un cliente con ese código." : "No se pudo guardar el cliente." },
    };
  }
};
