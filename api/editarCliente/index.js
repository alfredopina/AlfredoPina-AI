// editarCliente/index.js
// Function protegida (rol "admin"): edita nombre/código/notas de un Cliente
// existente. No se borran clientes — ver CLAUDE.md.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

function limpiarCodigo(codigo) {
  return (codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = Number(body.id);
  const nombre = (body.nombre || "").trim();
  const codigo = limpiarCodigo(body.codigo);
  const notas = (body.notas || "").trim() || null;

  if (!id || !nombre || !codigo) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id, nombre o código del cliente." } };
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
      .query("UPDATE Cliente SET nombre=@nombre, codigo=@codigo, notas=@notas WHERE id=@id");
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
