// api/src/alumnos.js
// Única fuente de verdad para "dar de alta o reutilizar un Alumno". Un Alumno
// se identifica por nombre completo + cliente (el mismo nombre en clientes
// distintos son personas distintas). La comparación ignora acentos y
// mayúsculas ("José" = "jose") para no duplicar alumnos por cómo lo teclearon
// en el Excel — el COLLATE va explícito para no depender de la colación con
// la que se creó la columna. Acepta un Request de pool o de transacción.
const { sql } = require("./backoffice-db");

async function resolverAlumno(nuevoRequest, clienteId, nombreCompleto) {
  const existente = await nuevoRequest()
    .input("clienteId", sql.Int, clienteId)
    .input("nombre", sql.NVarChar, nombreCompleto)
    .query("SELECT id FROM Alumno WHERE cliente_id = @clienteId AND nombre_completo = @nombre COLLATE Latin1_General_CI_AI");
  if (existente.recordset.length) return existente.recordset[0].id;

  const insert = await nuevoRequest()
    .input("clienteId", sql.Int, clienteId)
    .input("nombre", sql.NVarChar, nombreCompleto)
    .query("INSERT INTO Alumno (nombre_completo, cliente_id) OUTPUT INSERTED.id VALUES (@nombre, @clienteId)");
  return insert.recordset[0].id;
}

module.exports = { resolverAlumno };
