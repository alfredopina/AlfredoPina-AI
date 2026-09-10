// getGuiaCoordenadasCotizacion/index.js
// Function protegida (rol "admin"): genera y regresa (descargable) el PDF de
// referencia de la plantilla de Cotización — mismo espíritu que
// getGuiaCoordenadas de Diplomas, usando cotizacion-pdf.js en vez de
// diploma-pdf.js.
const { getCotizacionFondoBuffer } = require("../src/plantillas-storage");
const { generarGuiaCoordenadas } = require("../src/cotizacion-pdf");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const fondoBuffer = await getCotizacionFondoBuffer();
    const pdfBuffer = await generarGuiaCoordenadas({ fondoBuffer });
    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="guia-coordenadas-cotizacion.pdf"',
        "Cache-Control": "no-store",
      },
      body: pdfBuffer,
    };
  } catch (err) {
    context.log.error("Error generando la guía de coordenadas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo generar la guía: " + err.message } };
  }
};
