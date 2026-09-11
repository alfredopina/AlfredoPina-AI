// Genera el PDF de una Cotización con pdfmake — a diferencia de Diplomas
// (pdf-lib + plantilla de fondo diseñada en Canva/PowerPoint), aquí el diseño
// completo vive en código: no hay imagen de fondo que Alfredo tenga que subir
// ni coordenadas x/y que ajustar a mano. Sigue sin usar Puppeteer/navegador —
// pdfmake no lo necesita, es seguro en managed functions.
//
// 3 páginas: Portada, Temario (con barra de datos por tema, se paginan solas
// si el temario es largo — pdfmake corta contenido que no cabe sin que haya
// que calcularlo a mano) y Propuesta/Términos/Contacto.
//
// Réplica del mockup aprobado ("Cotización rediseñada", artifact v4) dentro
// de lo que pdfmake permite — ver las simplificaciones documentadas junto a
// cada técnica: sin blur real (glow = óvalo plano de color muy claro), sin
// conic-gradient (marco de foto = borde sólido), sin textura de cuadrícula.
const path = require("path");
const pdfMake = require("pdfmake");

const FONTS_DIR = path.join(__dirname, "..", "assets", "fonts");
const IMG_DIR = path.join(__dirname, "..", "assets", "img");
const FIRMA_PATH = path.join(IMG_DIR, "firma-ap.png");
const FOTO_PATH = path.join(IMG_DIR, "alfredo-work-photo.png");

// registrado una sola vez por proceso — pdfMake es un singleton (mismo
// require() en cualquier Function de este proceso), no hace falta repetirlo
// por cada PDF.
pdfMake.setFonts({
  Inter: {
    normal: path.join(FONTS_DIR, "Inter-Regular.ttf"),
    bold: path.join(FONTS_DIR, "Inter-Bold.ttf"),
    italics: path.join(FONTS_DIR, "Inter-Regular.ttf"),
    bolditalics: path.join(FONTS_DIR, "Inter-Bold.ttf"),
  },
  SpaceGrotesk: {
    normal: path.join(FONTS_DIR, "SpaceGrotesk-Medium.ttf"),
    bold: path.join(FONTS_DIR, "SpaceGrotesk-SemiBold.ttf"),
    italics: path.join(FONTS_DIR, "SpaceGrotesk-Medium.ttf"),
    bolditalics: path.join(FONTS_DIR, "SpaceGrotesk-SemiBold.ttf"),
  },
  JetBrainsMono: {
    normal: path.join(FONTS_DIR, "JetBrainsMono-Regular.ttf"),
    bold: path.join(FONTS_DIR, "JetBrainsMono-Medium.ttf"),
    italics: path.join(FONTS_DIR, "JetBrainsMono-Regular.ttf"),
    bolditalics: path.join(FONTS_DIR, "JetBrainsMono-Medium.ttf"),
  },
});
pdfMake.setLocalAccessPolicy(() => true); // solo lee las fuentes/imágenes propias de este proyecto
pdfMake.setUrlAccessPolicy(() => false); // nunca descarga recursos remotos

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const PAD_X = 40;
const CONTENT_W = PAGE_W - PAD_X * 2;

// paleta — colores de marca (fills/barras) + su versión "segura para texto"
// sobre fondo claro (algunos, como el amarillo de Power BI, no tienen
// contraste suficiente para usarse como texto). Ver CLAUDE.md.
const TOOL_COLORS = {
  excel: { fill: "#22c55e", text: "#15803d" },
  powerbi: { fill: "#f2c94c", text: "#8a6d1a" },
  powerapps: { fill: "#c026d3", text: "#a21caf" },
  powerautomate: { fill: "#06b6d4", text: "#0e7490" },
  ia: { fill: "#a78bfa", text: "#7c3aed" },
  ofimatica: { fill: "#f97316", text: "#c2410c" },
};
const AZUL = "#3d7fff";
const AZUL_TEXT = "#2657c9";
const INK = "#181c24";
const INK_DIM = "#5b6270";
const INK_FAINT = "#8b93a1";
const RULE = "#e0e3ea";
const PAPER_2 = "#eef0f6";
const PAPER_3 = "#e3e7f0";

const NIVEL_LABEL = { 1: "Básico", 2: "Intermedio", 3: "Avanzado" };

const BIO =
  "Instructor y consultor en Excel, Power BI, Power Platform e IA Aplicada. 15+ años ayudando a equipos a dejar atrás los reportes manuales y a hablar el idioma de los datos — más de 150 empresas y 10,000 profesionistas capacitados en Monterrey, México y Latinoamérica.";
const CERTIFICACIONES = ["Power BI Data Analyst Associate", "AI Business Professional", "MOS Excel"];
const TERMINOS = [
  "Horario a definir, mínimo 4 horas a la semana en 1 o 2 sesiones.",
  "Las sesiones en línea se realizan vía Google Meet, Zoom o Teams.",
  "El precio aplica igual para modalidad presencial o virtual.",
  "La sesión de proyecto final es virtual, sin costo adicional.",
  "Cotización realizada como persona física con actividad empresarial — monto antes de impuestos, aplican IVA e ISR y retenciones conforme a la ley.",
  "Vigencia de 15 días hábiles después de emitida.",
];
const TELEFONO = "(811) 725 5937";
const CIERRE_MARCA = "Yo invito el café.";

function getContactEmail() {
  const email = process.env.COTIZACION_CONTACT_EMAIL;
  if (!email) throw new Error("Falta configurar la Application Setting COTIZACION_CONTACT_EMAIL.");
  return email;
}

// ── color helpers ──
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function rgbToHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
// mezcla hex con blanco — usado para los fondos "soft" de pills/badges
// (equivalente a pintar el color de marca al 12-14% de opacidad sobre blanco)
function tint(hex, strength) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(255 * (1 - strength) + r * strength, 255 * (1 - strength) + g * strength, 255 * (1 - strength) + b * strength);
}
function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}
function toolColors(herramienta) {
  return TOOL_COLORS[herramienta] || { fill: AZUL, text: AZUL_TEXT };
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function formatFecha(fecha) {
  if (!fecha) return "—";
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
function formatPrecio(n) {
  return "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MXN";
}

// ── construcciones reusables (tablas de una celda sin bordes reales — la
// forma idiomática en pdfmake de pintar una "pastilla"/"caja" con fondo de
// color, ya que un `canvas` no compone bien con texto que fluye encima) ──

// caja sin bordes con fondo de color — pills/badges
function pill(content, { fillColor, widths = ["auto"], padding = [10, 6, 10, 6] } = {}) {
  return {
    table: { widths, body: [[Object.assign({ stack: Array.isArray(content) ? content : [content], margin: padding }, fillColor ? { fillColor } : {})]] },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
  };
}

// caja con borde delgado (chip, cert-pill, tabla del "about")
function boxBorde(content, { borderColor = RULE, borderWidth = 1, widths = ["auto"], padding = [10, 8, 10, 8] } = {}) {
  return {
    table: { widths, body: [[{ stack: Array.isArray(content) ? content : [content], margin: padding }]] },
    layout: {
      hLineWidth: () => borderWidth, vLineWidth: () => borderWidth, hLineColor: () => borderColor, vLineColor: () => borderColor,
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
  };
}

// caja con franja de color a la izquierda — el callout "Dirigido a/Objetivo"
function calloutBorde(rows, colorFranja) {
  return {
    table: {
      widths: [3, "*"],
      body: [[
        { text: "", fillColor: colorFranja },
        { stack: rows, fillColor: PAPER_2, margin: [14, 12, 14, 12] },
      ]],
    },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
  };
}

// pastilla de 2 tonos, estilo "fx =FUNCION( args )" — mismo motivo visual que
// ya usa el sitio en Hero/Contacto/Cursos
function fxPill(expresionRuns, toolText) {
  return {
    table: {
      widths: ["auto", "auto"],
      body: [[
        { text: "fx", fillColor: tint(AZUL, 0.13), font: "JetBrainsMono", bold: true, italics: true, fontSize: 10, color: AZUL_TEXT, margin: [10, 7, 10, 7], noWrap: true },
        { text: expresionRuns, margin: [12, 7, 12, 7], noWrap: true },
      ]],
    },
    layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => tint(AZUL, 0.35), vLineColor: () => tint(AZUL, 0.35), paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
  };
}

// franja de acento degradada (herramienta → azul) — pdfmake no dibuja
// degradados nativos en canvas, se aproxima con rectángulos angostos
// interpolando el color a mano. 24 pasos en vez de 3 — con tan poco ancho
// por segmento (~25pt) el ojo ya no distingue el escalón, se lee como un
// degradado suave real.
function franjaAcento(colorHerramienta) {
  const STEPS = 24;
  const segW = PAGE_W / STEPS;
  const rects = [];
  for (let i = 0; i < STEPS; i++) {
    const t = i / (STEPS - 1);
    rects.push({ type: "rect", x: i * segW, y: 0, w: segW + 1, h: 5, color: lerpColor(colorHerramienta, AZUL, t) });
  }
  return { canvas: rects, absolutePosition: { x: 0, y: 0 } };
}

// marcas de esquina — 4 ángulos grises, estilo plano técnico (decorativo,
// barato de dibujar, presente en las 3 páginas del mockup)
function marcasEsquina() {
  const m = 16;
  const len = 12;
  const seg = (x, y, dx, dy) => [
    { type: "line", x1: x, y1: y, x2: x + dx * len, y2: y, lineColor: RULE, lineWidth: 1.2 },
    { type: "line", x1: x, y1: y, x2: x, y2: y + dy * len, lineColor: RULE, lineWidth: 1.2 },
  ];
  return {
    canvas: [
      ...seg(m, m, 1, 1),
      ...seg(PAGE_W - m, m, -1, 1),
      ...seg(m, PAGE_H - m, 1, -1),
      ...seg(PAGE_W - m, PAGE_H - m, -1, -1),
    ],
    absolutePosition: { x: 0, y: 0 },
  };
}

// acento de esquina — reemplaza el "glow" circular de la primera pasada:
// Alfredo lo sintió fuera de lugar porque todo el resto del documento es
// rectilíneo (pills, tabla, marcas de esquina, cuadrícula) y el círculo era
// la única forma geométrica distinta. Mismo truco de "varios contornos
// concéntricos, del más grande/tenue al más chico/marcado" pero con
// cuadrados de esquina redondeada en vez de círculos — encaja con el resto
// del lenguaje visual del documento. Solo contorno (sin relleno), se recorta
// contra la esquina superior derecha de la página.
function acentoEsquina(colorPuro) {
  const cx = PAGE_W - 30;
  const cy = 110;
  const cuadros = [
    { h: 200, fuerza: 0.18, grosor: 1.5 },
    { h: 150, fuerza: 0.28, grosor: 1.8 },
    { h: 100, fuerza: 0.4, grosor: 2.2 },
    { h: 58, fuerza: 0.55, grosor: 2.6 },
  ];
  return {
    canvas: cuadros.map(({ h, fuerza, grosor }) => ({
      type: "rect", x: cx - h, y: cy - h, w: h * 2, h: h * 2, r: h * 0.18,
      lineColor: tint(colorPuro, fuerza), lineWidth: grosor,
    })),
    absolutePosition: { x: 0, y: 0 },
  };
}

// cuadrícula sutil de fondo — mismo motivo visual que `.grid-bg` ya usa el
// sitio público, aplicada vía el callback `background` de pdfmake (se
// repite sola en cada página). El color queda deliberadamente muy claro:
// como se dibuja ANTES que el resto del contenido, cualquier texto/tabla/
// caja que caiga encima la tapa sin problema — solo se nota en las zonas
// vacías de la página, que es justo donde se necesita textura.
const GRID_LINE = "#e6e9f0";
const GRID_STEP = 30;
function fondoCuadricula(pageSize) {
  const lineas = [];
  for (let x = 0; x <= pageSize.width; x += GRID_STEP) {
    lineas.push({ type: "line", x1: x, y1: 0, x2: x, y2: pageSize.height, lineColor: GRID_LINE, lineWidth: 0.5 });
  }
  for (let y = 0; y <= pageSize.height; y += GRID_STEP) {
    lineas.push({ type: "line", x1: 0, y1: y, x2: pageSize.width, y2: y, lineColor: GRID_LINE, lineWidth: 0.5 });
  }
  return { canvas: lineas };
}

// ── PÁGINA 1 — Portada ──
function construirPortada(datos) {
  const { cliente, contacto, herramientaLabel, temarioTitulo, horasTotales, participantes, folio, dirigidoA, objetivo } = datos;
  const tc = toolColors(datos.herramienta);
  const soft = tint(tc.fill, 0.13);

  const briefRows = [];
  if (dirigidoA) briefRows.push({ columns: [{ text: "DIRIGIDO A", font: "JetBrainsMono", fontSize: 8, color: INK_FAINT, width: 72 }, { text: dirigidoA, font: "Inter", fontSize: 10, color: INK_DIM, width: "*" }] });
  if (objetivo) briefRows.push({ columns: [{ text: "OBJETIVO", font: "JetBrainsMono", fontSize: 8, color: INK_FAINT, width: 72, margin: briefRows.length ? [0, 8, 0, 0] : [0, 0, 0, 0] }, { text: objetivo, font: "Inter", fontSize: 10, color: INK_DIM, width: "*", margin: briefRows.length ? [0, 8, 0, 0] : [0, 0, 0, 0] }] });

  const chipLineas = [{ text: `${horasTotales} hr totales`, font: "JetBrainsMono", fontSize: 8.5, color: INK_DIM, noWrap: true }];
  if (participantes) chipLineas.push({ text: `Grupo: ${participantes}`, font: "JetBrainsMono", fontSize: 8.5, color: INK_DIM, margin: [0, 4, 0, 0], noWrap: true });

  // Cuando no hay caja de Objetivo/Dirigido a (temario Personalizado, que no
  // tiene ese dato) queda un hueco grande entre "Att. contacto" y la pastilla
  // fx del pie, fija cerca del borde inferior — se compensa bajando el
  // bloque de título/cliente para que el vacío se reparta parejo en vez de
  // quedar todo junto arriba. No es centrado real (pdfmake no calcula
  // espacio sobrante), es un ajuste fijo que se ve bien en el caso corto sin
  // afectar el caso normal (con Objetivo/Dirigido a el offset es 0).
  const offsetSinBrief = briefRows.length ? 0 : 130;

  return [
    franjaAcento(tc.fill),
    marcasEsquina(),
    acentoEsquina(tc.fill),
    {
      stack: [
        // ── encabezado: logo + folio ──
        {
          columns: [
            { width: "*", columns: [{ image: "firma", width: 20, margin: [0, 2, 8, 0] }, { text: "ALFREDO PIÑA", font: "JetBrainsMono", fontSize: 8.5, color: INK_FAINT, margin: [0, 7, 0, 0], noWrap: true }] },
            {
              width: "auto",
              stack: [
                { text: "FOLIO", font: "JetBrainsMono", fontSize: 7.5, color: INK_FAINT, alignment: "right", noWrap: true },
                { text: folio, font: "JetBrainsMono", fontSize: 11, bold: true, color: AZUL_TEXT, alignment: "right", margin: [0, 3, 0, 0], noWrap: true },
                { text: formatFecha(new Date()), font: "JetBrainsMono", fontSize: 8, color: INK_FAINT, alignment: "right", margin: [0, 4, 0, 0], noWrap: true },
              ],
            },
          ],
        },
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_W, y2: 0, lineColor: RULE, lineWidth: 1 }], margin: [0, 18, 0, 0] },

        // ── bloque de título con chip flotante ──
        {
          columns: [
            {
              width: "*",
              stack: [
                pill({ text: `${herramientaLabel} · ${temarioTitulo}`.toUpperCase(), font: "JetBrainsMono", fontSize: 9, color: tc.text, noWrap: true }, { fillColor: soft, padding: [12, 6, 12, 6] }),
                { text: temarioTitulo, font: "SpaceGrotesk", bold: true, fontSize: 31, color: INK, margin: [0, 14, 0, 0], lineHeight: 1.08 },
              ],
              margin: [0, 34 + offsetSinBrief, 0, 0],
            },
            { width: "auto", stack: [boxBorde(chipLineas, { padding: [10, 8, 10, 8] })], margin: [10, 36 + offsetSinBrief, 0, 0] },
          ],
        },

        // ── cliente ──
        {
          stack: [
            { text: "PREPARADO PARA", font: "JetBrainsMono", fontSize: 8.5, color: INK_FAINT, noWrap: true },
            { text: cliente, font: "SpaceGrotesk", bold: true, fontSize: 22, color: INK, margin: [0, 4, 0, 0] },
            contacto ? { text: `Att. ${contacto}`, font: "Inter", fontSize: 10.5, color: INK_DIM, margin: [0, 2, 0, 0] } : null,
          ].filter(Boolean),
          margin: [0, 30, 0, 0],
        },

        briefRows.length ? Object.assign(calloutBorde(briefRows, tc.fill), { margin: [0, 20, 0, 0] }) : null,
      ].filter(Boolean),
      margin: [PAD_X, 30, PAD_X, 0],
    },
    {
      stack: [fxPill([
        { text: "=COTIZAR( ", font: "JetBrainsMono", fontSize: 9.5, color: INK_DIM },
        { text: cliente, font: "JetBrainsMono", fontSize: 9.5, color: tc.text, bold: true },
        { text: ", ", font: "JetBrainsMono", fontSize: 9.5, color: INK_DIM },
        { text: temarioTitulo, font: "JetBrainsMono", fontSize: 9.5, color: tc.text, bold: true },
        { text: ", ", font: "JetBrainsMono", fontSize: 9.5, color: INK_DIM },
        { text: `${horasTotales} hr )`, font: "JetBrainsMono", fontSize: 9.5, color: tc.text, bold: true },
      ], tc.text)],
      // OJO: pdfmake calcula si una tabla con absolutePosition "cabe" en la
      // página usando su altura natural + esta y — si y queda a menos de esa
      // altura del borde inferior, la manda entera a una página nueva en vez
      // de solo posicionarla ahí (bug real, encontrado probando: y = PAGE_H
      // - 66 disparaba una página 2 en blanco; con margen de sobra ya no).
      absolutePosition: { x: PAD_X, y: PAGE_H - 100 },
    },
  ];
}

// ── PÁGINA 2 — Temario ──
function construirTemario(datos) {
  const { herramienta, temas, horasTotales } = datos;
  const tc = toolColors(herramienta);

  const filas = (temas || []).map((t, i) => {
    const horas = Number(t.horas) || 0;
    const pct = horasTotales > 0 ? Math.max(0, Math.min(1, horas / horasTotales)) : 0;
    return {
      unbreakable: true,
      margin: [0, i === 0 ? 0 : 16, 0, 0],
      stack: [
        {
          columns: [
            { text: t.nombre, font: "SpaceGrotesk", bold: true, fontSize: 12.5, color: INK, width: "*" },
            {
              text: [
                { text: `${(NIVEL_LABEL[t.nivel] || "").toUpperCase()}   `, font: "JetBrainsMono", fontSize: 8, color: INK_FAINT },
                { text: `${horas} hr`, font: "JetBrainsMono", fontSize: 11, bold: true, color: INK },
              ],
              width: "auto",
              alignment: "right",
              noWrap: true,
            },
          ],
        },
        t.descripcion ? { text: t.descripcion, font: "Inter", fontSize: 9.7, color: INK_DIM, margin: [0, 5, 0, 0] } : null,
        {
          canvas: [
            { type: "rect", x: 0, y: 0, w: CONTENT_W, h: 4, r: 2, color: PAPER_3 },
            { type: "rect", x: 0, y: 0, w: Math.max(6, CONTENT_W * pct), h: 4, r: 2, color: tc.fill },
          ],
          margin: [0, 9, 0, 0],
        },
        i < (temas || []).length - 1 ? { canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_W, y2: 0, lineColor: RULE, lineWidth: 1 }], margin: [0, 15, 0, 0] } : null,
      ].filter(Boolean),
    };
  });

  // el resumen "Horas totales" se agrupa (unbreakable) junto con el ÚLTIMO
  // tema — si no, cuando el temario llena la página casi exacta, pdfmake
  // manda solo esta línea de resumen a una página nueva, casi en blanco
  // (encontrado probando con un temario de 10 temas).
  if (filas.length) {
    const ultima = filas[filas.length - 1];
    ultima.stack.push(
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_W, y2: 0, lineColor: INK, lineWidth: 1.5 }], margin: [0, 8, 0, 0] },
      {
        columns: [
          { text: "Horas totales", font: "SpaceGrotesk", bold: true, fontSize: 13, color: INK, width: "*" },
          { text: `${horasTotales} hr`, font: "JetBrainsMono", fontSize: 15, color: AZUL_TEXT, alignment: "right", width: "auto", noWrap: true },
        ],
        margin: [0, 14, 0, 0],
      }
    );
  }

  // Un temario de 3 temas o menos deja media página en blanco (el contenido
  // se queda pegado arriba, no hay forma de que pdfmake calcule el sobrante
  // y centre solo). Mismo criterio que en la portada: bajar el bloque un
  // tanto fijo en vez de dejarlo huérfano arriba — no es centrado real, pero
  // reparte el vacío de forma que se sienta intencional.
  const offsetTemarioCorto = (temas || []).length <= 3 ? 90 : 0;

  return [
    franjaAcento(tc.fill),
    marcasEsquina(),
    {
      stack: [
        {
          columns: [
            { text: "Contenido del programa", font: "SpaceGrotesk", bold: true, fontSize: 17, color: INK, width: "*" },
            { width: "auto", stack: [pill({ text: `${horasTotales} hr totales`, font: "JetBrainsMono", fontSize: 9, color: tc.text, noWrap: true }, { fillColor: tint(tc.fill, 0.13), padding: [11, 5, 11, 5] })] },
          ],
        },
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_W, y2: 0, lineColor: RULE, lineWidth: 1 }], margin: [0, 14, 0, 0] },
        ...filas.map((f, i) => (i === 0 ? Object.assign({}, f, { margin: [0, 18, 0, 0] }) : f)),
      ],
      margin: [PAD_X, 28 + offsetTemarioCorto, PAD_X, 34],
      pageBreak: "before",
    },
  ];
}

// ── PÁGINA 3 — Propuesta, términos y contacto ──
function construirPropuesta(datos) {
  const {
    herramienta, temarioTitulo, horasTotales, precioFinal, modalidad, participantes,
    ciudadSede, fechaVigencia,
  } = datos;
  const tc = toolColors(herramienta);
  const contactEmail = getContactEmail();

  const descripcionServicio = `${temarioTitulo} — ${modalidad || "Presencial o virtual"}, ${horasTotales} hr${participantes ? `, ${participantes.toLowerCase()} participantes` : ""}.`;

  const mitad = Math.ceil(TERMINOS.length / 2);
  const terminoItem = (t) => ({ text: [{ text: "■  ", font: "Inter", fontSize: 6, color: tc.text }, { text: t, font: "Inter", fontSize: 9.3, color: INK_DIM, lineHeight: 1.15 }], margin: [0, 0, 0, 8] });

  return [
    franjaAcento(tc.fill),
    marcasEsquina(),
    {
      stack: [
        { text: "Propuesta económica", font: "SpaceGrotesk", bold: true, fontSize: 17, color: INK },
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_W, y2: 0, lineColor: RULE, lineWidth: 1 }], margin: [0, 14, 0, 0] },

        {
          table: {
            widths: ["20%", "55%", "25%"],
            body: [
              [
                { text: "SERVICIO", font: "JetBrainsMono", fontSize: 8.5, color: INK_FAINT },
                { text: "DESCRIPCIÓN", font: "JetBrainsMono", fontSize: 8.5, color: INK_FAINT },
                { text: "PRECIO", font: "JetBrainsMono", fontSize: 8.5, color: INK_FAINT, alignment: "right" },
              ],
              [
                { text: temarioTitulo, font: "Inter", bold: true, fontSize: 10.5, color: INK },
                { text: descripcionServicio, font: "Inter", fontSize: 9.7, color: INK_DIM },
                { text: formatPrecio(precioFinal), font: "JetBrainsMono", fontSize: 10.5, color: INK, alignment: "right" },
              ],
            ],
          },
          layout: { hLineWidth: (i) => (i === 1 || i === 2 ? 1 : 0), vLineWidth: () => 0, hLineColor: () => RULE, paddingTop: () => 6, paddingBottom: () => 6, paddingLeft: () => 0, paddingRight: () => 0 },
          margin: [0, 18, 0, 0],
        },

        {
          columns: [
            { stack: [{ text: "MODALIDAD", font: "JetBrainsMono", fontSize: 8, color: INK_FAINT }, { text: modalidad || "—", font: "Inter", fontSize: 10, color: INK, margin: [0, 3, 0, 0] }] },
            { stack: [{ text: "PARTICIPANTES", font: "JetBrainsMono", fontSize: 8, color: INK_FAINT }, { text: participantes || "—", font: "Inter", fontSize: 10, color: INK, margin: [0, 3, 0, 0] }] },
            { stack: [{ text: "CIUDAD / SEDE", font: "JetBrainsMono", fontSize: 8, color: INK_FAINT }, { text: ciudadSede || "—", font: "Inter", fontSize: 10, color: INK, margin: [0, 3, 0, 0] }] },
            { stack: [{ text: "VIGENCIA", font: "JetBrainsMono", fontSize: 8, color: INK_FAINT }, { text: `Hasta ${formatFecha(fechaVigencia)}`, font: "Inter", fontSize: 10, color: INK, margin: [0, 3, 0, 0] }] },
          ],
          columnGap: 12,
          margin: [0, 18, 0, 0],
        },

        Object.assign(
          pill(
            { columns: [{ text: "TOTAL", font: "JetBrainsMono", fontSize: 10, bold: true, color: INK_DIM, width: "*" }, { text: formatPrecio(precioFinal), font: "SpaceGrotesk", bold: true, fontSize: 23, color: AZUL_TEXT, alignment: "right", width: "auto" }] },
            { fillColor: lerpColor(tint(AZUL, 0.13), tint(tc.fill, 0.13), 0.5), padding: [18, 14, 18, 14], widths: ["*"] }
          ),
          { margin: [0, 18, 0, 0] }
        ),

        Object.assign(
          pill(
            [
              { text: "TÉRMINOS Y CONDICIONES", font: "JetBrainsMono", fontSize: 8.5, color: INK_FAINT, margin: [0, 0, 0, 10] },
              { columns: [{ stack: TERMINOS.slice(0, mitad).map(terminoItem) }, { stack: TERMINOS.slice(mitad).map(terminoItem) }], columnGap: 18 },
            ],
            { fillColor: PAPER_2, padding: [18, 16, 18, 6], widths: ["*"] }
          ),
          { margin: [0, 18, 0, 0] }
        ),

        {
          columns: [
            { width: "auto", stack: [boxBorde({ image: "foto", width: 40 }, { borderColor: tc.fill, borderWidth: 2, widths: [40], padding: [0, 0, 0, 0] })] },
            {
              width: "*",
              stack: [
                { text: "Alfredo Piña", font: "SpaceGrotesk", bold: true, fontSize: 13.5, color: INK },
                { text: BIO, font: "Inter", fontSize: 9.3, color: INK_DIM, margin: [0, 4, 0, 8], lineHeight: 1.3 },
                { columns: CERTIFICACIONES.map((c) => boxBorde({ text: c, font: "JetBrainsMono", fontSize: 7.5, color: INK_FAINT, noWrap: true }, { padding: [8, 4, 8, 4], widths: ["auto"] })), columnGap: 6 },
              ],
              margin: [16, 0, 0, 0],
            },
          ],
          margin: [0, 20, 0, 0],
        },

        { canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_W, y2: 0, lineColor: RULE, lineWidth: 1 }], margin: [0, 22, 0, 0] },
        {
          columns: [
            {
              width: "*",
              stack: [
                { text: CIERRE_MARCA, font: "SpaceGrotesk", fontSize: 12.5, color: INK, margin: [0, 0, 0, 8] },
                fxPill([
                  { text: "=CONTACTAR( ", font: "JetBrainsMono", fontSize: 9, color: INK_DIM },
                  { text: contactEmail, font: "JetBrainsMono", fontSize: 9, color: tc.text, bold: true },
                  { text: ", ", font: "JetBrainsMono", fontSize: 9, color: INK_DIM },
                  { text: TELEFONO, font: "JetBrainsMono", fontSize: 9, color: tc.text, bold: true },
                  { text: " )", font: "JetBrainsMono", fontSize: 9, color: INK_DIM },
                ], tc.text),
              ],
            },
            {
              width: "auto",
              stack: [{ image: "firma", width: 46 }, { text: "© 2026 Alfredo Piña · alfredopina.ai", font: "JetBrainsMono", fontSize: 7.5, color: INK_FAINT, margin: [0, 4, 0, 0], noWrap: true }],
              alignment: "right",
            },
          ],
          margin: [0, 14, 0, 0],
        },
      ],
      margin: [PAD_X, 28, PAD_X, 30],
      pageBreak: "before",
    },
  ];
}

async function generarCotizacionPdf({
  cliente, contacto, herramienta, herramientaLabel, temarioTitulo, temas,
  horasTotales, precioFinal, modalidad, participantes, ciudadSede,
  fechaTentativa, fechaVigencia, folio, dirigidoA, objetivo,
}) {
  const datos = {
    cliente, contacto, herramienta, herramientaLabel, temarioTitulo, temas: temas || [],
    horasTotales: Number(horasTotales) || 0, precioFinal, modalidad, participantes, ciudadSede,
    fechaTentativa, fechaVigencia, folio, dirigidoA, objetivo,
  };

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [0, 0, 0, 0],
    defaultStyle: { font: "Inter", fontSize: 10, color: INK },
    images: { firma: FIRMA_PATH, foto: FOTO_PATH },
    background: (currentPage, pageSize) => fondoCuadricula(pageSize),
    content: [...construirPortada(datos), ...construirTemario(datos), ...construirPropuesta(datos)],
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);
  return pdfDoc.getBuffer();
}

module.exports = { generarCotizacionPdf };
