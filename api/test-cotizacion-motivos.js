const assert = require("assert");
const { MOTIVOS_PERDIDA, esMotivoValido } = require("./src/cotizacion-motivos");
assert.strictEqual(MOTIVOS_PERDIDA.length, 7);
["Precio alto", "Otro proveedor", "Sin presupuesto", "Sin respuesta", "Cambio de prioridad", "Curso interno", "Más adelante"].forEach((m) => assert.ok(esMotivoValido(m), m));
assert.ok(!esMotivoValido("Otro"), "solo la lista fija");
assert.ok(!esMotivoValido(""));
assert.ok(!esMotivoValido(undefined));
console.log("test-cotizacion-motivos: ok");
