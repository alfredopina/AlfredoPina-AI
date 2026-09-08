// test-rate-limit.js
// Prueba local, sin red (mismo patrón que test-availability.js): simula una
// tabla de Table Storage en memoria para verificar que el candado genérico de
// api/src/rate-limit.js (extraído de getRecursos en esta misma sesión) se
// sigue comportando igual: código correcto desbloquea (limpiarIntentos),
// incorrecto lo cuenta (registrarIntentoFallido), 10 fallos bloquean
// (checarBloqueo), y no truena si Table Storage falla (fail-open).
const { checarBloqueo, registrarIntentoFallido, limpiarIntentos } = require("./src/rate-limit");

let failures = 0;
function check(nombre, condicion) {
  if (condicion) {
    console.log(`  OK ${nombre}`);
  } else {
    failures++;
    console.log(`  FALLÓ ${nombre}`);
  }
}

class FakeTable {
  constructor() {
    this.filas = new Map();
  }
  clave(pk, rk) {
    return pk + "|" + rk;
  }
  async getEntity(pk, rk) {
    const k = this.clave(pk, rk);
    if (!this.filas.has(k)) {
      const err = new Error("not found");
      err.statusCode = 404;
      throw err;
    }
    return this.filas.get(k);
  }
  async upsertEntity(entity) {
    this.filas.set(this.clave(entity.partitionKey, entity.rowKey), entity);
  }
  async deleteEntity(pk, rk) {
    const k = this.clave(pk, rk);
    if (!this.filas.has(k)) {
      const err = new Error("not found");
      err.statusCode = 404;
      throw err;
    }
    this.filas.delete(k);
  }
}

class BrokenTable {
  async getEntity() {
    const err = new Error("boom");
    err.statusCode = 500;
    throw err;
  }
  async upsertEntity() {
    throw new Error("boom al escribir");
  }
  async deleteEntity() {
    throw new Error("boom al borrar");
  }
}

(async () => {
  const context = { log: { error: () => {} } };
  const table = new FakeTable();
  const pk = "excel_basico-intermedio";

  check("Sin intentos previos, no está bloqueado", (await checarBloqueo(table, pk, context)) === null);

  for (let i = 1; i <= 9; i++) {
    await registrarIntentoFallido(table, pk, context);
  }
  check("Tras 9 fallos todavía no está bloqueado", (await checarBloqueo(table, pk, context)) === null);

  await registrarIntentoFallido(table, pk, context); // décimo fallo
  const bloqueadoHasta = await checarBloqueo(table, pk, context);
  check(
    "Tras 10 fallos en la ventana queda bloqueado (checarBloqueo regresa una fecha futura)",
    typeof bloqueadoHasta === "string" && new Date(bloqueadoHasta).getTime() > Date.now()
  );

  const pk2 = "powerbi_avanzado";
  check("Un curso distinto no hereda el bloqueo del primero", (await checarBloqueo(table, pk2, context)) === null);
  await registrarIntentoFallido(table, pk2, context);
  await registrarIntentoFallido(table, pk2, context);
  await limpiarIntentos(table, pk2, context); // simula "código correcto" antes de llegar al umbral
  check("Código correcto limpia el contador sin llegar al umbral", (await checarBloqueo(table, pk2, context)) === null);

  const broken = new BrokenTable();
  let truenaLectura = false;
  try {
    await checarBloqueo(broken, "x", context);
  } catch {
    truenaLectura = true;
  }
  check("checarBloqueo no truena si Table Storage falla (fail-open)", !truenaLectura);

  let truenaEscritura = false;
  try {
    await registrarIntentoFallido(broken, "x", context);
  } catch {
    truenaEscritura = true;
  }
  check("registrarIntentoFallido no truena si Table Storage falla", !truenaEscritura);

  console.log("\n" + (failures === 0 ? "TODO OK" : `${failures} verificación(es) fallida(s)`));
  process.exit(failures === 0 ? 0 : 1);
})();
