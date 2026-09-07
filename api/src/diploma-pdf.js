// Genera el PDF de un diploma con pdf-lib — NO Puppeteer ni nada basado en
// navegador headless, no es confiable en managed functions de Static Web Apps.
//
// Plantilla de PRUEBA (diseño azul de Alfredo, exportado a 1440x1078px)
// mientras define el diseño definitivo — ver api/assets/diploma-fondo-prueba.png.
// La página del PDF se crea del mismo tamaño en puntos que la imagen en
// píxeles (1440x1078pt) para poder usar las coordenadas del PNG directo, sin
// conversiones. Cuando llegue la plantilla final, solo cambia el archivo de
// fondo y estas coordenadas — el resto del flujo no se toca.
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const FONDO_PATH = path.join(__dirname, "..", "assets", "diploma-fondo-prueba.png");
const FIRMA_PATH = path.join(__dirname, "..", "assets", "firma-alfredo.png");

const AZUL_OSCURO = rgb(0.09, 0.16, 0.42); // mismo tono navy del texto de la plantilla
const CENTRO_X = 615; // el bloque de texto no está centrado en la página completa —
// la curva decorativa ocupa la derecha, el contenido real se centra más a la izquierda

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatFechaLarga(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

const TEXTO_RESULTADO = {
  Aprobado: "participación y aprobación",
  "Participó": "participación",
};

async function generarDiplomaPdf({ alumno, curso, resultado, fechaInicio, fechaFin, horas, instructor, folio }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([1440, 1078]);

  const fondoBytes = fs.readFileSync(FONDO_PATH);
  const fondoImg = await pdfDoc.embedPng(fondoBytes);
  page.drawImage(fondoImg, { x: 0, y: 0, width: 1440, height: 1078 });

  const firmaBytes = fs.readFileSync(FIRMA_PATH);
  const firmaImg = await pdfDoc.embedPng(firmaBytes);
  const firmaAncho = 135;
  const firmaAlto = firmaAncho * (firmaImg.height / firmaImg.width);
  page.drawImage(firmaImg, { x: CENTRO_X - firmaAncho / 2, y: 206, width: firmaAncho, height: firmaAlto });

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const centrado = (texto, yTop, tamano, fuente) => {
    const ancho = fuente.widthOfTextAtSize(texto, tamano);
    page.drawText(texto, { x: CENTRO_X - ancho / 2, y: 1078 - yTop, size: tamano, font: fuente, color: AZUL_OSCURO });
  };

  // Folio, junto a "Constancia No." (que ya viene fijo en el fondo)
  page.drawText(folio, { x: 222, y: 1078 - 36, size: 20, font: fontBold, color: AZUL_OSCURO });

  // "OTORGA EL PRESENTE" / "DIPLOMA A" ya vienen fijos en el fondo — solo el nombre es dinámico
  centrado(alumno, 450, 39, fontBold);
  centrado(`Por su ${TEXTO_RESULTADO[resultado] || resultado.toLowerCase()} en el curso`, 558, 21, font);
  centrado(curso, 627, 30, fontBold);
  centrado(`Del ${formatFechaLarga(fechaInicio)} al ${formatFechaLarga(fechaFin)}`, 693, 18, font);
  centrado(`Con duración de ${horas} horas`, 741, 18, font);
  centrado(instructor, 908, 17, fontBold);

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generarDiplomaPdf };
