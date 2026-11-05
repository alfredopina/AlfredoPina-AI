// tools/prueba-in-company.js — el centro /in-company y sus 6 páginas /in-company/<slug>: que cada una tenga lo suyo
// (título, descripción, canonical y datos sociales ESTÁTICOS, un solo h1), que las rutas y el sitemap las conozcan, que
// nadie siga enlazando a las pestañas viejas (/in-company#excel) y que el enlace viejo se traduzca a la página nueva.
// Sin red ni dependencias:   node tools/prueba-in-company.js
const fs = require('fs');
const path = require('path');
const { HERRAMIENTAS, rutaHerramienta } = require('./herramientas-datos');
const RAIZ = path.join(__dirname, '..');
const SITE = 'https://www.alfredopina.ai';
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

let fallos = 0;
const check = (n, ok, det) => { console.log((ok ? '  OK ' : '  FALLA ') + n + (ok || !det ? '' : ' → ' + det)); if (!ok) fallos++; };
const attr = (html, re) => { const m = html.match(re); return m ? m[1] : null; };

console.log('Datos de las herramientas');
check('son 6, con id, slug y color únicos', HERRAMIENTAS.length === 6 && new Set(HERRAMIENTAS.map((h) => h.id)).size === 6 && new Set(HERRAMIENTAS.map((h) => h.slug)).size === 6 && new Set(HERRAMIENTAS.map((h) => h.color)).size === 6);
check('los slugs son direcciones limpias (minúsculas, números y guiones)', HERRAMIENTAS.every((h) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(h.slug)));
check('título ≤ 70 caracteres y descripción entre 90 y 165 (lo que Google muestra)', HERRAMIENTAS.every((h) => h.titulo.length <= 70 && h.descripcion.length >= 90 && h.descripcion.length <= 165), HERRAMIENTAS.map((h) => h.slug + ':' + h.titulo.length + '/' + h.descripcion.length).join(' '));
check('cada herramienta tiene un enfoque (familia) y las familias son 3 de 2', (() => { const f = {}; HERRAMIENTAS.forEach((h) => { f[h.familia] = (f[h.familia] || 0) + 1; }); return Object.keys(f).length === 3 && Object.values(f).every((n) => n === 2); })());

console.log('Las 6 páginas por herramienta');
const titulos = new Set(), descripciones = new Set();
for (const h of HERRAMIENTAS) {
  const f = 'in-company/' + h.slug + '.html';
  check(h.slug + ': existe el archivo', fs.existsSync(path.join(RAIZ, f)));
  if (!fs.existsSync(path.join(RAIZ, f))) continue;
  const html = leer(f);
  const url = SITE + rutaHerramienta(h);
  const titulo = attr(html, /<title>([^<]*)<\/title>/);
  titulos.add(titulo); descripciones.add(attr(html, /<meta name="description" content="([^"]*)"/));
  check(h.slug + ': título, descripción, canonical, og:url y og:title propios', titulo && /Alfredo Piña/.test(titulo) && attr(html, /<meta name="description" content="([^"]*)"/) && attr(html, /<link rel="canonical" href="([^"]*)"/) === url && attr(html, /<meta property="og:url" content="([^"]*)"/) === url && attr(html, /<meta property="og:title" content="([^"]*)"/) === titulo);
  check(h.slug + ': datos sociales de la marca (imagen) y favicon estampados', /og:image" content="https:\/\/www\.alfredopina\.ai\/assets\/img\/brand\/og-image\.png"/.test(html) && /rel="icon"/.test(html));
  check(h.slug + ': UN solo h1, con el texto de la herramienta', (html.match(/<h1\b/g) || []).length === 1 && new RegExp('<h1[^>]*>' + h.h1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</h1>').test(html));
  check(h.slug + ': <body> con data-herramienta="' + h.id + '" (el catálogo se pide con ese id)', new RegExp('<body data-herramienta="' + h.id + '" data-nombre="' + h.nombre + '">').test(html));
  check(h.slug + ': menú con las 6 páginas nuevas y la suya marcada por el script', HERRAMIENTAS.every((x) => html.includes('<a href="' + rutaHerramienta(x) + '" data-cat="' + x.id + '"')));
  check(h.slug + ': migas de pan que vuelven al centro (con aria-current en la herramienta)', /<a href="\/in-company">Cursos In Company<\/a>/.test(html) && html.includes('<span aria-current="page">' + h.nombre + '</span>'));
  check(h.slug + ': carga el script compartido y ya NO lleva el código inline de antes', html.includes('/assets/js/in-company-herramienta.js') && !/function activateTab|const CAT_META/.test(html));
  check(h.slug + ': datos estructurados de ruta válidos', (() => { try { const j = JSON.parse(attr(html, /<script type="application\/ld\+json">([^<]*)<\/script>/)); return j['@type'] === 'BreadcrumbList' && j.itemListElement[1].item === url; } catch (e) { return false; } })());
  check(h.slug + ': sin marcadores {{ }} sin resolver', !/\{\{[A-Z0-9]+\}\}/.test(html));
}
check('los 6 títulos son distintos entre sí y las 6 descripciones también', titulos.size === 6 && descripciones.size === 6);

console.log('El centro /in-company');
const hub = leer('in-company.html');
check('canonical /in-company, UN h1 y descripción propia', attr(hub, /<link rel="canonical" href="([^"]*)"/) === SITE + '/in-company' && (hub.match(/<h1\b/g) || []).length === 1 && /<meta name="description" content="[^"]{90,}"/.test(hub));
check('las 6 tarjetas apuntan a su página (y llevan data-id para traducir el enlace viejo)', HERRAMIENTAS.every((h) => hub.includes('<a href="' + rutaHerramienta(h) + '" class="course-card ' + h.clase + '" data-id="' + h.id + '">')));
check('cada tarjeta dice su enfoque con TEXTO (no solo color) y "Ver temarios"', HERRAMIENTAS.every((h) => hub.includes('<div class="course-fam">' + h.familia + '</div>')) && (hub.match(/Ver temarios →/g) || []).length === 6);
check('el texto de cada tarjeta es el mismo de la portada (una sola fuente)', (() => { const idx = leer('index.html'); return HERRAMIENTAS.every((h) => hub.includes(h.resumen) && idx.includes(h.resumen)); })());
check('hay salida a Cursos Abiertos', hub.includes('href="/cursos-abiertos"'));
check('el h1 dice "IA aplicada" y Cursos Abiertos es una línea discreta (texto + enlace), no una tarjeta', hub.includes('>Cursos In Company de Excel, Power BI, Power Platform e IA aplicada</h1>') && hub.includes('<p class="ic-abiertos">¿Prefieres un curso abierto? <a href="/cursos-abiertos">') && !hub.includes('ic-puerta') && !hub.includes('ic-ayuda'));
check('el enlace viejo con # (/in-company#powerbi) se traduce a la página nueva', /location\.replace\(destino\.getAttribute\('href'\)\)/.test(hub) && /\.course-card\[data-id=/.test(hub));

console.log('Rutas, mapa del sitio y enlaces');
const cfg = JSON.parse(leer('staticwebapp.config.json'));
const rew = (r) => (cfg.routes.find((x) => x.route === r) || {}).rewrite;
check('/in-company → in-company.html y cada /in-company/<slug> → su archivo', rew('/in-company') === '/in-company.html' && HERRAMIENTAS.every((h) => rew(rutaHerramienta(h)) === '/in-company/' + h.slug + '.html'));
check('las rutas viejas /cursos y /cursos.html siguen redirigiendo (301) al centro', ['/cursos', '/cursos.html'].every((r) => { const x = cfg.routes.find((y) => y.route === r); return x && x.redirect === '/in-company' && x.statusCode === 301; }));
check('ninguna ruta apunta ya a cursos.html y el archivo viejo no existe', !JSON.stringify(cfg.routes.filter((r) => r.rewrite)).includes('/cursos.html') && !fs.existsSync(path.join(RAIZ, 'cursos.html')));
const sm = leer('sitemap.xml');
check('el mapa del sitio trae el centro y las 6 páginas', [SITE + '/in-company', ...HERRAMIENTAS.map((h) => SITE + rutaHerramienta(h))].every((u) => sm.includes('<loc>' + u + '</loc>')));
const tocadas = ['index.html', 'in-company.html', 'recursos.html', 'agenda.html', 'cursos-abiertos.html', 'diagnostico.html', 'encuesta.html', 'aviso-privacidad.html', 'terminos-uso.html', ...HERRAMIENTAS.map((h) => 'in-company/' + h.slug + '.html')];
const viejos = tocadas.filter((f) => /href="\/in-company#[a-z]+"/.test(leer(f)));
check('nadie enlaza ya a las pestañas viejas (/in-company#excel…)', viejos.length === 0, viejos.join(', '));
check('las tarjetas de la portada apuntan a la página de cada herramienta', (() => { const idx = leer('index.html'); return HERRAMIENTAS.every((h) => idx.includes('<a href="' + rutaHerramienta(h) + '" class="course-card ')); })());
check('Recursos manda a la página de cada herramienta (usa el slug del catálogo)', /href="\/in-company\/\$\{\(HUI\[id\] \|\| \{\}\)\.slug/.test(leer('recursos.html')) && HERRAMIENTAS.every((h) => leer('assets/js/herramientas.js').includes('"slug": "' + h.slug + '"')));

console.log('Los héroes y el script compartido');
const viajes = ['xl', 'bi', 'ofi', 'ia', 'pa', 'auto'].map((k) => leer('assets/js/viaje-' + k + '.js'));
check('ningún héroe pinta un h1: el único h1 de la página es el del encabezado de la herramienta', viajes.every((j) => !/<h1\b/.test(j)));
const js = leer('assets/js/in-company-herramienta.js');
check('el script compartido ya no depende de pestañas con # (sin hashchange ni tabMap)', !/hashchange|tabMap|location\.hash/.test(js) && /activateTab\(HERRAMIENTA\)/.test(js));
check('la nueva página sigue con el patrón de reintento y la protección del formulario (web/tf)', /REINTENTO_PAUSAS_MS/.test(js) && /web:\s*\(document\.getElementById\('leadWeb'\)/.test(js) && /tf:\s*Date\.now\(\) - leadAbiertoEn/.test(js));

// El enlace viejo, de verdad: se corre el script del centro con un navegador de mentira (location/document mínimos).
console.log('Enlace viejo (script del centro, ejecutado)');
const vm = require('vm');
// el script propio del centro es el <script> SIN atributos; se busca por texto (sin regex de HTML) y sin importar mayúsculas
const minusculas = hub.toLowerCase();
const iniScript = minusculas.indexOf('<script>');
const finScript = minusculas.indexOf('</script', iniScript);
const script = iniScript >= 0 && finScript > iniScript ? hub.slice(iniScript + '<script>'.length, finScript) : undefined;
check('el centro trae su script propio (el que traduce los enlaces viejos)', !!script && /traducir/.test(script));
const tarjetas = [...hub.matchAll(/<a href="([^"]+)" class="course-card [^"]*" data-id="([^"]+)">/g)].map((m) => ({ href: m[1], id: m[2] }));
function correr(hash) {
  let fue = null; const clases = [];
  const ctx = {
    location: { hash, replace: (u) => { fue = u; } },
    document: {
      querySelector: (sel) => { const m = sel.match(/data-id="([^"]+)"/); const x = m && tarjetas.find((c) => c.id === m[1]); return x ? { getAttribute: () => x.href } : null; },
      querySelectorAll: () => tarjetas.map(() => ({ classList: { add: (c) => clases.push(c) } })),
    },
    window: { addEventListener() {} },
  };
  vm.runInNewContext(script, ctx);
  return { fue, clases };
}
for (const h of HERRAMIENTAS) check('/in-company#' + h.id + ' → ' + rutaHerramienta(h), correr('#' + h.id).fue === rutaHerramienta(h));
check('/in-company#programas (un ancla cualquiera) no redirige', correr('#programas').fue === null);
check('/in-company sin # se queda en el centro y muestra las 6 tarjetas', (() => { const r = correr(''); return r.fue === null && r.clases.length === 6; })());
console.log(fallos ? '\n' + fallos + ' FALLARON' : '\nCursos In Company (centro + 6 páginas): todo en orden');
process.exit(fallos ? 1 : 0);
