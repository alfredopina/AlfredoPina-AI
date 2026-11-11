// tools/build-cursos-abiertos.js
// Genera, a partir de assets/data/landings-abiertos.json (la lista OFICIAL de landings de Cursos Abiertos):
//   · una página estática  cursos-abiertos/<slug>.html  por curso (desde tools/plantilla-curso-abierto.html), con su propio <title>,
//     descripción, canonical y datos sociales (og:*) y un solo <h1> ESCRITOS EN EL HTML (Google y LinkedIn/WhatsApp no ejecutan JS);
//     lo que cambia con el tiempo (próximo grupo, precio, lugares, Reservar) lo sigue cargando el script de la página;
//   · las rutas explícitas /cursos-abiertos/<slug> en staticwebapp.config.json (sin comodín: una dirección que no existe responde 404 real);
//   · las entradas del sitemap.xml de las landings (zona <!--landings-abiertos-->), sin huérfanas;
//   · la lista de enlaces reales a cada curso en cursos-abiertos.html (zona <!--landings:links-->).
// Agregar un curso = una entrada nueva en el JSON y correr este comando. Al final corre tools/build-layout.js (menú, pie y <head> común).
// Uso (desde la raíz del repo):   node tools/build-cursos-abiertos.js
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { generar, ARCHIVO } = require("./generar-rutas");

const ROOT = path.join(__dirname, "..");
const SITE = "https://www.alfredopina.ai";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const leer = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const hoy = new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10); // fecha de Monterrey

const LANDINGS = JSON.parse(leer("assets/data/landings-abiertos.json"));
const SLUGS = Object.keys(LANDINGS);
const rutaDe = (slug) => "/cursos-abiertos/" + slug;
let escritos = 0;

// las zonas que estampa build-layout (head/nav/footer) no cuentan para decidir si una página cambió
const sinZonas = (h) => h.replace(/(<!--layout:(?:head|nav|footer)-->)[\s\S]*?(<!--\/layout:(?:head|nav|footer)-->)/g, "$1$2");
function escribir(rel, texto) {
  const ruta = path.join(ROOT, rel);
  const antes = fs.existsSync(ruta) ? fs.readFileSync(ruta, "utf8").replace(/\r\n/g, "\n") : null;
  if (antes !== null && sinZonas(antes) === sinZonas(texto)) return false;
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, texto);
  escritos++;
  console.log("actualizado:", rel);
  return true;
}

// ── 1) una página por curso ──
const plantilla = leer("tools/plantilla-curso-abierto.html");
const cambiadas = new Set();
for (const slug of SLUGS) {
  const l = LANDINGS[slug];
  for (const k of ["herramienta", "programa", "nombre", "h1", "titulo", "descripcion"]) if (!l[k]) throw new Error(slug + ": falta «" + k + "» en landings-abiertos.json");
  const palabras = l.h1.split(" "), ult = palabras.length > 2 ? 2 : 1; // las dos últimas palabras van resaltadas, como en el diseño
  const valores = {
    TITULO: esc(l.titulo), DESCRIPCION: esc(l.descripcion), URL: SITE + rutaDe(slug), SLUG: slug, HERR: esc(l.herramienta), PROG: esc(l.programa), NOMBRE: esc(l.nombre),
    H1HTML: esc(palabras.slice(0, palabras.length - ult).join(" ")) + " <em>" + esc(palabras.slice(-ult).join(" ")) + "</em>",
    GANCHO: esc(l.gancho || ""),
  };
  const html = plantilla.replace(/\{\{([A-Z0-9]+)\}\}/g, (_, k) => {
    if (!(k in valores)) throw new Error("plantilla: falta el valor " + k);
    return valores[k];
  });
  if (escribir("cursos-abiertos/" + slug + ".html", html)) cambiadas.add(slug);
}
// una landing que ya no está en el JSON no se queda huérfana
const dir = path.join(ROOT, "cursos-abiertos");
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith(".html") && !SLUGS.includes(f.slice(0, -5))) { fs.unlinkSync(path.join(dir, f)); console.log("eliminado (ya no está en el JSON):", "cursos-abiertos/" + f); }

// ── 2) rutas: una por landing, sin comodín ──
const cfg = JSON.parse(leer("staticwebapp.config.json"));
const propias = (r) => r.route.startsWith("/cursos-abiertos/");
const rutas = cfg.routes.filter((r) => !propias(r));
const i = rutas.findIndex((r) => r.route === "/cursos-abiertos");
if (i < 0) throw new Error("staticwebapp.config.json: falta la ruta /cursos-abiertos");
rutas.splice(i + 1, 0, ...SLUGS.map((s) => ({ route: rutaDe(s), rewrite: rutaDe(s) + ".html" })));
cfg.routes = rutas;
const textoCfg = generar(cfg, require("../api/rutas-publicas"));
if (fs.readFileSync(ARCHIVO, "utf8").replace(/\r\n/g, "\n") !== textoCfg) { fs.writeFileSync(ARCHIVO, textoCfg); escritos++; console.log("actualizado: staticwebapp.config.json"); }

// ── 3) sitemap: las landings salen de la MISMA lista (lastmod = hoy si la página cambió; si no, se conserva) ──
let sm = leer("sitemap.xml");
const lastmodActual = (loc) => { const m = sm.match(new RegExp("<loc>" + loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "</loc>\\s*<lastmod>([^<]*)</lastmod>")); return m ? m[1] : null; };
const bloque = SLUGS.map((s) => "  <url>\n    <loc>" + SITE + rutaDe(s) + "</loc>\n    <lastmod>" + (cambiadas.has(s) ? hoy : lastmodActual(SITE + rutaDe(s)) || hoy) + "</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>").join("\n");
const reSm = /<!--landings-abiertos-->[\s\S]*?<!--\/landings-abiertos-->/;
const nuevoSm = "<!--landings-abiertos-->\n" + bloque + "\n  <!--/landings-abiertos-->";
if (!reSm.test(sm)) throw new Error("sitemap.xml: falta la zona <!--landings-abiertos-->");
sm = sm.replace(reSm, () => nuevoSm);
if (leer("sitemap.xml") !== sm) { fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sm); escritos++; console.log("actualizado: sitemap.xml"); }

// ── 4) enlaces reales a cada landing en la página general ──
const enlaces = SLUGS.map((s) => '<li><a href="' + rutaDe(s) + '">' + esc(LANDINGS[s].nombre) + ' <span>· ' + esc(String(LANDINGS[s].horas)) + ' h · ' + esc(LANDINGS[s].modalidad) + "</span></a></li>").join("\n        ");
const general = leer("cursos-abiertos.html");
const reG = /(<!--landings:links-->)[\s\S]*?(<!--\/landings:links-->)/;
if (!reG.test(general)) throw new Error("cursos-abiertos.html: falta la zona <!--landings:links-->");
escribir("cursos-abiertos.html", general.replace(reG, (_, a, b) => a + "\n        " + enlaces + "\n        " + b));

// ── 5) menú, pie y <head> común ──
execFileSync(process.execPath, [path.join(__dirname, "build-layout.js")], { stdio: "inherit" });
console.log(escritos ? escritos + " archivo(s) actualizados." : "Cursos Abiertos al día.");
