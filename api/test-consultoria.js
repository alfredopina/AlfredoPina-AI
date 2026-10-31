// test-consultoria.js — contenido de una cotización de consultoría (api/src/consultoria.js), sin red.
const assert = require("assert");
const C = require("./src/consultoria");

const ok = C.normalizarConsultoria({
  fases: [{ nombre: " Levantamiento ", descripcion: " Entrevistas ", horas: "6.04" }, { nombre: "", horas: 3 }, { nombre: "Sin horas", horas: 0 }, { nombre: "Tablero", horas: 10 }],
  entregables: "- Tablero publicado\n• Manual de uso\n3) Sesión de entrega\n\n",
  imagen: "https://cuenta1.blob.core.windows.net/consultoria/ab12cd.jpg",
});
assert.deepStrictEqual(ok.fases.map((f) => [f.nombre, f.horas]), [["Levantamiento", 6], ["Tablero", 10]], "solo fases con nombre y horas > 0; horas a 1 decimal");
assert.deepStrictEqual(ok.entregables, ["Tablero publicado", "Manual de uso", "Sesión de entrega"], "viñetas, números y líneas vacías se limpian");
assert.strictEqual(ok.imagen, "https://cuenta1.blob.core.windows.net/consultoria/ab12cd.jpg");
assert.strictEqual(C.horasDeFases(ok.fases), 16);
assert.strictEqual(C.normalizarConsultoria({ fases: [{ nombre: "x", horas: 0 }] }), null, "sin fases válidas = null");
assert.strictEqual(C.normalizarConsultoria(null), null);
assert.strictEqual(C.normalizarConsultoria({ fases: [{ nombre: "F", horas: 1 }], imagen: "https://evil.example.com/x.jpg" }).imagen, null, "solo imágenes de nuestro contenedor");
assert.strictEqual(C.normalizarConsultoria({ fases: Array.from({ length: 30 }, (_, i) => ({ nombre: "F" + i, horas: 1 })) }).fases.length, C.MAX_FASES);
console.log("test-consultoria: ok");
