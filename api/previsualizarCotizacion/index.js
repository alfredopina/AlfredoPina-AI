// previsualizarCotizacion/index.js
// Function protegida (rol "admin"): recibe el mismo payload de datos que
// crearCotizacion (más cliente_nombre/contacto_nombre, que el front ya tiene
// resueltos en memoria) y regresa el PDF en streaming — SIN tocar la base ni
// el blob permanente, mismo espíritu que "generar PDF de prueba" de Diplomas
// (generarDiplomaPrueba). Por eso el folio es un placeholder fijo en vez de
// calcularse (calcularlo implicaría leer Cotizacion) y no resuelve/crea
// Cliente: usa directo el nombre que ya seleccionó/escribió el front.
const { generarCotizacionPdf } = require("../src/cotizacion-pdf");
const { JSON_HEADERS } = require("../src/http");

const TOOL_LABELS = {
  excel: "Excel", powerbi: "Power BI", powerapps: "Power Apps",
  powerautomate: "Power Automate", ia: "IA Aplicada", ofimatica: "Ofimática Básica",
};

module.exports = async function (context, req) {
  const body = req.body || {};
  const clienteNombre = (body.cliente_nombre || "").trim();
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const temas = Array.isArray(body.temas) ? body.temas : [];
  const horas = Number(body.horas_totales);
  const precioFinal = Number(body.precio_final);

  if (!clienteNombre || !herramienta || !temas.length || !Number.isFinite(horas) || !Number.isFinite(precioFinal)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos para generar la vista previa." } };
    return;
  }

  try {
    const pdfBuffer = await generarCotizacionPdf({
      cliente: clienteNombre,
      contacto: (body.contacto_nombre || "").trim() || null,
      herramienta,
      herramientaLabel: TOOL_LABELS[herramienta] || herramienta,
      temarioTitulo: (body.temario_nombre || "").trim() || "Temario personalizado",
      temas,
      horasTotales: horas,
      precioFinal,
      modalidad: (body.modalidad || "").trim() || null,
      participantes: (body.participantes || "").trim() || null,
      ciudadSede: (body.ciudad_sede || "").trim() || null,
      fechaTentativa: (body.fecha_tentativa || "").trim() || null,
      fechaVigencia: body.fecha_vigencia ? new Date(body.fecha_vigencia) : new Date(Date.now() + 15 * 24 * 3600 * 1000),
      folio: "VISTA PREVIA — SIN FOLIO",
      dirigidoA: (body.dirigido_a || "").trim() || null,
      objetivo: (body.objetivo || "").trim() || null,
    });

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="vista-previa-cotizacion.pdf"', "Cache-Control": "no-store" },
      body: pdfBuffer,
    };
  } catch (err) {
    context.log.error("Error generando la vista previa:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo generar la vista previa: " + err.message } };
  }
};
