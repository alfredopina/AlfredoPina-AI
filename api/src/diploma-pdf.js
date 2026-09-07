// Genera el PDF de un diploma con pdf-lib — NO Puppeteer ni nada basado en
// navegador headless, no es confiable en managed functions de Static Web Apps.
//
// Plantilla de PRUEBA (diseño azul de Alfredo, 1437x1078px) mientras define
// el diseño definitivo. El fondo y la firma del instructor YA NO son
// archivos fijos del repo — viven en Blob Storage (ver plantillas-storage.js)
// y Alfredo los administra desde el panel "Plantillas" del admin, así que
// esta función los recibe como buffers ya descargados (fondoBuffer,
// firmaBuffer — este último puede ser null si ese instructor no tiene firma
// cargada todavía, en cuyo caso el diploma sale igual, solo sin firma).
// La página del PDF se crea del mismo tamaño en puntos que la imagen en
// píxeles (1437x1078pt) para poder usar las coordenadas del PNG directo, sin
// conversiones. El texto dinámico se dibuja con Inter (api/assets/fonts/,
// misma tipografía de body que ya usa el sitio) en vez de la fuente estándar
// de PDF, para que no se note distinta a la del fondo. Las fuentes sí siguen
// siendo archivos del repo — a diferencia del fondo/firma, no se espera que
// cambien nunca desde el admin.
const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

const FONT_REGULAR_PATH = path.join(__dirname, "..", "assets", "fonts", "Inter-Regular.ttf");
const FONT_BOLD_PATH = path.join(__dirname, "..", "assets", "fonts", "Inter-Bold.ttf");

const AZUL_OSCURO = rgb(0.09, 0.16, 0.42); // mismo tono navy del texto de la plantilla
const CENTRO_X = 615; // el bloque de texto no está centrado en la página completa —
// la curva decorativa ocupa la derecha, el contenido real se centra más a la izquierda
const PAGE_WIDTH = 1437;
const PAGE_HEIGHT = 1078;
const FIRMA_ANCHO = 135;
const FIRMA_Y = 206;

// posición (yTop, distancia desde arriba) y tamaño de cada campo dinámico —
// mismos valores que usa generarDiplomaPdf, reutilizados también por
// generarGuiaCoordenadas para que la guía y el PDF real nunca se desalineen
const CAMPOS = [
  { id: "folio", yTop: 34, x: 300, size: 16, etiqueta: "FOLIO — empieza aquí, junto a \"Constancia No.\"" },
  { id: "nombre", yTop: 460, size: 50, etiqueta: "NOMBRE DEL ALUMNO — centrado en este punto" },
  { id: "resultado", yTop: 545, size: 24, etiqueta: "\"Por su [resultado] en el curso\" — centrado; el ancho varía según el texto" },
  { id: "curso", yTop: 610, size: 44, etiqueta: "CURSO — centrado en este punto" },
  { id: "fechas", yTop: 685, size: 24, etiqueta: "FECHAS (\"Del X al Y\") — centrado en este punto" },
  { id: "horas", yTop: 730, size: 22, etiqueta: "HORAS (\"Con duración de X horas\") — centrado en este punto" },
  { id: "instructor", yTop: 908, size: 22, etiqueta: "NOMBRE DEL INSTRUCTOR — centrado en este punto" },
];

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

async function generarDiplomaPdf({ alumno, curso, resultado, fechaInicio, fechaFin, horas, instructor, folio, fondoBuffer, firmaBuffer }) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const fondoImg = await pdfDoc.embedPng(fondoBuffer);
  page.drawImage(fondoImg, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });

  if (firmaBuffer) {
    const firmaImg = await pdfDoc.embedPng(firmaBuffer);
    const firmaAlto = FIRMA_ANCHO * (firmaImg.height / firmaImg.width);
    page.drawImage(firmaImg, { x: CENTRO_X - FIRMA_ANCHO / 2, y: FIRMA_Y, width: FIRMA_ANCHO, height: firmaAlto });
  }

  const fontBold = await pdfDoc.embedFont(fs.readFileSync(FONT_BOLD_PATH));
  const font = await pdfDoc.embedFont(fs.readFileSync(FONT_REGULAR_PATH));

  const centrado = (texto, yTop, tamano, fuente) => {
    const ancho = fuente.widthOfTextAtSize(texto, tamano);
    page.drawText(texto, { x: CENTRO_X - ancho / 2, y: PAGE_HEIGHT - yTop, size: tamano, font: fuente, color: AZUL_OSCURO });
  };

  // Folio, junto a "Constancia No." (que ya viene fijo en el fondo)
  const cFolio = CAMPOS.find((c) => c.id === "folio");
  page.drawText(folio, { x: cFolio.x, y: PAGE_HEIGHT - cFolio.yTop, size: cFolio.size, font: fontBold, color: AZUL_OSCURO });

  // "OTORGA EL PRESENTE" / "DIPLOMA A" ya vienen fijos en el fondo — solo el nombre es dinámico
  centrado(alumno, CAMPOS.find((c) => c.id === "nombre").yTop, CAMPOS.find((c) => c.id === "nombre").size, fontBold);
  centrado(
    `Por su ${TEXTO_RESULTADO[resultado] || resultado.toLowerCase()} en el curso`,
    CAMPOS.find((c) => c.id === "resultado").yTop,
    CAMPOS.find((c) => c.id === "resultado").size,
    font
  );
  centrado(curso, CAMPOS.find((c) => c.id === "curso").yTop, CAMPOS.find((c) => c.id === "curso").size, fontBold);
  centrado(
    `Del ${formatFechaLarga(fechaInicio)} al ${formatFechaLarga(fechaFin)}`,
    CAMPOS.find((c) => c.id === "fechas").yTop,
    CAMPOS.find((c) => c.id === "fechas").size,
    font
  );
  centrado(`Con duración de ${horas} horas`, CAMPOS.find((c) => c.id === "horas").yTop, CAMPOS.find((c) => c.id === "horas").size, font);
  centrado(instructor, CAMPOS.find((c) => c.id === "instructor").yTop, CAMPOS.find((c) => c.id === "instructor").size, fontBold);

  return Buffer.from(await pdfDoc.save());
}

// Genera un PDF de referencia: la plantilla de fondo actual con un recuadro
// punteado + etiqueta en cada punto donde generarDiplomaPdf dibuja un dato.
// Pensado para que Alfredo lo descargue y lo use como capa guía en
// Canva/PowerPoint al diseñar una plantilla nueva, sin tapar esos espacios.
async function generarGuiaCoordenadas({ fondoBuffer }) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const fondoImg = await pdfDoc.embedPng(fondoBuffer);
  page.drawImage(fondoImg, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });

  const fontBold = await pdfDoc.embedFont(fs.readFileSync(FONT_BOLD_PATH));
  const guia = rgb(0.93, 0.13, 0.55); // rosa fuerte — que no se confunda con el navy del diseño

  CAMPOS.forEach((c) => {
    const y = PAGE_HEIGHT - c.yTop;
    const x = c.x !== undefined ? c.x : CENTRO_X;

    page.drawLine({ start: { x: 20, y }, end: { x: PAGE_WIDTH - 20, y }, thickness: 0.75, color: guia, dashArray: [6, 4] });
    page.drawLine({ start: { x: x - 9, y }, end: { x: x + 9, y }, thickness: 1.5, color: guia });
    page.drawLine({ start: { x, y: y - 9 }, end: { x, y: y + 9 }, thickness: 1.5, color: guia });
    page.drawText(c.etiqueta, { x: 24, y: y + 5, size: 9.5, font: fontBold, color: guia });
  });

  const firmaAlto = FIRMA_ANCHO * (415 / 497); // proporción de la firma actual (497x415px)
  page.drawRectangle({
    x: CENTRO_X - FIRMA_ANCHO / 2,
    y: FIRMA_Y,
    width: FIRMA_ANCHO,
    height: firmaAlto,
    borderColor: guia,
    borderWidth: 1.5,
    borderDashArray: [5, 4],
  });
  page.drawText("FIRMA DEL INSTRUCTOR — dentro de este recuadro", {
    x: 24,
    y: FIRMA_Y + firmaAlto / 2,
    size: 9.5,
    font: fontBold,
    color: guia,
  });

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generarDiplomaPdf, generarGuiaCoordenadas };
