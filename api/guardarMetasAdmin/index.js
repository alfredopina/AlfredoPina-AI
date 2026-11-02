// guardarMetasAdmin/index.js
// Function protegida (rol "admin", cerrada por el comodín /api/*): { cot, gan, cob } = metas mensuales de dinero SIN IVA para el
// Dashboard → Resumen. Un campo vacío quita esa meta (la fila vuelve al promedio de 12 meses). Regresa lo guardado. Ver api/src/metas.js.
const { guardarMetas } = require("../src/metas");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const b = req.body || {};
  try {
    context.res = { status: 200, headers: JSON_HEADERS, body: await guardarMetas({ cot: b.cot, gan: b.gan, cob: b.cob }) };
  } catch (err) {
    const validacion = /metas|meta /.test(err.message);
    if (!validacion) context.log.error("Error guardando las metas:", err.message);
    context.res = { status: validacion ? 400 : 500, headers: JSON_HEADERS, body: { error: validacion ? err.message : "No se pudo guardar." } };
  }
};
