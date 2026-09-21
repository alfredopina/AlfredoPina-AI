// api/src/alumnos.js
// Única fuente de verdad para "dar de alta o reutilizar un Alumno". Un Alumno
// se identifica por nombre completo + cliente (el mismo nombre en clientes
// distintos son personas distintas). La comparación ignora acentos y
// mayúsculas ("José" = "jose") para no duplicar alumnos por cómo lo teclearon
// en el Excel — el COLLATE va explícito para no depender de la colación con
// la que se creó la columna. Acepta un Request de pool o de transacción.
// El correo es opcional: si llega uno, se guarda o actualiza en el Alumno (es
// de la persona, no del grupo); si no llega, nunca borra el que ya tenía.
const { sql } = require("./backoffice-db");

async function resolverAlumno(nuevoRequest, clienteId, nombreCompleto, correo) {
  const existente = await nuevoRequest()
    .input("clienteId", sql.Int, clienteId)
    .input("nombre", sql.NVarChar, nombreCompleto)
    .query("SELECT id, correo FROM Alumno WHERE cliente_id = @clienteId AND nombre_completo = @nombre COLLATE Latin1_General_CI_AI");

  if (existente.recordset.length) {
    const { id, correo: correoActual } = existente.recordset[0];
    if (correo && correo !== correoActual) {
      await nuevoRequest().input("id", sql.Int, id).input("correo", sql.NVarChar, correo).query("UPDATE Alumno SET correo = @correo WHERE id = @id");
    }
    return id;
  }

  const insert = await nuevoRequest()
    .input("clienteId", sql.Int, clienteId)
    .input("nombre", sql.NVarChar, nombreCompleto)
    .input("correo", sql.NVarChar, correo || null)
    .query("INSERT INTO Alumno (nombre_completo, cliente_id, correo) OUTPUT INSERTED.id VALUES (@nombre, @clienteId, @correo)");
  return insert.recordset[0].id;
}

module.exports = { resolverAlumno };
