// Qué cuelga de un Cliente/Prospecto (si algo cuelga, no se puede borrar). Una sola lista, compartida por
// eliminarCliente (botón de Clientes) y por el guardado de Solicitudes (cuando un Prospecto queda vacío al
// pasar su solicitud a otro cliente). Los Contactos NO cuentan: son datos de ficha y se borran con el cliente.
const { sql } = require("./backoffice-db");

const DEPENDENCIAS = [
  { clave: "Solicitudes", sql: "SELECT COUNT(*) AS n FROM Solicitud WHERE cliente_id = @id" },
  { clave: "Cotizaciones", sql: "SELECT COUNT(*) AS n FROM Cotizacion WHERE cliente_id = @id" },
  { clave: "Grupos", sql: "SELECT COUNT(*) AS n FROM Grupo WHERE cliente_id = @id OR cliente_final_id = @id" },
  { clave: "Diplomas", sql: "SELECT COUNT(*) AS n FROM Diploma WHERE cliente_id = @id" },
  { clave: "Alumnos", sql: "SELECT COUNT(*) AS n FROM Alumno WHERE cliente_id = @id" },
  { clave: "Diagnósticos", sql: "SELECT COUNT(*) AS n FROM DiagnosticoRespuesta WHERE cliente_id = @id" },
  { clave: "Encuestas", sql: "SELECT COUNT(*) AS n FROM EncuestaRespuesta WHERE cliente_id = @id" },
];

// `nuevaRequest` = () => Request (del pool o de una transacción). Regresa [{clave, n}] solo de lo que SÍ cuelga.
async function contarBloqueos(nuevaRequest, clienteId) {
  // en secuencia a propósito: dentro de una transacción solo cabe una consulta a la vez
  const bloqueos = [];
  for (const d of DEPENDENCIAS) {
    const r = await nuevaRequest().input("id", sql.Int, clienteId).query(d.sql);
    if (r.recordset[0].n > 0) bloqueos.push({ clave: d.clave, n: r.recordset[0].n });
  }
  return bloqueos;
}

module.exports = { DEPENDENCIAS, contarBloqueos };
