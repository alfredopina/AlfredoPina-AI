// Qué cuelga de un Cliente/Prospecto (si algo cuelga, no se puede borrar). Una sola lista, compartida por
// eliminarCliente (botón de Clientes) y por el guardado de Solicitudes (cuando un Prospecto queda vacío al
// pasar su solicitud a otro cliente). Los Contactos NO cuentan: son datos de ficha y se borran con el cliente.
const { sql } = require("./backoffice-db");

const DEPENDENCIAS = [
  { clave: "Solicitudes", sql: "SELECT COUNT(*) AS n FROM Solicitud WHERE cliente_id = @id" },
  { clave: "Cotizaciones", sql: "SELECT COUNT(*) AS n FROM Cotizacion WHERE cliente_id = @id" },
  { clave: "Grupos", sql: "SELECT COUNT(*) AS n FROM Grupo WHERE cliente_id = @id OR cliente_final_id = @id" },
  { clave: "Cobranza", sql: "SELECT COUNT(*) AS n FROM CuentaPorCobrar WHERE cliente_id = @id" },
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

// Para el aviso de "no se puede eliminar": QUÉ cuelga (hasta 5 por tipo) en vez de solo cuántos. Solo las 3 dependencias donde
// el número no basta para ubicarla (una cotización "Reemplazada" está oculta en el tablero; una solicitud o un grupo se buscan por su nombre).
const DETALLES = {
  Cotizaciones: { sql: "SELECT TOP 5 folio, estatus FROM Cotizacion WHERE cliente_id = @id ORDER BY fecha_creacion DESC", texto: (r) => `${r.folio} (${r.estatus})` },
  Solicitudes: { sql: "SELECT TOP 5 id, estatus FROM Solicitud WHERE cliente_id = @id ORDER BY fecha_creacion DESC", texto: (r) => `solicitud #${r.id} (${r.estatus})` },
  Grupos: { sql: "SELECT TOP 5 id, grupo_codigo, nombre_curso FROM Grupo WHERE cliente_id = @id OR cliente_final_id = @id ORDER BY id DESC", texto: (r) => r.grupo_codigo || r.nombre_curso || `grupo #${r.id}` },
};

// Regresa { Cotizaciones: ["AP26-…-01 (Reemplazada)"], … } solo de lo que bloquea. Nunca lanza: es un detalle de cortesía.
async function detallarBloqueos(nuevaRequest, clienteId, bloqueos) {
  const out = {};
  for (const b of bloqueos) {
    const d = DETALLES[b.clave];
    if (!d) continue;
    try {
      const r = await nuevaRequest().input("id", sql.Int, clienteId).query(d.sql);
      out[b.clave] = r.recordset.map(d.texto);
    } catch (e) {
      /* sin detalle: el aviso sigue diciendo cuántos */
    }
  }
  return out;
}

module.exports = { DEPENDENCIAS, contarBloqueos, detallarBloqueos };
