// importarEncuestasPendientes/index.js
// Function protegida (rol "admin"): pasa a SQL los envíos de la Encuesta que esperan en la cola (Table Storage). El admin la llama
// al abrir el panel Encuestas y desde el botón "Importar ahora" (tarjeta de pendientes). Una llamada procesa hasta ~25 envíos o
// ~30 s; si queda trabajo responde restantes > 0 y el front vuelve a llamarla. Esta SÍ despierta la base (getPool): es justo el
// momento en que Alfredo ya está usando el admin.
const { getPool } = require("../src/backoffice-db");
const { importarConSql } = require("../src/encuesta-cola");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    const pool = await getPool();
    const r = await importarConSql(pool, context);
    context.res = { status: 200, headers: JSON_HEADERS, body: r };
  } catch (err) {
    context.log.error("Error importando encuestas pendientes:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo conectar con la base: " + err.message } };
  }
};
