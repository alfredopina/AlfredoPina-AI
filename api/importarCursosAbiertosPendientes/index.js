// importarCursosAbiertosPendientes/index.js
// Function protegida (rol "admin"): pasa a SQL las inscripciones y los «avísame» de Cursos Abiertos que esperan en las colas (Table Storage).
// El admin la llama al abrir «Abiertos» y con el botón «Importar ahora». Una llamada procesa hasta ~25 envíos por cola o ~30 s; si queda trabajo
// responde restantes > 0 y el front vuelve a llamarla. Esta SÍ despierta la base (getPool): es justo cuando Alfredo ya está usando el admin.
// Ver api/src/cursos-abiertos-import.js.
const { getPool } = require("../src/backoffice-db");
const { importarConSql } = require("../src/cursos-abiertos-import");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    const pool = await getPool();
    const r = await importarConSql(pool, context);
    context.res = { status: 200, headers: JSON_HEADERS, body: r };
  } catch (err) {
    context.log.error("Error importando Cursos Abiertos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo conectar con la base: " + err.message } };
  }
};
