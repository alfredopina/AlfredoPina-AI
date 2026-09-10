// Genera el PDF de una Cotización con pdf-lib — mismo enfoque que diploma-pdf.js
// (NO Puppeteer/navegador headless, no es confiable en managed functions).
//
// A diferencia del diploma (certificado horizontal, texto centrado), una
// Cotización es un documento formal izquierda-alineado con un desglose de
// temas de largo VARIABLE — por eso, a diferencia de Diplomas, la mayoría de
// los campos van en CAMPOS (posiciones fijas, para la guía de coordenadas)
// pero el desglose de temas se dibuja como una lista dinámica que arranca en
// un punto fijo (temas_inicio) y crece hacia abajo, una línea por tema.
//
// Plantilla de fondo — PLACEHOLDER mientras Alfredo diseña la definitiva
// (mismo criterio que Diplomas al inicio): página A4 vertical a 150dpi
// (1240×1754pt) para que sea fácil de diseñar en Canva/PowerPoint con el
// preset "A4". El fondo y las posiciones se ajustan sobre la marcha una vez
// que exista un diseño real — ver generarGuiaCoordenadas.
const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

const FONT_REGULAR_PATH = path.join(__dirname, "..", "assets", "fonts", "Inter-Regular.ttf");
const FONT_BOLD_PATH = path.join(__dirname, "..", "assets", "fonts", "Inter-Bold.ttf");

const AZUL_OSCURO = rgb(0.09, 0.16, 0.42);
const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const MARGEN_IZQ = 80;
const LINEA_TEMA = 26; // separación vertical entre líneas del desglose de temas

// posición (yTop, distancia desde arriba) y tamaño de cada campo — compartido
// entre generarCotizacionPdf y generarGuiaCoordenadas para que nunca se
// desalineen. "temas_inicio" no es un campo de texto único: marca dónde
// arranca la lista dinámica de temas (ver dibujarTemas).
const CAMPOS = [
  { id: "folio", yTop: 50, x: 900, size: 13, etiqueta: 'FOLIO — junto a "Cotización No."' },
  { id: "fecha_emision", yTop: 76, x: 900, size: 10, etiqueta: "FECHA DE EMISIÓN" },
  { id: "cliente", yTop: 190, x: MARGEN_IZQ, size: 18, etiqueta: "CLIENTE — nombre de la empresa" },
  { id: "contacto", yTop: 216, x: MARGEN_IZQ, size: 11, etiqueta: "CONTACTO — nombre de la persona (si hay)" },
  { id: "titulo", yTop: 280, x: MARGEN_IZQ, size: 20, etiqueta: "HERRAMIENTA + TEMARIO — título de la propuesta" },
  { id: "temas_inicio", yTop: 330, yFinal: 900, x: MARGEN_IZQ, etiqueta: "DESGLOSE DE TEMAS — área que crece hacia abajo, una línea por tema" },
  { id: "horas_totales", yTop: 900, x: MARGEN_IZQ, size: 13, etiqueta: "HORAS TOTALES" },
  { id: "modalidad", yTop: 928, x: MARGEN_IZQ, size: 11, etiqueta: "MODALIDAD" },
  { id: "participantes", yTop: 956, x: MARGEN_IZQ, size: 11, etiqueta: "PARTICIPANTES" },
  { id: "ciudad_sede", yTop: 984, x: MARGEN_IZQ, size: 11, etiqueta: "CIUDAD / SEDE" },
  { id: "fecha_tentativa", yTop: 1012, x: MARGEN_IZQ, size: 11, etiqueta: "FECHA TENTATIVA DE INICIO" },
  { id: "precio_final", yTop: 1090, x: MARGEN_IZQ, size: 30, etiqueta: "PRECIO FINAL — destacado" },
  { id: "fecha_vigencia", yTop: 1142, x: MARGEN_IZQ, size: 11, etiqueta: "VIGENCIA DE LA COTIZACIÓN" },
];

const campo = (id) => CAMPOS.find((c) => c.id === id);

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatFecha(fecha) {
  if (!fecha) return "—";
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

function formatPrecio(n) {
  return "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MXN";
}

async function generarCotizacionPdf({
  cliente, contacto, herramientaLabel, temarioTitulo, temas, horasTotales, precioFinal,
  modalidad, participantes, ciudadSede, fechaTentativa, fechaVigencia, folio, fondoBuffer,
}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const fondoImg = await pdfDoc.embedPng(fondoBuffer);
  page.drawImage(fondoImg, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });

  const fontBold = await pdfDoc.embedFont(fs.readFileSync(FONT_BOLD_PATH));
  const font = await pdfDoc.embedFont(fs.readFileSync(FONT_REGULAR_PATH));

  const izq = (texto, yTop, tamano, fuente, x) => {
    page.drawText(texto, { x: x !== undefined ? x : MARGEN_IZQ, y: PAGE_HEIGHT - yTop, size: tamano, font: fuente, color: AZUL_OSCURO });
  };

  const cFolio = campo("folio");
  izq(folio, cFolio.yTop, cFolio.size, fontBold, cFolio.x);
  const cFecha = campo("fecha_emision");
  izq(formatFecha(new Date()), cFecha.yTop, cFecha.size, font, cFecha.x);

  const cCliente = campo("cliente");
  izq(cliente, cCliente.yTop, cCliente.size, fontBold, cCliente.x);
  if (contacto) {
    const cContacto = campo("contacto");
    izq(contacto, cContacto.yTop, cContacto.size, font, cContacto.x);
  }

  const cTitulo = campo("titulo");
  izq(`${herramientaLabel} — ${temarioTitulo}`, cTitulo.yTop, cTitulo.size, fontBold, cTitulo.x);

  // desglose de temas: lista dinámica, una línea por tema, arrancando en
  // temas_inicio.yTop — si el temario trae muchos temas y se acerca al límite
  // de temas_inicio.yFinal, se sigue dibujando igual (no trunca), el diseño
  // real de Alfredo puede necesitar ajustar el espaciado si eso pasa seguido.
  const cTemas = campo("temas_inicio");
  let y = cTemas.yTop;
  (temas || []).forEach((t) => {
    page.drawText(`•  ${t.nombre}`, { x: cTemas.x, y: PAGE_HEIGHT - y, size: 12, font, color: AZUL_OSCURO });
    const horasTxt = `${t.horas} hr`;
    const anchoHoras = font.widthOfTextAtSize(horasTxt, 12);
    page.drawText(horasTxt, { x: PAGE_WIDTH - MARGEN_IZQ - anchoHoras, y: PAGE_HEIGHT - y, size: 12, font, color: AZUL_OSCURO });
    y += LINEA_TEMA;
  });

  const cHoras = campo("horas_totales");
  izq(`Horas totales: ${horasTotales} hr`, cHoras.yTop, cHoras.size, fontBold, cHoras.x);
  if (modalidad) {
    const cModalidad = campo("modalidad");
    izq(`Modalidad: ${modalidad}`, cModalidad.yTop, cModalidad.size, font, cModalidad.x);
  }
  if (participantes) {
    const cPart = campo("participantes");
    izq(`Participantes: ${participantes}`, cPart.yTop, cPart.size, font, cPart.x);
  }
  if (ciudadSede) {
    const cCiudad = campo("ciudad_sede");
    izq(`Ciudad / sede: ${ciudadSede}`, cCiudad.yTop, cCiudad.size, font, cCiudad.x);
  }
  if (fechaTentativa) {
    const cFechaTent = campo("fecha_tentativa");
    izq(`Fecha tentativa de inicio: ${fechaTentativa}`, cFechaTent.yTop, cFechaTent.size, font, cFechaTent.x);
  }

  const cPrecio = campo("precio_final");
  izq(formatPrecio(precioFinal), cPrecio.yTop, cPrecio.size, fontBold, cPrecio.x);
  const cVigencia = campo("fecha_vigencia");
  izq(`Vigente hasta: ${formatFecha(fechaVigencia)}`, cVigencia.yTop, cVigencia.size, font, cVigencia.x);

  return Buffer.from(await pdfDoc.save());
}

// Genera un PDF de referencia: la plantilla de fondo actual con un recuadro
// punteado + etiqueta en cada punto/área donde generarCotizacionPdf dibuja un
// dato — mismo espíritu que la guía de Diplomas.
async function generarGuiaCoordenadas({ fondoBuffer }) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const fondoImg = await pdfDoc.embedPng(fondoBuffer);
  page.drawImage(fondoImg, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });

  const fontBold = await pdfDoc.embedFont(fs.readFileSync(FONT_BOLD_PATH));
  const guia = rgb(0.93, 0.13, 0.55);

  CAMPOS.forEach((c) => {
    if (c.id === "temas_inicio") {
      const yTop = PAGE_HEIGHT - c.yTop;
      const yFinal = PAGE_HEIGHT - c.yFinal;
      page.drawRectangle({
        x: c.x, y: yFinal, width: PAGE_WIDTH - c.x * 2, height: yTop - yFinal,
        borderColor: guia, borderWidth: 1.5, borderDashArray: [5, 4],
      });
      page.drawText(c.etiqueta, { x: c.x, y: yTop + 5, size: 9.5, font: fontBold, color: guia });
      return;
    }
    const y = PAGE_HEIGHT - c.yTop;
    page.drawLine({ start: { x: 20, y }, end: { x: PAGE_WIDTH - 20, y }, thickness: 0.75, color: guia, dashArray: [6, 4] });
    page.drawLine({ start: { x: c.x - 9, y }, end: { x: c.x + 9, y }, thickness: 1.5, color: guia });
    page.drawLine({ start: { x: c.x, y: y - 9 }, end: { x: c.x, y: y + 9 }, thickness: 1.5, color: guia });
    page.drawText(c.etiqueta, { x: 24, y: y + 5, size: 9.5, font: fontBold, color: guia });
  });

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generarCotizacionPdf, generarGuiaCoordenadas, PAGE_WIDTH, PAGE_HEIGHT };
