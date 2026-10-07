// verificarCodigoCliente/index.js
// Function protegida (rol "admin"): ayuda en vivo del formulario de Solicitudes para dar de alta un Prospecto.
// Dice si un código ya existe (el formulario no deja guardarlo) y avisa de clientes con un nombre parecido
// (solo aviso, no bloquea). ?codigo=ACM&nombre=Acme&excluirId=12 (excluirId = el propio Prospecto que se edita).
const { getPool, sql } = require("../src/backoffice-db");
const { limpiarCodigo } = require("../src/cliente-resolver");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const codigo = limpiarCodigo(req.query.codigo);
  const nombre = String(req.query.nombre || "").trim().toLowerCase().slice(0, 100);
  const excluirId = req.query.excluirId ? Number(req.query.excluirId) : null;

  try {
    const pool = await getPool();
    let existe = null;
    if (codigo) {
      const r = await pool
        .request()
        .input("codigo", sql.NVarChar, codigo)
        .input("excluir", sql.Int, excluirId)
        .query("SELECT TOP 1 id, nombre, tipo_cliente FROM Cliente WHERE UPPER(codigo) = @codigo AND (@excluir IS NULL OR id <> @excluir)");
      existe = r.recordset[0] || null;
    }

    let similares = [];
    if (nombre.length >= 3) {
      // el nombre se escapa para LIKE (%, _ y [ no deben actuar como comodín)
      const escapado = nombre.replace(/[\[%_]/g, "[$&]");
      const r = await pool
        .request()
        .input("n", sql.NVarChar, nombre)
        .input("nLike", sql.NVarChar, "%" + escapado + "%")
        .input("excluir", sql.Int, excluirId)
        .query(
          `SELECT TOP 5 id, nombre, codigo, tipo_cliente FROM Cliente
            WHERE (@excluir IS NULL OR id <> @excluir)
              AND (LOWER(nombre) = @n OR LOWER(nombre) LIKE @nLike OR (LEN(nombre) >= 4 AND @n LIKE '%' + LOWER(nombre) + '%'))
            ORDER BY nombre`
        );
      similares = r.recordset;
    }

    context.res = { status: 200, headers: JSON_HEADERS, body: { codigo, existe, similares } };
  } catch (err) {
    context.log.error("Error verificando el código:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo verificar el código." } };
  }
};
