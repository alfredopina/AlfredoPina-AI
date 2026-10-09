// previsualizarCotizacion/index.js
// Function protegida (rol "admin"): recibe el mismo payload de datos que crearCotizacion (más cliente_nombre/
// contacto_nombre/tarifa_hora, que el front ya tiene resueltos en memoria) y regresa el SNAPSHOT de la propuesta como
// JSON — SIN guardar nada (ni la base ni Table Storage). El admin lo abre en /propuesta/vista-previa, que lo lee de
// localStorage. Por eso el folio es un placeholder y no resuelve/crea Cliente.
const { proyectosParaPropuesta, proyectosPorIds } = require("../src/cotizacion-proyectos");
const { armarSnapshot } = require("../src/propuestas");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const clienteNombre = (body.cliente_nombre || "").trim();
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const temas = Array.isArray(body.temas) ? body.temas : [];
  const horas = Number(body.horas_totales);
  const precioFinal = Number(body.precio_final);
  const tarifaHora = Number(body.tarifa_hora);

  if (!clienteNombre || !herramienta || !temas.length || !Number.isFinite(horas) || !Number.isFinite(precioFinal)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos para generar la vista previa." } };
    return;
  }

  try {
    const estandar = body.temario_tipo !== "personalizado" && (body.temario_nombre || "").trim();
    const proyectos = estandar ? await proyectosParaPropuesta(herramienta, body.temario_nombre) : await proyectosPorIds(herramienta, body.proyectos);
    const precioSugerido = Number.isFinite(tarifaHora) && tarifaHora > 0 ? Math.round(horas * tarifaHora * 100) / 100 : precioFinal;
    const snapshot = armarSnapshot({
      folio: "VISTA PREVIA",
      cliente: clienteNombre,
      contacto: (body.contacto_nombre || "").trim() || null,
      herramienta,
      programa: estandar ? body.temario_nombre.trim() : "Programa personalizado",
      temas,
      horas,
      modalidad: (body.modalidad || "").trim() || null,
      participantes: (body.participantes || "").trim() || null,
      ciudadSede: (body.ciudad_sede || "").trim() || null,
      fechaTentativa: (body.fecha_tentativa || "").trim() || null,
      objetivo: (body.objetivo || "").trim() || null,
      dirigidoA: (body.dirigido_a || "").trim() || null,
      alcance: (body.alcance || "").trim() || null,
      proyectos,
      tarifaHora: Number.isFinite(tarifaHora) ? tarifaHora : 0,
      precioSugerido,
      precioFinal,
      emitida: new Date(),
      vigencia: body.fecha_vigencia ? new Date(body.fecha_vigencia) : new Date(Date.now() + 15 * 24 * 3600 * 1000),
    });
    context.res = { status: 200, headers: { ...JSON_HEADERS, "Cache-Control": "no-store" }, body: snapshot };
  } catch (err) {
    context.log.error("Error generando la vista previa:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo generar la vista previa: " + err.message } };
  }
};
