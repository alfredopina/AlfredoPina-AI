// crearGrupoAbierto/index.js
// Function protegida (rol "admin"): alta de un GRUPO ABIERTO (Cursos Abiertos), desde Grupos → Nuevo Grupo con el interruptor «¿Curso abierto?».
// Es un Grupo con estrategia 'abiertos' y el Cliente reservado ABIERTOS. A diferencia de crearGrupo NO crea cuenta por cobrar (cada inscripción tendrá
// la suya) ni resuelve Cliente/Contacto/Cotización. Grupo + sesiones + historial de fase van en UNA transacción: o quedan todos o ninguno.
// Nace como borrador salvo que se pida «publicado»; publicar al sitio es otro paso (publicarCalendarioAbiertos). Ver api/src/grupo-abierto.js.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const { sembrarHistorialInicial } = require("../src/grupo-fase");
const ga = require("../src/grupo-abierto");

const res = (context, status, body) => { context.res = { status, headers: JSON_HEADERS, body }; };

module.exports = async function (context, req) {
  let d;
  try { d = ga.validarGrupoAbierto(req.body); } catch (err) { return res(context, 400, { error: err.message }); }

  try {
    const pool = await getPool();
    const clienteId = await ga.idClienteAbiertos(() => pool.request());
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const insert = await ga.ligarParametros(new sql.Request(transaction).input("clienteId", sql.Int, clienteId), d).query(ga.INSERT_GRUPO);
      const id = insert.recordset[0].id;
      await ga.guardarSesiones(transaction, id, d.sesiones);
      const inicio = d.sesiones.length ? ga.diaLocal(d.sesiones[0].inicio) : null;
      await sembrarHistorialInicial(transaction, id, { estatusCurso: "Por iniciar", estatusCierre: null, fechaInicio: inicio, fechaFin: null, fechaCierre: null });
      await transaction.commit();
      return res(context, 200, { id, codigo: d.codigo, publicacion: d.publicacion });
    } catch (err) {
      try { await transaction.rollback(); } catch (rb) { context.log.error("Error haciendo rollback:", rb.message); }
      throw err;
    }
  } catch (err) {
    if (err.safe) return res(context, 400, { error: err.message });
    if (err.number === 2601 || err.number === 2627) return res(context, 409, { error: "Ya existe un grupo abierto con ese código." });
    context.log.error("Error creando el grupo abierto:", err.message);
    return res(context, 500, { error: "No se pudo crear el grupo abierto." });
  }
};
