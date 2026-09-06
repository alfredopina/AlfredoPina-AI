// Genera el PDF de un diploma con pdf-lib — NO Puppeteer ni nada basado en
// navegador headless, no es confiable en managed functions de Static Web Apps.
// Esta es una plantilla de PRUEBA (texto sobre fondo blanco) mientras Alfredo
// entrega el diseño real; cuando llegue, solo cambia lo que se dibuja aquí
// adentro — el resto del flujo (folio, storage, admin) no se toca.
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const TEXTO_RESULTADO = {
  Aprobado: "Participación & Aprobación",
  "Participó": "Participación",
};

async function generarDiplomaPdf({ alumno, empresa, curso, nivel, resultado, fechaInicio, fechaFin, instructor, folio }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([792, 612]); // Carta horizontal (11x8.5in a 72dpi)
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const oscuro = rgb(0.15, 0.15, 0.15);
  const gris = rgb(0.45, 0.45, 0.45);

  const centrado = (texto, y, tamano, fuente, color) => {
    const anchoTexto = fuente.widthOfTextAtSize(texto, tamano);
    page.drawText(texto, { x: (width - anchoTexto) / 2, y, size: tamano, font: fuente, color });
  };

  centrado("DIPLOMA", height - 90, 30, fontBold, oscuro);
  centrado(TEXTO_RESULTADO[resultado] || resultado, height - 125, 16, font, gris);
  centrado(alumno, height - 195, 26, fontBold, oscuro);
  centrado(empresa, height - 225, 14, font, gris);
  centrado(`${curso} — Nivel ${nivel}`, height - 265, 16, font, oscuro);
  centrado(`${fechaInicio} al ${fechaFin} · Instructor: ${instructor}`, height - 292, 12, font, gris);
  page.drawText(`Folio: ${folio}`, { x: 40, y: 30, size: 9, font, color: gris });

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generarDiplomaPdf };
