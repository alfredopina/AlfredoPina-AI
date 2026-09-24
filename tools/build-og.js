// tools/build-og.js
// Genera la imagen social (og-image.png, 1200×630) y el set de favicons a partir del logo v2.
//
// Uso (desde la raíz del repo):   node tools/build-og.js
// Requiere "sharp" (solo herramienta de build, no se despliega): npm install --no-save sharp
// o apuntar NODE_PATH a una carpeta node_modules que lo tenga.
//
// El texto se convierte a curvas con fontkit (igual que build-logos.js), así el resultado
// no depende de las fuentes instaladas en la máquina.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const fontkit = require("../api/node_modules/@pdf-lib/fontkit");

const BRAND = path.join(__dirname, "..", "assets", "img", "brand");
const FONT_DIR = path.join(__dirname, "..", "api", "assets", "fonts");
const load = (f) => fontkit.create(fs.readFileSync(path.join(FONT_DIR, f)));
const SG = load("SpaceGrotesk-SemiBold.ttf");
const MONO = load("JetBrainsMono-Medium.ttf");

const f2 = (n) => (Math.round(n * 100) / 100).toString();

function medir(font, texto, size) {
  const l = font.layout(texto);
  const s = size / font.unitsPerEm;
  return l.positions.reduce((a, p) => a + p.xAdvance * s, 0);
}
function trazo(font, texto, size, x, base) {
  const l = font.layout(texto);
  const s = size / font.unitsPerEm;
  let cx = x;
  let d = "";
  l.glyphs.forEach((g, i) => {
    const p = l.positions[i];
    const ox = cx + p.xOffset * s;
    const oy = base - p.yOffset * s;
    const T = (px, py) => `${f2(ox + px * s)} ${f2(oy - py * s)}`;
    for (const c of g.path.commands) {
      const a = c.args;
      if (c.command === "moveTo") d += `M${T(a[0], a[1])}`;
      else if (c.command === "lineTo") d += `L${T(a[0], a[1])}`;
      else if (c.command === "quadraticCurveTo") d += `Q${T(a[0], a[1])} ${T(a[2], a[3])}`;
      else if (c.command === "bezierCurveTo") d += `C${T(a[0], a[1])} ${T(a[2], a[3])} ${T(a[4], a[5])}`;
      else if (c.command === "closePath") d += "Z";
    }
    cx += p.xAdvance * s;
  });
  return d;
}

// ── og-image.png ──
const W = 1200, H = 630;
const logoSvg = fs.readFileSync(path.join(BRAND, "logo-principal-oscuro.svg"), "utf8");
const logoB64 = Buffer.from(logoSvg).toString("base64");
const LOGO_W = 760, LOGO_H = LOGO_W * (222 / 1384.56);

const partes = [["Tu productividad tiene ", "#edf0f4"], ["fórmula", "#6b9fff"], [".", "#edf0f4"]];
let size = 60;
const total = () => partes.reduce((a, [t]) => a + medir(SG, t, size), 0);
while (total() > 1000) size -= 1;
let x = (W - total()) / 2;
let tagline = "";
for (const [t, color] of partes) {
  tagline += `<path d="${trazo(SG, t, size, x, 405)}" fill="${color}"/>`;
  x += medir(SG, t, size);
}

const desc = "Productividad con Datos · Automatización · IA";
const dSize = 24;
const descPath = trazo(MONO, desc, dSize, (W - medir(MONO, desc, dSize)) / 2, 472);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <pattern id="g" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#161c26" stroke-width="1"/></pattern>
  <radialGradient id="fade" cx="50%" cy="38%" r="70%"><stop offset="0.35" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
  <mask id="m"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>
  <radialGradient id="glow" cx="50%" cy="34%" r="55%"><stop offset="0" stop-color="#3d7fff" stop-opacity=".16"/><stop offset="1" stop-color="#3d7fff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="#0a0d12"/>
<rect width="${W}" height="${H}" fill="url(#g)" mask="url(#m)"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<image x="${f2((W - LOGO_W) / 2)}" y="150" width="${LOGO_W}" height="${f2(LOGO_H)}" href="data:image/svg+xml;base64,${logoB64}"/>
${tagline}
<path d="${descPath}" fill="#a4acb9"/>
</svg>`;

async function main() {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(BRAND, "og-image.png"));
  const fav = fs.readFileSync(path.join(BRAND, "favicon.svg"));
  const app = fs.readFileSync(path.join(BRAND, "icono-app.svg"));
  await sharp(fav, { density: 512 }).resize(32, 32).png().toFile(path.join(BRAND, "favicon-32.png"));
  await sharp(app, { density: 512 }).resize(180, 180).png().toFile(path.join(BRAND, "apple-touch-icon.png"));
  console.log("og-image.png, favicon-32.png y apple-touch-icon.png generados en assets/img/brand/");
}
main();
