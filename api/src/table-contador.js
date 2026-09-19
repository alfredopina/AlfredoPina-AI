// Lectura-modificación-escritura con ETag y reintento, compartida por los
// contadores en vivo de Table Storage (Encuestas y Diagnóstico). 2 envíos casi
// simultáneos (todo un grupo escaneando el QR a la vez) no deben pisarse el
// conteo. `crear` arma la entidad inicial si todavía no existe.
// Tras cada conflicto se espera un tiempo aleatorio corto (jitter) — con todo
// un grupo enviando en el mismo segundo, reintentar de inmediato haría que
// choquen otra vez en cada ronda; el jitter los desfasa.
async function actualizarConReintento(table, pk, rk, mutar, crear) {
  for (let intento = 0; intento < 12; intento++) {
    if (intento > 0) await new Promise((r) => setTimeout(r, Math.random() * 40));
    let entidad;
    try {
      entidad = await table.getEntity(pk, rk);
    } catch (err) {
      if (err.statusCode !== 404) throw err;
      try {
        await table.createEntity({ partitionKey: pk, rowKey: rk, ...crear() });
        return;
      } catch (err2) {
        if (err2.statusCode === 409) continue; // alguien la creó justo antes — reintenta como actualización
        throw err2;
      }
    }
    try {
      await table.updateEntity({ partitionKey: pk, rowKey: rk, ...mutar(entidad) }, "Merge", { etag: entidad.etag });
      return;
    } catch (err) {
      if (err.statusCode === 412) continue; // conflicto de ETag — otro envío escribió primero
      throw err;
    }
  }
  throw new Error("No se pudo actualizar el contador tras varios intentos.");
}

module.exports = { actualizarConReintento };
