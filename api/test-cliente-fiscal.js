// test-cliente-fiscal.js — datos fiscales y de cobro del Cliente (nombre fiscal, RFC, plazo, tipo de factura). Sin red ni base. Datos ficticios.
const assert = require("assert");
const { leerFiscal } = require("./src/cliente-fiscal");

let n = 0;
const ok = (nombre, fn) => { fn(); n++; console.log("  OK " + nombre); };

ok("Directo: normaliza nombre fiscal, RFC (mayúsculas, sin espacios), plazo y tipo de factura", () => {
  const r = leerFiscal({ razon_social: "  Acme   SA de CV ", rfc: " acm 010101 ab1 ", plazo_pago_dias: "45", tipo_factura_default: "Gobierno" }, "Directo");
  assert.deepStrictEqual(r.campos, { razon_social: "Acme SA de CV", rfc: "ACM010101AB1", plazo_pago_dias: 45, tipo_factura_default: "Gobierno" });
});
ok("Intermediario también lleva los cuatro datos", () => {
  assert.strictEqual(leerFiscal({ tipo_factura_default: "Empresa" }, "Intermediario").campos.tipo_factura_default, "Empresa");
});
ok("Tercero: lleva nombre fiscal, RFC y plazo, pero NO tipo de factura (siempre es Otro)", () => {
  const r = leerFiscal({ razon_social: "Taller SA", plazo_pago_dias: 15, tipo_factura_default: "Empresa" }, "Tercero");
  assert.deepStrictEqual(r.campos, { razon_social: "Taller SA", plazo_pago_dias: 15 });
});
ok("Prospecto e Indirecto: no se les pide nada (no se escribe ni se borra)", () => {
  assert.deepStrictEqual(leerFiscal({ razon_social: "X", rfc: "Y", plazo_pago_dias: 30 }, "Prospecto").campos, {});
  assert.deepStrictEqual(leerFiscal({ razon_social: "X" }, "Indirecto").campos, {});
});
ok("solo toca lo que viene en el cuerpo (editar un cliente sin mandar los datos no los borra)", () => {
  assert.deepStrictEqual(leerFiscal({}, "Directo").campos, {});
  assert.deepStrictEqual(leerFiscal({ rfc: "" }, "Directo").campos, { rfc: null });
});
ok("plazo vacío se guarda como no capturado; fuera de 0 a 365 o con decimales es error", () => {
  assert.strictEqual(leerFiscal({ plazo_pago_dias: "" }, "Directo").campos.plazo_pago_dias, null);
  assert.ok(leerFiscal({ plazo_pago_dias: 400 }, "Directo").error);
  assert.ok(leerFiscal({ plazo_pago_dias: -1 }, "Directo").error);
  assert.ok(leerFiscal({ plazo_pago_dias: 12.5 }, "Directo").error);
  assert.strictEqual(leerFiscal({ plazo_pago_dias: 0 }, "Directo").campos.plazo_pago_dias, 0);
});
ok("tipo de factura por defecto solo Empresa, Gobierno o Anterior (Otro es de los Terceros)", () => {
  assert.ok(leerFiscal({ tipo_factura_default: "Otro" }, "Directo").error);
  assert.ok(leerFiscal({ tipo_factura_default: "Inventado" }, "Directo").error);
  assert.strictEqual(leerFiscal({ tipo_factura_default: "" }, "Directo").campos.tipo_factura_default, null);
});
console.log("test-cliente-fiscal: ok (" + n + ")");
