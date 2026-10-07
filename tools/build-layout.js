// tools/build-layout.js
// Estampa el bloque <head> común (favicons, imagen social, CSS), el encabezado (nav) y el pie
// de las páginas públicas — una sola fuente de verdad, sin JS ni build en el despliegue: este
// script corre en local y el HTML resultante se commitea.
//
// Uso (desde la raíz del repo):   node tools/build-layout.js
//
// Cada página marca sus zonas con comentarios; lo de dentro se reescribe entero:
//   <!--layout:head--> … <!--/layout:head-->
//   <!--layout:nav-->  … <!--/layout:nav-->
//   <!--layout:footer--> … <!--/layout:footer-->
// Para cambiar el menú, el pie o los favicons: edita ESTE archivo y vuelve a correrlo.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = "https://www.alfredopina.ai";
const BRAND = "/assets/img/brand/";

// nav.conoceme: destino de "Conóceme" · nav.active: enlace resaltado · nav.tag: rótulo de páginas ocultas
// footer: "full" (invitación a contactar + fórmula) | "min" (solo datos y marca)
const PAGES = {
  "index.html": { css: ["base", "cards", "home"], nav: { conoceme: "#" }, footer: "full", social: true },
  "cursos.html": { css: ["base", "cursos"], nav: { active: "cursos" }, footer: "full", social: true },
  "recursos.html": { css: ["base", "cards", "recursos"], nav: { active: "recursos" }, footer: "full", social: true },
  "agenda.html": { css: ["base", "agenda"], nav: { tag: "Agenda" }, footer: "full" },
  "diagnostico.html": { css: ["base", "diagnostico"], nav: { tag: "Diagnóstico" }, footer: "min" },
  "encuesta.html": { css: ["base", "encuesta"], nav: { tag: "Encuesta" }, footer: "min" },
  "aviso-privacidad.html": { css: ["base", "legal"], nav: {}, footer: "min" },
  "terminos-uso.html": { css: ["base", "legal"], nav: {}, footer: "min" },
};

const CAFE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:13px;height:13px;"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 2.5c0 1-1 1-1 2s1 1 1 2M12.5 2.5c0 1-1 1-1 2s1 1 1 2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CAFE_BIG = CAFE.replace('viewBox', 'class="cafe-icon" viewBox').replace(' style="width:13px;height:13px;"', "").replace('stroke-width="1.8"', 'stroke-width="1.7"');
const MENU = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;
const OCULTA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.58 10.58a2 2 0 0 0 2.83 2.83M9.88 4.24A9.5 9.5 0 0 1 12 4c5 0 9 4 10 8-.32 1.1-.86 2.17-1.6 3.14M6.6 6.6C4.4 8 2.9 10 2 12c1 4 5 8 10 8 1.26 0 2.45-.24 3.53-.68" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function head(cfg) {
  const l = [
    `<link rel="icon" type="image/svg+xml" href="${BRAND}favicon.svg">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="${BRAND}favicon-32.png">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${BRAND}apple-touch-icon.png">`,
    `<meta name="theme-color" content="#0a0d12">`,
  ];
  if (cfg.social) {
    l.push(
      `<meta property="og:image" content="${SITE}${BRAND}og-image.png">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:image:alt" content="alfredopina.ai — Tu productividad tiene fórmula.">`,
      `<meta name="twitter:card" content="summary_large_image">`
    );
  }
  cfg.css.forEach((c) => l.push(`<link rel="stylesheet" href="/assets/css/${c}.css">`));
  l.push(`<script src="/assets/js/nav.js" defer></script>`);
  return l.join("\n");
}


// Menú desplegable de Cursos: una entrada por herramienta, con su ícono de marca (assets/img/brand/iconos).
// Los íconos usan currentColor, así que el color de cada herramienta viaja en --c.
const HERRAMIENTAS_NAV = [
  ["excel", "Excel", "#22c55e"],
  ["powerbi", "Power BI", "#f2c94c"],
  ["powerapps", "Power Apps", "#c026d3"],
  ["powerautomate", "Power Automate", "#06b6d4"],
  ["ia", "IA Aplicada", "#a78bfa"],
  ["ofimatica", "Ofimática", "#f97316"],
];
const CHEVRON = '<svg class="nav-dd-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function iconoHerramienta(id) {
  const svg = fs.readFileSync(path.join(ROOT, "assets/img/brand/iconos", id + ".svg"), "utf8").trim();
  return svg.replace(/ xmlns="[^"]*"/, "").replace(/ width="24" height="24"/, "").replace(/ role="img" aria-label="[^"]*"/, "").replace(/<title>[^<]*<\/title>/, "");
}
function ddCursos(aria) {
  const items = HERRAMIENTAS_NAV.map(([id, nombre, color]) =>
    '<a href="/cursos#' + id + '" data-cat="' + id + '" style="--c:' + color + '">' + iconoHerramienta(id) + nombre + '</a>'
  ).join("\n        ");
  return '<div class="nav-dd">\n      <a href="/cursos" class="nav-dd-trigger"' + aria + ' aria-haspopup="true">Cursos ' + CHEVRON + '</a>\n      <div class="nav-dd-menu">\n        ' + items + '\n      </div>\n    </div>';
}

// Menú desplegable de Conóceme: las 5 secciones de la portada (antes una segunda barra bajo el encabezado).
// Los destinos llevan "/#" para que funcionen también desde Cursos y Recursos.
const SVG_C = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' + d + '</svg>';
const CONOCEME_NAV = [
  ["experiencia", "Experiencia", "#3d7fff", SVG_C('<path d="M3 3v18h18M7 16l4-6 3 3 5-8" stroke-linecap="round" stroke-linejoin="round"/>')],
  ["certificaciones", "Certificaciones", "#2dd4bf", SVG_C('<path d="M12 2 4 6v6c0 5 3.4 9 8 10 4.6-1 8-5 8-10V6l-8-4Z" stroke-linecap="round" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>')],
  ["clientes", "Clientes", "#fbbf24", SVG_C('<path d="M3 21h18M6 21V8l6-4 6 4v13M10 21v-6h4v6" stroke-linecap="round" stroke-linejoin="round"/>')],
  ["herramientas", "Herramientas", "#818cf8", SVG_C('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>')],
  ["metodologia", "Metodología", "#f472b6", SVG_C('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" stroke-linecap="round"/>')],
];
function ddConoceme(href) {
  const items = CONOCEME_NAV.map(([id, nombre, color, svg]) =>
    '<a href="/#' + id + '" style="--c:' + color + '">' + svg + nombre + '</a>'
  ).join("\n        ");
  return '<div class="nav-dd">\n      <a href="' + href + '" class="nav-dd-trigger" aria-haspopup="true">Conóceme ' + CHEVRON + '</a>\n      <div class="nav-dd-menu">\n        ' + items + '\n      </div>\n    </div>';
}
function nav(cfg) {
  const n = cfg.nav;
  const cur = (k) => (n.active === k ? ' aria-current="page"' : "");
  const tag = n.tag
    ? `\n      <span class="nav-hidden-note" title="Página pública pero sin liga en el menú — no indexada por buscadores.">\n        ${OCULTA}\n        ${n.tag}\n      </span>`
    : "";
  return `<nav aria-label="Principal">
  <div class="wrap">
    <a href="/" class="nav-logo" aria-label="alfredopina.ai — inicio"><img src="${BRAND}logo-principal-oscuro.svg" alt="alfredopina.ai" width="187" height="30"></a>
    <div class="nav-links" id="navLinks">
      ${ddConoceme(n.conoceme || "/")}
      ${ddCursos(cur("cursos"))}
      <a href="/recursos"${cur("recursos")}>Recursos</a>${tag}
    </div>
    <a href="/#contacto" class="nav-cta">${CAFE} Hablemos</a>
    <button type="button" class="nav-toggle" aria-label="Abrir menú" aria-expanded="false" aria-controls="navLinks">${MENU}</button>
  </div>
</nav>`;
}

function footer(cfg) {
  const meta = `<div class="contact-meta">
      <a href="/aviso-privacidad">Aviso de Privacidad</a>
      <a href="/terminos-uso">Términos de Uso</a>
      <a href="/verificar">Verificar diploma</a>
      <span>© 2026 Alfredo Piña</span>
    </div>
    <div class="footer-brand">
      <div class="footer-id">
        <img src="${BRAND}logo-compacto-oscuro.svg" alt="alfredopina.ai" loading="lazy">
        <span>Productividad con Datos · Automatización · IA</span>
      </div>
      <div class="footer-created"><span>Created by</span><img src="/assets/img/firma-ap.png" alt="Firma de Alfredo Piña" loading="lazy"></div>
    </div>`;
  if (cfg.footer === "min") {
    return `<footer class="footer-min">
  <div class="wrap">
    ${meta}
  </div>
</footer>`;
  }
  return `<footer id="contacto">
  <div class="wrap">
    <div class="eyebrow">HABLEMOS</div>
    <h2 class="contact-title">Yo invito el café ${CAFE_BIG}</h2>

    <div class="formula-bar-big" id="formulaBar">
      <span class="formula-fx-big">fx</span>
      <span class="formula-reveal"><span class="formula-inner">=CONTACTAR(&nbsp;&nbsp;<a href="mailto:alfredo.pina@lifezen.com.mx" class="formula-arg">correo</a>&nbsp;&nbsp;,&nbsp;&nbsp;<a href="tel:+528117255937" class="formula-arg">teléfono</a>&nbsp;&nbsp;,&nbsp;&nbsp;<a href="https://wa.me/528117255937" target="_blank" rel="noopener" class="formula-arg">whatsapp</a>&nbsp;&nbsp;)</span></span>
    </div>

    ${meta}
  </div>
</footer>`;
}

function stamp(html, zona, contenido, archivo) {
  const re = new RegExp(`(<!--layout:${zona}-->)[\\s\\S]*?(<!--/layout:${zona}-->)`);
  if (!re.test(html)) throw new Error(`${archivo}: falta el marcador layout:${zona}`);
  return html.replace(re, (_, a, b) => `${a}\n${contenido}\n${b}`);
}

let cambios = 0;
for (const [archivo, cfg] of Object.entries(PAGES)) {
  const ruta = path.join(ROOT, archivo);
  const antes = fs.readFileSync(ruta, "utf8");
  let html = stamp(antes, "head", head(cfg), archivo);
  html = stamp(html, "nav", nav(cfg), archivo);
  html = stamp(html, "footer", footer(cfg), archivo);
  if (html !== antes) { fs.writeFileSync(ruta, html); cambios++; console.log("actualizado:", archivo); }
}
console.log(cambios ? `${cambios} página(s) actualizadas.` : "Todo al día.");
