// tools/build-logos.js
// Genera los SVG del logo de alfredopina.ai con las letras convertidas a curvas
// (así se ven igual en cualquier lado, sin depender de fuentes instaladas).
//
// Uso (desde la raíz del repo):   node tools/build-logos.js
// Salida: assets/img/brand/*.svg
//
// Fuentes: las mismas del sitio, ya incluidas en api/assets/fonts (Space Grotesk
// SemiBold para el nombre, JetBrains Mono Medium para la fórmula). Si existe
// api/assets/fonts/JetBrainsMono-MediumItalic.ttf se usa para el "fx" (cursiva
// real); si no, el "fx" se genera inclinando el glifo recto ~12°.
//
// Fuente de verdad del diseño: MANUAL_IDENTIDAD.md. Cualquier cambio de medidas o
// colores se hace aquí y se vuelve a correr; nunca se editan los SVG a mano.

const fs = require("fs");
const path = require("path");
const fontkit = require("../api/node_modules/@pdf-lib/fontkit");

const FONT_DIR = path.join(__dirname, "..", "api", "assets", "fonts");
const OUT_DIR = path.join(__dirname, "..", "assets", "img", "brand");
const load = (f) => fontkit.create(fs.readFileSync(path.join(FONT_DIR, f)));

const SG = load("SpaceGrotesk-SemiBold.ttf");
const MONO = load("JetBrainsMono-Medium.ttf");
const MONO_R = load("JetBrainsMono-Regular.ttf");
const ITALIC_FILE = path.join(FONT_DIR, "JetBrainsMono-MediumItalic.ttf");
const FX_FONT = fs.existsSync(ITALIC_FILE) ? load("JetBrainsMono-MediumItalic.ttf") : MONO;
const FX_SKEW = fs.existsSync(ITALIC_FILE) ? 0 : 0.21; // tan(12°)

// ── paletas (ver MANUAL_IDENTIDAD.md → Color) ──
const TEMAS = {
  claro: { bg: "#fbfcff", barra: "#eef2f8", azul: "#1f5fe0", tinta: "#0d1424", gris: "#586277", linea: "#0d1424", lineaOp: 0.16, tarjeta: "#ffffff" },
  oscuro: { bg: "#0a0d12", barra: "#10141b", azul: "#6b9fff", tinta: "#edf0f4", gris: "#a4acb9", linea: "#ffffff", lineaOp: 0.16, tarjeta: "#141a23" },
};
const HERRAMIENTAS = {
  excel: { nombre: "Excel", puro: "#22c55e", tinta: "#15803d" },
  powerbi: { nombre: "Power BI", puro: "#f2c94c", tinta: "#8a6a00" },
  powerapps: { nombre: "Power Apps", puro: "#c026d3", tinta: "#a21caf" },
  powerautomate: { nombre: "Power Automate", puro: "#06b6d4", tinta: "#0e7490" },
  ia: { nombre: "IA Aplicada", puro: "#a78bfa", tinta: "#6d3fd8" },
  ofimatica: { nombre: "Ofimática Básica", puro: "#f97316", tinta: "#b8500a" },
};

// ── texto → curvas ──
const f2 = (n) => (Math.round(n * 100) / 100).toString();

function medir(font, texto, size, tracking = 0) {
  const l = font.layout(texto);
  const s = size / font.unitsPerEm;
  return l.positions.reduce((w, p) => w + p.xAdvance * s + tracking * size, 0);
}

function trazo(font, texto, size, x, base, { tracking = 0, skew = 0 } = {}) {
  const l = font.layout(texto);
  const s = size / font.unitsPerEm;
  let cx = x;
  let d = "";
  l.glyphs.forEach((g, i) => {
    const p = l.positions[i];
    const ox = cx + p.xOffset * s;
    const oy = base - p.yOffset * s;
    const T = (px, py) => `${f2(ox + px * s + skew * py * s)} ${f2(oy - py * s)}`;
    for (const c of g.path.commands) {
      const a = c.args;
      if (c.command === "moveTo") d += `M${T(a[0], a[1])}`;
      else if (c.command === "lineTo") d += `L${T(a[0], a[1])}`;
      else if (c.command === "quadraticCurveTo") d += `Q${T(a[0], a[1])} ${T(a[2], a[3])}`;
      else if (c.command === "bezierCurveTo") d += `C${T(a[0], a[1])} ${T(a[2], a[3])} ${T(a[4], a[5])}`;
      else if (c.command === "closePath") d += "Z";
    }
    cx += p.xAdvance * s + tracking * size;
  });
  return d;
}

const relleno = (d, color) => `<path d="${d}" fill="${color}"/>`;
const svg = (w, h, titulo, cuerpo, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f2(w)} ${f2(h)}" width="${f2(w)}" height="${f2(h)}" role="img" aria-label="${titulo}"${extra}><title>${titulo}</title>${cuerpo}</svg>\n`;

// ── piezas ──
const NOMBRE = 120; // tamaño del nombre (em = 100)
const MONO_S = 90;
const FX_S = 95;
const TR = -0.015;

// cuadro de autorrelleno: anillo del color del fondo + cuadrito del color de acento
function manija(x, y, t, color, tam = 20, anillo = 5) {
  return `<rect x="${f2(x - anillo)}" y="${f2(y - anillo)}" width="${tam + anillo * 2}" height="${tam + anillo * 2}" fill="${t.bg}"/><rect x="${f2(x)}" y="${f2(y)}" width="${tam}" height="${tam}" fill="${color}"/>`;
}

// cursor de texto parpadeante — solo para la variante "-cursor.svg" que alimenta
// el GIF animado (ver build-logo-gif.js). El SVG normal nunca lo lleva.
function caretRect(t, xEnd, baseRow) {
  const gap = MONO_S * 0.16;
  const w = MONO_S * 0.11;
  const h = MONO_S * 1.05;
  const yTop = baseRow - h * 0.88;
  return `<rect x="${f2(xEnd + gap)}" y="${f2(yTop)}" width="${f2(w)}" height="${f2(h)}" fill="${t.azul}"/>`;
}

// barra de fórmula: caja + "fx" + divisor + contenido. `formula(x0)` devuelve {cuerpo, ancho}
function barra(t, { alto = 216, borde = 7, colorBorde, colorFx, seleccionada = true, formula, cursor = false }) {
  const azul = colorBorde || t.azul;
  const fx = colorFx || t.azul;
  const fxW = medir(FX_FONT, "fx", FX_S);
  const celda = 68 + fxW + 68;
  const divX = borde + celda;
  const x0 = divX + 3 + 70;
  const f = formula(x0);
  const ancho = x0 + f.ancho + 85 + borde;
  const grosor = seleccionada ? borde : 3;
  const colorLinea = seleccionada ? azul : t.linea;
  const opLinea = seleccionada ? 1 : t.lineaOp;
  let cuerpo = `<rect x="${f2(grosor / 2)}" y="${f2(grosor / 2)}" width="${f2(ancho - grosor)}" height="${f2(alto - grosor)}" rx="16" fill="${t.barra}" stroke="${colorLinea}" stroke-opacity="${opLinea}" stroke-width="${grosor}"/>`;
  cuerpo += relleno(trazo(FX_FONT, "fx", FX_S, borde + 68, 141, { skew: FX_SKEW }), fx);
  cuerpo += `<rect x="${f2(divX)}" y="${borde}" width="3" height="${alto - borde * 2}" fill="${t.linea}" fill-opacity="${t.lineaOp}"/>`;
  cuerpo += f.cuerpo;
  if (cursor) cuerpo += caretRect(t, x0 + f.ancho, 145);
  if (seleccionada) cuerpo += manija(ancho - 21, alto - 21, t, azul);
  return { cuerpo, ancho, alto };
}

const formulaPrincipal = (t) => (x0) => {
  const base = 145;
  const eq = medir(MONO, "=", MONO_S);
  const n1 = medir(SG, "alfredopina", NOMBRE, TR);
  const n2 = medir(SG, ".ai", NOMBRE, TR);
  const pr = medir(MONO, "()", MONO_S);
  let x = x0;
  let c = relleno(trazo(MONO, "=", MONO_S, x, base), t.gris);
  x += eq + 8;
  c += relleno(trazo(SG, "alfredopina", NOMBRE, x, base, { tracking: TR }), t.tinta);
  x += n1;
  c += relleno(trazo(SG, ".ai", NOMBRE, x, base, { tracking: TR }), t.azul);
  x += n2 + 8;
  c += relleno(trazo(MONO, "()", MONO_S, x, base), t.azul);
  return { cuerpo: c, ancho: eq + 8 + n1 + n2 + 8 + pr };
};

const formulaLiteral = (t) => (x0) => {
  const S = 100;
  const base = 143;
  const partes = [["=", t.gris], ["ALFREDOPINA", t.tinta], [".", t.azul], ["AI", t.tinta], ["()", t.azul]];
  let x = x0;
  let c = "";
  for (const [txt, col] of partes) {
    c += relleno(trazo(MONO, txt, S, x, base), col);
    x += medir(MONO, txt, S);
  }
  return { cuerpo: c, ancho: x - x0 };
};

function logoPrincipal(t, opts = {}) {
  const b = barra(t, { formula: formulaPrincipal(t), ...opts });
  return { ...b, w: b.ancho + 6, h: b.alto + 6 };
}
function logoLiteral(t) {
  const b = barra(t, { formula: formulaLiteral(t), seleccionada: false });
  return { ...b, w: b.ancho, h: b.alto };
}

function logoTooltip(t) {
  const p = logoPrincipal(t);
  const S = 33;
  const args = ["productividad", "datos", "automatización", "IA"]; // = el descriptor "Productividad con Datos · Automatización · IA"
  // texto del tooltip, tramo por tramo
  const tramos = [["ALFREDOPINA.AI", MONO, t.tinta], ["(", MONO_R, t.gris]];
  args.forEach((a, i) => {
    tramos.push([a, MONO, t.azul]);
    tramos.push([i < args.length - 1 ? "; " : ")", MONO_R, t.gris]);
  });
  const textoW = tramos.reduce((w, [txt, font]) => w + medir(font, txt, S), 0);
  const cajaW = textoW + S * 2;
  const cajaH = 89;
  const y = p.alto + 16;
  let c = p.cuerpo;
  c += `<rect x="1.5" y="${f2(y + 1.5)}" width="${f2(cajaW - 3)}" height="${cajaH - 3}" rx="10" fill="${t.tarjeta}" stroke="${t.linea}" stroke-opacity="${t.lineaOp}" stroke-width="3"/>`;
  let x = S;
  const base = y + cajaH / 2 + 0.35 * S;
  for (const [txt, font, col] of tramos) {
    c += relleno(trazo(font, txt, S, x, base), col);
    x += medir(font, txt, S);
  }
  return { cuerpo: c, w: Math.max(p.w, cajaW + 2), h: y + cajaH + 2 };
}

function logoCompacto(t) {
  const H = 135;
  const fxS = 100;
  const fxW = medir(FX_FONT, "fx", fxS);
  const divX = fxW + 55;
  const x0 = divX + 3 + 55;
  const S = 115;
  const n1 = medir(SG, "alfredopina", S, TR);
  const n2 = medir(SG, ".ai", S, TR);
  let c = relleno(trazo(FX_FONT, "fx", fxS, 0, 104, { skew: FX_SKEW }), t.azul);
  c += `<rect x="${f2(divX)}" y="0" width="3" height="${H}" fill="${t.linea}" fill-opacity="${t.lineaOp}"/>`;
  c += relleno(trazo(SG, "alfredopina", S, x0, 102, { tracking: TR }), t.tinta);
  c += relleno(trazo(SG, ".ai", S, x0 + n1, 102, { tracking: TR }), t.azul);
  return { cuerpo: c, w: x0 + n1 + n2, h: H };
}

// versión para diploma: el compacto (fx | nombre) con "by LifeZenTraining" debajo del nombre.
// "by LifeZenTraining" es una marca de TRANSICIÓN (se retira hacia septiembre de 2027): al retirarla,
// basta quitar la línea de abajo y volver a correr el script.
function logoDiploma(t) {
  const c = logoCompacto(t);
  const S = 115;
  const fxW = medir(FX_FONT, "fx", 100);
  const x0 = fxW + 55 + 3 + 55; // donde empieza el nombre en el compacto
  const tam = 34;
  const tr = 0.14;
  const y = c.h + 40;
  const cuerpo = c.cuerpo + relleno(trazo(MONO, "by LifeZenTraining", tam, x0, y, { tracking: tr }), t.gris);
  const ancho = Math.max(c.w, x0 + medir(MONO, "by LifeZenTraining", tam, tr));
  return { cuerpo, w: ancho, h: y + 14 };
}

// ícono: la celda con fx y su cuadro de autorrelleno
function cuerpoCelda(t, color) {
  const S = 46;
  const w = medir(FX_FONT, "fx", S);
  let c = `<rect x="3" y="3" width="94" height="94" rx="5" fill="none" stroke="${color}" stroke-width="6"/>`;
  c += relleno(trazo(FX_FONT, "fx", S, (100 - w) / 2, 50 + 0.36 * S, { skew: FX_SKEW }), color);
  c += manija(83.5, 83.5, t, color, 16, 3.5);
  return c;
}
function icono(t) {
  return { cuerpo: cuerpoCelda(t, t.azul), w: 106, h: 106 };
}
function iconoApp(t) {
  // fondo sólido para avatar/favicon: cuadrado redondeado de tinta con la celda en azul claro
  const o = TEMAS.oscuro;
  const escala = 3.2;
  const cel = 100 * escala;
  const off = (512 - cel) / 2;
  const cuerpo = `<rect width="512" height="512" rx="112" fill="#0d1424"/><rect x="1" y="1" width="510" height="510" rx="111" fill="none" stroke="#1d2530" stroke-width="2"/><g transform="translate(${f2(off - 6)} ${f2(off - 6)}) scale(${escala})">${cuerpoCelda({ ...o, bg: "#0d1424" }, o.azul)}</g>`;
  return { cuerpo, w: 512, h: 512 };
}

// ── escritura ──
const salidas = [];
function escribir(archivo, titulo, pieza) {
  const dir = path.dirname(path.join(OUT_DIR, archivo));
  fs.mkdirSync(dir, { recursive: true });
  const txt = svg(pieza.w, pieza.h, titulo, pieza.cuerpo);
  fs.writeFileSync(path.join(OUT_DIR, archivo), txt);
  salidas.push(archivo);
}

for (const [nombreTema, t] of Object.entries(TEMAS)) {
  escribir(`logo-principal-${nombreTema}.svg`, "alfredopina.ai", logoPrincipal(t));
  escribir(`logo-literal-${nombreTema}.svg`, "ALFREDOPINA.AI", logoLiteral(t));
  escribir(`logo-tooltip-${nombreTema}.svg`, "alfredopina.ai con argumentos", logoTooltip(t));
  escribir(`logo-compacto-${nombreTema}.svg`, "alfredopina.ai", logoCompacto(t));
  escribir(`icono-${nombreTema}.svg`, "fx", icono(t));
  for (const [clave, h] of Object.entries(HERRAMIENTAS)) {
    // sobre papel claro el "fx" usa la tinta (el color puro casi no se lee); sobre oscuro va el puro
    const fxColor = nombreTema === "claro" ? h.tinta : h.puro;
    escribir(`herramientas/logo-${clave}-${nombreTema}.svg`, `alfredopina.ai · ${h.nombre}`, logoPrincipal(t, { colorBorde: h.puro, colorFx: fxColor }));
  }
}
escribir("logo-diploma-claro.svg", "alfredopina.ai", logoDiploma(TEMAS.claro));
escribir("icono-app.svg", "fx", iconoApp());
escribir("favicon.svg", "fx", iconoApp());

// variantes "-cursor" — el cuadro que SÍ lleva el cursor parpadeante. No son un
// logo más: son el fotograma "encendido" del GIF animado (ver build-logo-gif.js).
for (const [nombreTema, t] of Object.entries(TEMAS)) {
  escribir(`logo-principal-${nombreTema}-cursor.svg`, "alfredopina.ai", logoPrincipal(t, { cursor: true }));
}

console.log(`${salidas.length} archivos en ${path.relative(process.cwd(), OUT_DIR)}${FX_SKEW ? " (fx inclinado, sin fuente cursiva)" : " (fx con cursiva real)"}`);
