// previsualizarCotizacion/index.js
// Function protegida (rol "admin"): recibe el mismo payload de datos que crearCotizacion (más cliente_nombre/
// contacto_nombre/tarifa_hora, que el front ya tiene resueltos en memoria) y regresa el SNAPSHOT de la propuesta como
// JSON — SIN guardar nada (ni la base ni Table Storage). El admin lo abre en /propuesta/vista-previa, que lo lee de
// localStorage. Por eso el folio es un placeholder y no resuelve/crea Cliente.
const { proyectosParaPropuesta, proyectosPorIds } = require("../src/cotizacion-proyectos");
const { armarSnapshot, esPrecioManual } = require("../src/propuestas");
const { existeLogoIntermediario } = require("../src/intermediarios-storage");
const { normalizarTemasCustom } = require("../src/temas-custom");
const { normalizarGrupos, normalizarParticipantesNum } = require("../src/cotizacion-grupos");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const body = req.body || {};
  const clienteNombre = (body.cliente_nombre || "").trim();
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const temas = Array.isArray(body.temas) ? body.temas : [];
  const horas = Number(body.horas_totales);
  const precioFinal = Number(body.precio_final);
  const tarifaHora = Number(body.tarifa_hora);
  const numGrupos = normalizarGrupos(body.num_grupos);

  if (!clienteNombre || !herramienta || (!temas.length && !(body.temario_tipo === "personalizado" && normalizarTemasCustom(body.temas_custom).length)) || !Number.isFinite(horas) || !Number.isFinite(precioFinal)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos para generar la vista previa." } };
    return;
  }

  try {
    // vía intermediario: `cliente_nombre` es el Intermediario, `cliente_final_nombre` el cliente real; el permiso de mostrar el logo
    // (mostrar_logo) lo manda el admin porque esta vista previa no toca SQL; aquí solo se confirma que el logo exista
    let intermediario = null;
    const intermId = Number(body.intermediario_id) || null;
    if (intermId) {
      const logoOk = body.intermediario_mostrar_logo ? await existeLogoIntermediario(intermId).catch(() => false) : false;
      intermediario = { nombre: clienteNombre, logoUrl: logoOk ? "/api/getLogoIntermediario?cliente=" + intermId : null };
    }
    const estandar = body.temario_tipo !== "personalizado" && (body.temario_nombre || "").trim();
    const proyectos = estandar ? await proyectosParaPropuesta(herramienta, body.temario_nombre) : await proyectosPorIds(herramienta, body.proyectos);
    const precioSugerido = Number.isFinite(tarifaHora) && tarifaHora > 0 ? Math.round(horas * tarifaHora * numGrupos * 100) / 100 : precioFinal;
    const snapshot = armarSnapshot({
      folio: "VISTA PREVIA",
      cliente: clienteNombre,
      clienteFinal: intermediario ? (body.cliente_final_nombre || "").trim() || null : null,
      intermediario,
      contacto: (body.contacto_nombre || "").trim() || null,
      herramienta,
      programa: estandar ? body.temario_nombre.trim() : "Programa personalizado",
      temas,
      temasCustom: body.temario_tipo === "personalizado" ? normalizarTemasCustom(body.temas_custom) : [],
      horas,
      modalidad: (body.modalidad || "").trim() || null,
      participantes: (body.participantes || "").trim() || null,
      ciudadSede: (body.ciudad_sede || "").trim() || null,
      fechaTentativa: (body.fecha_tentativa || "").trim() || null,
      objetivo: (body.objetivo || "").trim() || null,
      dirigidoA: (body.dirigido_a || "").trim() || null,
      precioManual: body.descuento_pct != null && body.descuento_pct !== "" && Number.isFinite(tarifaHora) && tarifaHora > 0 ? esPrecioManual({ precioSugerido, descuentoPct: body.descuento_pct, precioFinal }) : false,
      proyectos,
      tarifaHora: Number.isFinite(tarifaHora) ? tarifaHora : 0,
      grupos: numGrupos,
      participantesNum: normalizarParticipantesNum(body.participantes_num),
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
