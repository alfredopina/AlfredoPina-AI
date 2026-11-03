// editarGrupoAbierto/index.js
// Function protegida (rol "admin"): edita un GRUPO ABIERTO (los mismos campos que crearGrupoAbierto) y reemplaza sus sesiones. Reglas:
//   · solo toca grupos con estrategia 'abiertos' (un grupo In Company se edita con editarGrupo).
//   · el cupo no puede bajar de las personas ya inscritas (apartadas + confirmadas).
//   · un grupo cancelado no se reabre (se crea otro): cancelar es definitivo para el sitio.
//   · nunca se borra nada: cancelar = publicacion 'cancelado'. Cambios que ya vieron los visitantes salen al sitio con «Publicar calendario».
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const ga = require("../src/grupo-abierto");

const res = (context, status, body) => { context.res = { status, headers: JSON_HEADERS, body }; };

module.exports = async function (context, req) {
  const id = Number((req.body || {}).id);
  if (!Number.isInteger(id) || id < 1) return res(context, 400, { error: "Falta el grupo." });
  let d;
  try { d = ga.validarGrupoAbierto(req.body); } catch (err) { return res(context, 400, { error: err.message }); }

  try {
    const pool = await getPool();
    const actual = await pool.request().input("id", sql.Int, id).query(
      `SELECT g.publicacion, (SELECT COUNT(*) FROM Inscripcion i WHERE i.grupo_id = g.id AND i.estado IN ('apartada', 'confirmada')) AS ocupados
       FROM Grupo g WHERE g.id = @id AND g.estrategia = 'abiertos'`
    );
    if (!actual.recordset.length) return res(context, 404, { error: "Ese grupo abierto ya no existe." });
    const { publicacion, ocupados } = actual.recordset[0];
    if (publicacion === "cancelado" && d.publicacion !== "cancelado") return res(context, 409, { error: "Un grupo cancelado no se reabre: crea uno nuevo." });
    if (d.cupo < ocupados) return res(context, 409, { error: "El cupo no puede ser menor a las " + ocupados + " personas ya inscritas." });

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const r = await ga.ligarParametros(new sql.Request(transaction).input("id", sql.Int, id), d).query(ga.UPDATE_GRUPO);
      if (!r.rowsAffected || !r.rowsAffected[0]) throw Object.assign(new Error("Ese grupo abierto ya no existe."), { safe: true });
      await ga.guardarSesiones(transaction, id, d.sesiones);
      await transaction.commit();
      return res(context, 200, { id, codigo: d.codigo, publicacion: d.publicacion });
    } catch (err) {
      try { await transaction.rollback(); } catch (rb) { context.log.error("Error haciendo rollback:", rb.message); }
      throw err;
    }
  } catch (err) {
    if (err.safe) return res(context, 400, { error: err.message });
    if (err.number === 2601 || err.number === 2627) return res(context, 409, { error: "Ya existe un grupo abierto con ese código." });
    context.log.error("Error editando el grupo abierto:", err.message);
    return res(context, 500, { error: "No se pudo guardar el grupo abierto." });
  }
};
