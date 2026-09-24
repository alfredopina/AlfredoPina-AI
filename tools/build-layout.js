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
  "index.html": { css: ["base", "cards", "home"], nav: { conoceme: "#acerca-nav" }, footer: "full", social: true },
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
  return l.join("\n");
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
    <div class="nav-links">
      <a href="${n.conoceme || "/#experiencia"}">Conóceme</a>
      <a href="/cursos"${cur("cursos")}>Cursos</a>
      <a href="/recursos"${cur("recursos")}>Recursos</a>${tag}
    </div>
    <a href="/#contacto" class="nav-cta">${CAFE} Hablemos</a>
  </div>
</nav>`;
}

function footer(cfg) {
  const meta = `<div class="contact-meta">
      <a href="mailto:alfredo.pina@lifezen.com.mx">alfredo.pina@lifezen.com.mx</a>
      <span>(+52) 811 725 5937</span>
      <a href="https://www.linkedin.com/in/alfredopinacortez" target="_blank" rel="noopener">LinkedIn ↗</a>
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
