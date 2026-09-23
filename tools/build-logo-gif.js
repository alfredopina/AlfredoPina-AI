// tools/build-logo-gif.js
// Genera el logo animado (GIF) para donde no hay CSS: firma de correo, Slack,
// WhatsApp, redes, un README. Alterna dos fotogramas — logo-principal-{tema}.svg
// (sin cursor) y logo-principal-{tema}-cursor.svg (con cursor, generado por
// build-logos.js) — simulando el cursor de texto parpadeando después del "()".
//
// Uso (desde la raíz del repo):   node tools/build-logo-gif.js
// Requiere "sharp", "gif-encoder-2" y "canvas" — no son dependencias del sitio
// (no se despliegan), solo de este script.
//
// El GIF no lleva transparencia real (el formato solo admite 1 bit: sí/no —
// se ve mal en los bordes redondeados). Por eso cada fotograma se aplana sobre
// un fondo sólido: blanco para el tema claro, el fondo de marca para el oscuro.
// Úsalo sobre un fondo de ese color; si el fondo real es otro, pide una versión
// nueva con ese color (basta cambiar FONDOS abajo y volver a correr).

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const GIFEncoder = require("gif-encoder-2");
const { createCanvas, Image } = require("canvas");

const BRAND = path.join(__dirname, "..", "assets", "img", "brand");
const ANCHO = 700; // px de salida — 2x el tamaño típico de una firma de correo
const DELAY_MS = 500; // mitad de un parpadeo de cursor de texto normal (~1s ciclo completo)

const FONDOS = { claro: "#ffffff", oscuro: "#0a0d12" };

function svgIntrinsicSize(file) {
  const txt = fs.readFileSync(file, "utf8");
  const w = parseFloat(/<svg[^>]*\swidth="([\d.]+)"/.exec(txt)[1]);
  const h = parseFloat(/<svg[^>]*\sheight="([\d.]+)"/.exec(txt)[1]);
  return { w, h };
}

async function frameBuffer(svgFile, targetW, targetH, fondo) {
  const { w: nativeW } = svgIntrinsicSize(svgFile);
  const density = Math.max(72, Math.ceil((72 * targetW) / nativeW) * 2);
  return sharp(svgFile, { density })
    .resize({ width: targetW, height: targetH })
    .flatten({ background: fondo })
    .png()
    .toBuffer();
}

function pngBufferToImageData(buf, w, h) {
  const img = new Image();
  img.src = buf;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return ctx;
}

async function run() {
  for (const tema of ["claro", "oscuro"]) {
    const off = path.join(BRAND, `logo-principal-${tema}.svg`);
    const on = path.join(BRAND, `logo-principal-${tema}-cursor.svg`);
    const { w: nativeW, h: nativeH } = svgIntrinsicSize(off);
    const h = Math.round((ANCHO * nativeH) / nativeW);

    const [bufOff, bufOn] = await Promise.all([
      frameBuffer(off, ANCHO, h, FONDOS[tema]),
      frameBuffer(on, ANCHO, h, FONDOS[tema]),
    ]);

    const encoder = new GIFEncoder(ANCHO, h, "neuquant", true);
    encoder.start();
    encoder.setRepeat(0); // 0 = loop infinito
    encoder.setDelay(DELAY_MS);
    encoder.setQuality(6); // 1 = mejor calidad / más lento; suficiente para un logo de pocos colores

    encoder.addFrame(pngBufferToImageData(bufOff, ANCHO, h));
    encoder.addFrame(pngBufferToImageData(bufOn, ANCHO, h));
    encoder.finish();

    const outPath = path.join(BRAND, `logo-principal-${tema}.gif`);
    fs.writeFileSync(outPath, encoder.out.getData());
    console.log(`logo-principal-${tema}.gif — ${ANCHO}x${h}px, fondo ${FONDOS[tema]}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
