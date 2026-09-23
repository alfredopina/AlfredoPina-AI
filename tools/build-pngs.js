// tools/build-pngs.js
// Genera las versiones PNG (con transparencia) de los SVG del logo y los íconos,
// para usarlos donde el SVG no sirve (Word, PowerPoint, la mayoría de los correos).
//
// Uso (desde la raíz del repo):   node tools/build-pngs.js
// Requiere "sharp" — no es dependencia del sitio (no se despliega), solo de este
// script. Si falta: npm install --no-save sharp (o instalarlo junto a este tools/).
//
// No convierte los SVG "-oscuro"/"currentColor" que solo tienen sentido en pantalla
// (p. ej. los íconos por herramienta del logo con trama), ni los archivos con texto
// editable pensado para incrustarse en HTML.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const BRAND = path.join(__dirname, "..", "assets", "img", "brand");

// { archivo svg (relativo a BRAND) : ancho de salida en px, alto se calcula solo }
const JOBS = [
  ["logo-principal-claro.svg", 1400],
  ["logo-principal-oscuro.svg", 1400],
  ["logo-compacto-claro.svg", 1000],
  ["logo-compacto-oscuro.svg", 1000],
  ["logo-tooltip-claro.svg", 1400],
  ["logo-tooltip-oscuro.svg", 1400],
  ["logo-literal-claro.svg", 1400],
  ["logo-literal-oscuro.svg", 1400],
  ["logo-diploma-claro.svg", 1000],
  ["icono-claro.svg", 600],
  ["icono-oscuro.svg", 600],
  ["icono-app.svg", 1024],
  ["favicon.svg", 512],
  ["iconos/excel-claro.svg", 600],
  ["iconos/excel-oscuro.svg", 600],
  ["iconos/powerbi-claro.svg", 600],
  ["iconos/powerbi-oscuro.svg", 600],
  ["iconos/powerapps-claro.svg", 600],
  ["iconos/powerapps-oscuro.svg", 600],
  ["iconos/powerautomate-claro.svg", 600],
  ["iconos/powerautomate-oscuro.svg", 600],
  ["iconos/ia-claro.svg", 600],
  ["iconos/ia-oscuro.svg", 600],
  ["iconos/ofimatica-claro.svg", 600],
  ["iconos/ofimatica-oscuro.svg", 600],
];

function svgIntrinsicWidth(file) {
  const txt = fs.readFileSync(file, "utf8");
  const m = /<svg[^>]*\swidth="([\d.]+)"/.exec(txt);
  if (!m) throw new Error("Sin width en " + file);
  return parseFloat(m[1]);
}

async function run() {
  let n = 0;
  for (const [rel, targetW] of JOBS) {
    const svgPath = path.join(BRAND, rel);
    const pngPath = svgPath.replace(/\.svg$/, ".png");
    const nativeW = svgIntrinsicWidth(svgPath);
    // Densidad alta para que librsvg rasterice fino y luego se reduzca (nunca se
    // amplía un raster borroso) al tamaño final exacto.
    const density = Math.max(72, Math.ceil((72 * targetW) / nativeW) * 2);
    await sharp(svgPath, { density })
      .resize({ width: targetW })
      .png({ compressionLevel: 9 })
      .toFile(pngPath);
    n++;
  }
  console.log(`${n} PNG generados junto a sus SVG en ${path.relative(process.cwd(), BRAND)}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
