// Datos fiscales y de cobro de un Cliente (sql/046): nombre fiscal, RFC, plazo de pago y tipo de factura por defecto. Solo aplican a Directo,
// Intermediario y Tercero; a un Prospecto o a un Indirecto no se les pide. Toda cuenta por cobrar nueva nace con estos datos ya puestos
// (Viri los corrige en la cuenta si hace falta). Un Tercero siempre factura tipo Otro, así que no lleva tipo de factura por defecto.
const TIPOS_CON_DATOS_FISCALES = ["Directo", "Intermediario", "Tercero"];
const TIPOS_FACTURA_CLIENTE = ["Empresa", "Gobierno", "Anterior"];

const texto = (v, max) => {
  const t = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

// Devuelve { campos } con solo lo que viene en el cuerpo y aplica al tipo de cliente, o { error } si algo no es válido.
// `campos` usa los nombres de las columnas de Cliente: razon_social, rfc, plazo_pago_dias, tipo_factura_default.
function leerFiscal(body, tipoCliente) {
  const campos = {};
  if (!TIPOS_CON_DATOS_FISCALES.includes(tipoCliente)) return { campos };
  const b = body || {};
  if ("razon_social" in b) campos.razon_social = texto(b.razon_social, 200);
  if ("rfc" in b) {
    const r = texto(b.rfc, 15);
    campos.rfc = r ? r.replace(/\s/g, "").toUpperCase() : null;
  }
  if ("plazo_pago_dias" in b) {
    const v = b.plazo_pago_dias;
    if (v === null || v === "" || v === undefined) campos.plazo_pago_dias = null;
    else {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 365) return { error: "El plazo de pago debe ser un número entero de días (0 a 365)." };
      campos.plazo_pago_dias = n;
    }
  }
  if ("tipo_factura_default" in b && tipoCliente !== "Tercero") {
    const t = texto(b.tipo_factura_default, 10);
    if (t && !TIPOS_FACTURA_CLIENTE.includes(t)) return { error: "El tipo de factura debe ser Empresa, Gobierno o Anterior." };
    campos.tipo_factura_default = t;
  }
  return { campos };
}

module.exports = { leerFiscal, TIPOS_CON_DATOS_FISCALES, TIPOS_FACTURA_CLIENTE };
