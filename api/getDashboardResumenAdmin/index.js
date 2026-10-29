// getDashboardResumenAdmin/index.js
// Function protegida (rol "admin", cerrada por defecto con el comodín /api/*): Dashboard → Resumen. Devuelve las 25 tarjetas de los 5
// Trackings con valor del periodo, serie de hasta 12 meses y comparación contra el mes anterior, según mes / estrategia / tipo de cliente /
// herramienta. El cálculo vive en api/src/dashboard-resumen.js (reutiliza las reglas de cada Tracking). Además, la primera apertura del día
// guarda la "foto diaria" en Table Storage (dashboard-foto.js) para las tarjetas que no se pueden reconstruir; si eso falla, no pasa nada.
const { JSON_HEADERS } = require("../src/http");
const { getUmbrales } = require("../src/notificaciones-config");
const { cargarDatos } = require("../src/dashboard-resumen-db");
const { calcular, fotoDelDia, TIPOS_CLIENTE, ESTRATEGIAS } = require("../src/dashboard-resumen");
const { guardarFotoDelDia, leerFotos } = require("../src/dashboard-foto");
const { HERRAMIENTAS } = require("../src/herramientas");
const { getPool } = require("../src/backoffice-db");
const { drenarConSql } = require("../src/solicitud-publica-cola");

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
    // pasa a SQL las solicitudes del formulario público que esperaban en la cola (no lanza), igual que el Tracking de Solicitudes
    await drenarConSql(await getPool(), context);
    const datos = await cargarDatos(umbrales);
    const ahora = new Date();
    const hoy = new Date(ahora.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 10);
    const hace14m = new Date(ahora.getTime() - 14 * 31 * 24 * 3600 * 1000 - 6 * 3600 * 1000).toISOString().slice(0, 10);
    // foto del día primero (si hoy no existe, se crea con el estado de hoy) y luego se leen las fotos para las líneas
    const guardada = await guardarFotoDelDia(hoy, fotoDelDia(datos));
    const fotos = await leerFotos(hace14m);
    const r = calcular(datos, { mes, estrategia, tipoCliente, herramienta }, { ahora, fotos, umbralPorVencer: umbrales.cobranzaPorVencerDias });
    r.meta.fotoNueva = guardada;
    r.meta.generado = ahora.toISOString();
    context.res = { status: 200, headers: JSON_HEADERS, body: r };
  } catch (err) {
    context.log.error("Error calculando el resumen del dashboard:", err.message);
    context.res = falla(500, "No se pudo calcular el resumen.");
  }
};
