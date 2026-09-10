// getPlantillaCotizacion/index.js
// Function protegida (rol "admin"): regresa el fondo de la plantilla de
// Cotización desde el contenedor privado "plantillas", para previsualizarlo
// en Cotizaciones → Plantilla. Mismo patrón que getPlantillaAsset (tipo
// "fondo"), pero sin la rama de firmas que sí necesita Diplomas.
const { getCotizacionFondoBuffer } = require("../src/plantillas-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  try {
    const buffer = await getCotizacionFondoBuffer();
    context.res = { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "no-store" }, body: buffer };
  } catch (err) {
    if (err.message && err.message.includes("No hay una plantilla")) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Todavía no hay imagen." } };
      return;
    }
    context.log.error("Error obteniendo la plantilla de cotización:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo cargar la imagen: " + err.message } };
  }
};
