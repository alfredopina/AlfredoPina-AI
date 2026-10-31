// getDashboardResumenAdmin/index.js
// Function protegida (rol "admin", cerrada por defecto con el comodín /api/*): Dashboard → Resumen de dinero. Devuelve las 10 cifras de las
// tres vistas (Flujo de Venta y Cobranza · Por vender y por cobrar · Oportunidades no cerradas), todas SIN IVA, con valor del periodo,
// comparaciones (mes anterior, promedio de 3 meses, año pasado), serie de 12 meses y meta, según mes / estrategia / tipo de cliente /
// herramienta. El cálculo vive en api/src/dashboard-dinero.js (reutiliza cobranza.resumir). Solo lee: no guarda nada.
const { JSON_HEADERS } = require("../src/http");
const { getUmbrales } = require("../src/notificaciones-config");
const { cargarDatos } = require("../src/dashboard-resumen-db");
const { calcularDinero } = require("../src/dashboard-dinero");
const { TIPOS_CLIENTE, ESTRATEGIAS } = require("../src/dashboard-resumen");
const { HERRAMIENTAS } = require("../src/herramientas");

const falla = (status, error) => ({ status, headers: JSON_HEADERS, body: { error } });

module.exports = async function (context, req) {
  const q = (req && req.query) || {};
  const mes = String(q.mes || "");
  const estrategia = String(q.estrategia || ""), tipoCliente = String(q.tipoCliente || ""), herramienta = String(q.herramienta || "");
  if (mes && mes !== "todo" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return void (context.res = falla(400, "El mes debe verse como 2026-10 o ser «todo»."));
  if (estrategia && !ESTRATEGIAS.includes(estrategia)) return void (context.res = falla(400, "Estrategia no válida."));
  if (tipoCliente && !TIPOS_CLIENTE.includes(tipoCliente)) return void (context.res = falla(400, "Tipo de cliente no válido."));
  if (herramienta && !HERRAMIENTAS.includes(herramienta)) return void (context.res = falla(400, "Herramienta no válida."));
  try {
    const umbrales = await getUmbrales();
    const datos = await cargarDatos(umbrales, { omitir: ["sols", "grupos", "clientes"] });
    const ahora = new Date();
    const r = calcularDinero(datos, { mes, estrategia, tipoCliente, herramienta }, { ahora, umbralPorVencer: umbrales.cobranzaPorVencerDias });
    r.meta.generado = ahora.toISOString();
    context.res = { status: 200, headers: JSON_HEADERS, body: r };
  } catch (err) {
    context.log.error("Error calculando el resumen del dashboard:", err.message);
    context.res = falla(500, "No se pudo calcular el resumen.");
  }
};
