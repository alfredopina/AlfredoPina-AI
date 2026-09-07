// getGuiaCoordenadas/index.js
// Function protegida (rol "admin"): genera y regresa (descargable) un PDF de
// referencia — la plantilla de fondo actual con un recuadro punteado y una
// etiqueta en cada punto donde se dibuja un dato dinámico. Sirve para
// diseñar una plantilla nueva sin tapar esos espacios.
const { getFondoBuffer } = require("../src/plantillas-storage");
const { generarGuiaCoordenadas } = require("../src/diploma-pdf");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  try {
    const fondoBuffer = await getFondoBuffer();
    const pdfBuffer = await generarGuiaCoordenadas({ fondoBuffer });
    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="guia-coordenadas-diploma.pdf"',
        "Cache-Control": "no-store",
      },
      body: pdfBuffer,
    };
  } catch (err) {
    context.log.error("Error generando la guía de coordenadas:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo generar la guía: " + err.message } };
  }
};
