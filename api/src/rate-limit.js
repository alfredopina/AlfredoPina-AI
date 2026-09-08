// Candado genérico de intentos fallidos, por partitionKey — nació hardcodeado
// en getRecursos (partitionKey = "herramienta_curso"); Diagnóstico (Fase 1.4 del
// roadmap) va a necesitar el mismo tipo de protección con su propio código
// corto de acceso y su propia forma de partitionKey, así que se generalizó aquí
// en vez de copiarlo a mano después. El caller decide qué tabla usar (Table
// Storage — cualquiera con getEntity/upsertEntity/deleteEntity) y cómo arma su
// partitionKey; este módulo no sabe nada de "cursos" ni de "recursos".
//
// Parámetros ya probados en producción con getRecursos: 10 intentos fallidos en
// una ventana de 15 min bloquean 5 min. Fail-open si Table Storage falla al
// leer/escribir el contador — más vale no bloquear el acceso legítimo por un
// problema del contador, que no es la defensa principal.
const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 10;
const BLOQUEO_MS = 5 * 60 * 1000;

// null si no está bloqueado.
async function checarBloqueo(table, partitionKey, context) {
  try {
    const entidad = await table.getEntity(partitionKey, "contador");
    if (entidad.bloqueadoHasta && new Date(entidad.bloqueadoHasta).getTime() > Date.now()) {
      return entidad.bloqueadoHasta;
    }
    return null;
  } catch (err) {
    if (err.statusCode !== 404) context.log.error("Error leyendo el contador de intentos:", err.message);
    return null;
  }
}

// Registra un intento fallido y bloquea si se pasó del umbral en la ventana.
async function registrarIntentoFallido(table, partitionKey, context) {
  try {
    const ahora = Date.now();
    let entidad = null;
    try {
      entidad = await table.getEntity(partitionKey, "contador");
    } catch (err) {
      if (err.statusCode !== 404) throw err;
    }

    const ventanaVigente = entidad && ahora - new Date(entidad.ventanaInicio).getTime() < VENTANA_MS;
    const fallos = (ventanaVigente ? entidad.fallos : 0) + 1;
    const ventanaInicio = ventanaVigente ? entidad.ventanaInicio : new Date(ahora).toISOString();
    const bloqueadoHasta = fallos >= MAX_INTENTOS ? new Date(ahora + BLOQUEO_MS).toISOString() : "";

    await table.upsertEntity(
      { partitionKey, rowKey: "contador", fallos, ventanaInicio, bloqueadoHasta },
      "Replace"
    );
  } catch (err) {
    context.log.error("Error registrando el intento fallido:", err.message);
  }
}

// Intento correcto: limpia el contador para no penalizar intentos futuros legítimos.
async function limpiarIntentos(table, partitionKey, context) {
  try {
    await table.deleteEntity(partitionKey, "contador");
  } catch (err) {
    if (err.statusCode !== 404) context.log.error("Error limpiando el contador de intentos:", err.message);
  }
}

module.exports = { checarBloqueo, registrarIntentoFallido, limpiarIntentos };
