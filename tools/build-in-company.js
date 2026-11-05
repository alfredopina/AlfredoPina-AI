// tools/build-in-company.js
// Genera, a partir de tools/herramientas-datos.js (la fuente única de las 6 herramientas):
//   · las 6 páginas  in-company/<slug>.html  (desde tools/plantilla-herramienta.html), cada una con su
//     propio <title>, descripción, canonical y datos sociales ESTÁTICOS (Google y LinkedIn no ejecutan JS);
//   · las 6 tarjetas del centro in-company.html (zona <!--hub:cards-->).
// Al final corre tools/build-layout.js para estampar menú, pie y <head> común en todas.
// Uso (desde la raíz del repo):   node tools/build-in-company.js
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { HERRAMIENTAS, iconoHerramienta, rutaHerramienta } = require("./herramientas-datos");

const ROOT = path.join(__dirname, "..");
const SITE = "https://www.alfredopina.ai";
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const leer = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
let escritos = 0;
// las zonas que estampa build-layout (head/nav/footer) no cuentan para decidir si una página cambió
const sinZonas = (h) => h.replace(/(<!--layout:(?:head|nav|footer)-->)[\s\S]*?(<!--\/layout:(?:head|nav|footer)-->)/g, "$1$2");
function escribir(rel, texto) {
  const ruta = path.join(ROOT, rel);
  const antes = fs.existsSync(ruta) ? fs.readFileSync(ruta, "utf8").replace(/\r\n/g, "\n") : null;
  if (antes !== null && sinZonas(antes) === sinZonas(texto)) return;
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, texto);
  escritos++;
  console.log("actualizado:", rel);
}

// ── 1) una página por herramienta ──
const plantilla = leer("tools/plantilla-herramienta.html");
for (const h of HERRAMIENTAS) {
  const url = SITE + rutaHerramienta(h);
  const valores = {
    TITULO: esc(h.titulo), DESCRIPCION: esc(h.descripcion), URL: url, ID: h.id, NOMBRE: esc(h.nombre),
    H1: esc(h.h1), SUBTITULO: esc(h.subtitulo),
    CHIPS: h.alcance.map((s) => '<span class="scope-chip">' + CHECK + esc(s) + "</span>").join(""),
  };
  const html = plantilla.replace(/\{\{([A-Z0-9]+)\}\}/g, (_, k) => {
    if (!(k in valores)) throw new Error("plantilla: falta el valor " + k);
    return valores[k];
  });
  escribir("in-company/" + h.slug + ".html", html);
}

// ── 2) tarjetas del centro ──
const tarjeta = (h) => `<a href="${rutaHerramienta(h)}" class="course-card ${h.clase}" data-id="${h.id}">
        <div class="course-head">
          <div class="course-icon">${iconoHerramienta(h.id)}</div>
          <div class="course-fam">${esc(h.familia)}</div>
        </div>
        <h2 class="course-title">${esc(h.nombre)}</h2>
        <div class="course-text">${esc(h.resumen)}</div>
        <div class="course-tag">Ver temarios →</div>
      </a>`;
const centro = leer("in-company.html");
const re = /(<!--hub:cards-->)[\s\S]*?(<!--\/hub:cards-->)/;
if (!re.test(centro)) throw new Error("in-company.html: falta la zona <!--hub:cards-->");
escribir("in-company.html", centro.replace(re, (_, a, b) => a + "\n      " + HERRAMIENTAS.map(tarjeta).join("\n      ") + "\n      " + b));

// ── 3) menú, pie y <head> común ──
execFileSync(process.execPath, [path.join(__dirname, "build-layout.js")], { stdio: "inherit" });
console.log(escritos ? escritos + " archivo(s) generados." : "In Company al día.");
