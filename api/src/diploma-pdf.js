// Genera el PDF de un diploma con pdf-lib — NO Puppeteer ni nada basado en
// navegador headless, no es confiable en managed functions de Static Web Apps.
//
// Plantilla de PRUEBA (diseño azul de Alfredo, exportado a 1437x1078px)
// mientras define el diseño definitivo — ver api/assets/diploma-fondo-prueba.png.
// La página del PDF se crea del mismo tamaño en puntos que la imagen en
// píxeles (1437x1078pt) para poder usar las coordenadas del PNG directo, sin
// conversiones. El texto dinámico se dibuja con Inter (api/assets/fonts/,
// misma tipografía de body que ya usa el sitio) en vez de la fuente estándar
// de PDF, para que no se note distinta a la del fondo.
// Cuando llegue la plantilla final, solo cambia el archivo de fondo y estas
// coordenadas — el resto del flujo no se toca.
const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

const FONDO_PATH = path.join(__dirname, "..", "assets", "diploma-fondo-prueba.png");
const FIRMA_PATH = path.join(__dirname, "..", "assets", "firma-alfredo.png");
const FONT_REGULAR_PATH = path.join(__dirname, "..", "assets", "fonts", "Inter-Regular.ttf");
const FONT_BOLD_PATH = path.join(__dirname, "..", "assets", "fonts", "Inter-Bold.ttf");

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
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([1437, 1078]);

  const fondoImg = await pdfDoc.embedPng(fs.readFileSync(FONDO_PATH));
  page.drawImage(fondoImg, { x: 0, y: 0, width: 1437, height: 1078 });

  const firmaImg = await pdfDoc.embedPng(fs.readFileSync(FIRMA_PATH));
  const firmaAncho = 135;
  const firmaAlto = firmaAncho * (firmaImg.height / firmaImg.width);
  page.drawImage(firmaImg, { x: CENTRO_X - firmaAncho / 2, y: 206, width: firmaAncho, height: firmaAlto });

  const fontBold = await pdfDoc.embedFont(fs.readFileSync(FONT_BOLD_PATH));
  const font = await pdfDoc.embedFont(fs.readFileSync(FONT_REGULAR_PATH));

  const centrado = (texto, yTop, tamano, fuente) => {
    const ancho = fuente.widthOfTextAtSize(texto, tamano);
    page.drawText(texto, { x: CENTRO_X - ancho / 2, y: 1078 - yTop, size: tamano, font: fuente, color: AZUL_OSCURO });
  };

  // Folio, junto a "Constancia No." (que ya viene fijo en el fondo)
  page.drawText(folio, { x: 300, y: 1078 - 34, size: 16, font: fontBold, color: AZUL_OSCURO });

  // "OTORGA EL PRESENTE" / "DIPLOMA A" ya vienen fijos en el fondo — solo el nombre es dinámico
  centrado(alumno, 460, 50, fontBold);
  centrado(`Por su ${TEXTO_RESULTADO[resultado] || resultado.toLowerCase()} en el curso`, 545, 24, font);
  centrado(curso, 610, 44, fontBold);
  centrado(`Del ${formatFechaLarga(fechaInicio)} al ${formatFechaLarga(fechaFin)}`, 685, 24, font);
  centrado(`Con duración de ${horas} horas`, 730, 22, font);
  centrado(instructor, 908, 22, fontBold);

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generarDiplomaPdf };
