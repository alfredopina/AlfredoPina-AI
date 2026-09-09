// crearCliente/index.js
// Function protegida (rol "admin"): alta de un Cliente nuevo. La edición vive
// aparte en editarCliente — a diferencia de crearPregunta (que hace upsert),
// aquí Alfredo siempre sabe si está dando de alta o editando (la tabla del
// panel Clientes no tiene un botón "Nuevo Cliente" que también sirva de editor).
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");

function limpiarCodigo(codigo) {
  return (codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const nombre = (body.nombre || "").trim();
  const codigo = limpiarCodigo(body.codigo);
  const notas = (body.notas || "").trim() || null;

  if (!nombre || !codigo) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el nombre o el código del cliente." } };
    return;
  }

  try {
    const pool = await getPool();
    const insert = await pool
      .request()
      .input("nombre", sql.NVarChar, nombre)
      .input("codigo", sql.NVarChar, codigo)
      .input("notas", sql.NVarChar, notas)
      .query("INSERT INTO Cliente (nombre, codigo, notas) OUTPUT INSERTED.id VALUES (@nombre, @codigo, @notas)");
    context.res = { status: 200, headers: JSON_HEADERS, body: { id: insert.recordset[0].id } };
  } catch (err) {
    // 2627/2601 = violación de UNIQUE en SQL Server — ya existe un cliente con ese código.
    const codigoDuplicado = err.number === 2627 || err.number === 2601;
    context.log.error("Error creando el cliente:", err.message);
    context.res = {
      status: codigoDuplicado ? 409 : 500,
      headers: JSON_HEADERS,
      body: { error: codigoDuplicado ? "Ya existe un cliente con ese código." : "No se pudo crear el cliente." },
    };
  }
};
