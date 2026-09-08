// Escapa comillas simples antes de interpolar un valor en un filtro OData de
// Table Storage (`PartitionKey eq '${valor}'`). Hoy ningún valor que llega aquí
// puede contener una comilla sin que la validación previa ya lo haya rechazado
// (whitelist de herramientas, o un getEntity exacto que ya confirmó el valor) —
// esto es defensa en profundidad, no un fix de un bug explotado.
function escaparComillasOData(valor) {
  return String(valor).replace(/'/g, "''");
}

module.exports = { escaparComillasOData };
