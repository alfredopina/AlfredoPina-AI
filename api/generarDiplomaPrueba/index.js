// generarDiplomaPrueba/index.js
// Function protegida (rol "admin"): genera un PDF con datos ficticios usando
// la plantilla y la firma actuales, para probar cómo se ve un cambio antes
// de que se use en un diploma real. No toca la base de datos ni el
// contenedor de diplomas — es puramente una vista previa desechable.
const { getFondoBuffer, getFirmaBuffer, slugify } = require("../src/plantillas-storage");
const { generarDiplomaPdf } = require("../src/diploma-pdf");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const instructor = (req.query.instructor || "Ing. Alfredo Piña").trim();

  try {
    const [fondoBuffer, firmaBuffer] = await Promise.all([getFondoBuffer(), getFirmaBuffer(slugify(instructor))]);

    const pdfBuffer = await generarDiplomaPdf({
      alumno: "Nombre de Prueba",
      curso: "Curso de Prueba",
      resultado: "Aprobado",
      fechaInicio: new Date().toISOString().slice(0, 10),
      fechaFin: new Date().toISOString().slice(0, 10),
      horas: 20,
      instructor,
      folio: "AP_PRUEBA_TEST_00-0",
      fondoBuffer,
      firmaBuffer,
    });

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="prueba.pdf"', "Cache-Control": "no-store" },
      body: pdfBuffer,
    };
  } catch (err) {
    context.log.error("Error generando el PDF de prueba:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo generar la prueba: " + err.message } };
  }
};
