// tools/prueba-cursos-abiertos.js — SEO de Cursos Abiertos: la página general /cursos-abiertos y una página estática por curso (/cursos-abiertos/<slug>).
// Comprueba lo que Google y los robots de LinkedIn/WhatsApp leen SIN ejecutar JS: título, descripción, canonical (a sí misma, sin parámetros), og:*, un solo h1,
// enlaces reales a cada landing, rutas explícitas (sin comodín: un slug que no existe responde 404), sitemap sin huérfanas.
// Sin red ni dependencias:   node tools/prueba-cursos-abiertos.js
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const SITE = 'https://www.alfredopina.ai';
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
let fallos = 0;
const check = (n, ok, det) => { console.log((ok ? '  OK ' : '  FALLA ') + n + (ok || !det ? '' : ' → ' + det)); if (!ok) fallos++; };
const attr = (html, re) => { const m = html.match(re); return m ? m[1] : null; };
// el h1 que debe escribir el generador: el nombre con las dos últimas palabras resaltadas (mismo criterio que tools/build-cursos-abiertos.js)
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const h1Esperado = (h1) => { const p = h1.split(" "), n = p.length > 2 ? 2 : 1; return escHtml(p.slice(0, p.length - n).join(" ")) + " <em>" + escHtml(p.slice(-n).join(" ")) + "</em>"; };
const desescapar = (s) => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const LANDINGS = JSON.parse(leer('assets/data/landings-abiertos.json'));
const SLUGS = Object.keys(LANDINGS);

console.log('La lista oficial (assets/data/landings-abiertos.json)');
check('hay al menos una landing y los slugs son direcciones limpias', SLUGS.length >= 1 && SLUGS.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)));
check('cada una trae herramienta, programa, nombre, h1, título y descripción', SLUGS.every((s) => ['herramienta', 'programa', 'nombre', 'h1', 'titulo', 'descripcion'].every((k) => LANDINGS[s][k])));
check('el slug es «herramienta-programa»', SLUGS.every((s) => s === LANDINGS[s].herramienta + '-' + LANDINGS[s].programa));
check('título ≤ 70 caracteres y descripción entre 90 y 165 (lo que Google muestra)', SLUGS.every((s) => LANDINGS[s].titulo.length <= 70 && LANDINGS[s].descripcion.length >= 90 && LANDINGS[s].descripcion.length <= 165), SLUGS.map((s) => s + ': ' + LANDINGS[s].titulo.length + '/' + LANDINGS[s].descripcion.length).join(' · '));
check('títulos y descripciones únicos entre landings', new Set(SLUGS.map((s) => LANDINGS[s].titulo)).size === SLUGS.length && new Set(SLUGS.map((s) => LANDINGS[s].descripcion)).size === SLUGS.length);
check('sin precios en título ni descripción', SLUGS.every((s) => !/\$|\bMXN\b|IVA/i.test(LANDINGS[s].titulo + ' ' + LANDINGS[s].descripcion)));

console.log('Una página estática por curso');
for (const s of SLUGS) {
  const l = LANDINGS[s], f = 'cursos-abiertos/' + s + '.html', url = SITE + '/cursos-abiertos/' + s;
  check(s + ': existe el archivo', fs.existsSync(path.join(RAIZ, f)));
  if (!fs.existsSync(path.join(RAIZ, f))) continue;
  const h = leer(f);
  check(s + ': <title> propio y estático', desescapar(attr(h, /<title>([^<]*)<\/title>/)) === l.titulo);
  check(s + ': descripción propia y estática', desescapar(attr(h, /<meta name="description" content="([^"]*)"/)) === l.descripcion);
  check(s + ': canonical a sí misma, sin parámetros', attr(h, /<link rel="canonical" href="([^"]*)"/) === url);
  check(s + ': og:url, og:title y og:description propios', attr(h, /<meta property="og:url" content="([^"]*)"/) === url && desescapar(attr(h, /<meta property="og:title" content="([^"]*)"/)) === l.titulo && desescapar(attr(h, /<meta property="og:description" content="([^"]*)"/)) === l.descripcion);
  check(s + ': imagen social y favicon de la marca estampados', /og:image" content="https:\/\/www\.alfredopina\.ai\/assets\/img\/brand\/og-image\.png"/.test(h) && /rel="icon"/.test(h));
  check(s + ': UN solo h1, escrito en el HTML con el nombre del curso', (h.match(/<h1\b/g) || []).length === 1 && attr(h, /<h1[^>]*>([\s\S]*?)<\/h1>/) === h1Esperado(l.h1));
  check(s + ': <body> con herramienta, programa y slug (el script pide el catálogo con ellos)', h.includes('<body data-herramienta="' + l.herramienta + '" data-programa="' + l.programa + '" data-slug="' + s + '">'));
  check(s + ': sin marcadores {{ }} sin resolver y sin noindex', !/\{\{[A-Z0-9]+\}\}/.test(h) && !/noindex/i.test(h));
  check(s + ': el script ya no escribe título, canonical ni h1', !/document\.title\s*=/.test(h) && !/#coCanon|#coOg|\$\('#ldH1'\)\.innerHTML/.test(h));
  check(s + ': menú con «Cursos Abiertos» marcado como página actual', /<a href="\/cursos-abiertos" aria-current="page">Cursos Abiertos<\/a>/.test(h));
}
check('ya no existe el archivo suelto curso-abierto.html (la plantilla vive en tools/)', !fs.existsSync(path.join(RAIZ, 'curso-abierto.html')) && fs.existsSync(path.join(RAIZ, 'tools/plantilla-curso-abierto.html')));
const huerfanas = fs.existsSync(path.join(RAIZ, 'cursos-abiertos')) ? fs.readdirSync(path.join(RAIZ, 'cursos-abiertos')).filter((f) => f.endsWith('.html') && !SLUGS.includes(f.slice(0, -5))) : [];
check('no hay páginas generadas que ya no estén en la lista', huerfanas.length === 0, huerfanas.join(', '));

console.log('La página general /cursos-abiertos');
const g = leer('cursos-abiertos.html');
check('título y descripción propios (los aprobados)', attr(g, /<title>([^<]*)<\/title>/) === 'Cursos Abiertos con fecha fija en Excel, Power BI e IA | Alfredo Piña' && attr(g, /<meta name="description" content="([^"]*)"/).length >= 90 && attr(g, /<meta name="description" content="([^"]*)"/).length <= 165);
check('canonical a sí misma, sin parámetros (?reservar=, ?avisame= y utm_ no crean otra página)', attr(g, /<link rel="canonical" href="([^"]*)"/) === SITE + '/cursos-abiertos' && attr(g, /<meta property="og:url" content="([^"]*)"/) === SITE + '/cursos-abiertos');
check('UN h1 y texto estático que explica qué son los cursos abiertos', (g.match(/<h1\b/g) || []).length === 1 && /class="ca-que"/.test(g) && /grupos con fecha fija/.test(g));
check('enlaces reales <a href="/cursos-abiertos/<slug>"> a cada landing (Google los descubre sin JS)', SLUGS.every((s) => g.includes('<a href="/cursos-abiertos/' + s + '">')));
check('sin enlaces a landings que no existen', [...g.matchAll(/<a href="\/cursos-abiertos\/([^"]+)">/g)].every((m) => SLUGS.includes(m[1])));
check('indexable (sin noindex)', !/noindex/i.test(g));

console.log('Rutas');
const cfg = JSON.parse(leer('staticwebapp.config.json'));
const rew = (r) => (cfg.routes.find((x) => x.route === r) || {}).rewrite;
check('/cursos-abiertos → cursos-abiertos.html y cada landing → su archivo', rew('/cursos-abiertos') === '/cursos-abiertos.html' && SLUGS.every((s) => rew('/cursos-abiertos/' + s) === '/cursos-abiertos/' + s + '.html'));
check('NO hay comodín /cursos-abiertos/* (un slug que no existe responde 404 real)', !cfg.routes.some((r) => /\*/.test(r.route) && r.route.startsWith('/cursos-abiertos')));
check('no hay rutas de landings que no estén en la lista', cfg.routes.filter((r) => r.route.startsWith('/cursos-abiertos/')).every((r) => SLUGS.includes(r.route.slice('/cursos-abiertos/'.length))));
check('no hay navigationFallback que atrape direcciones inexistentes (devolvería 200)', !cfg.navigationFallback);
const atrapa = cfg.routes.filter((r) => /\*/.test(r.route) && !r.route.startsWith('/api') && !r.route.startsWith('/admin') && 'cursos-abiertos/no-existe-xyz'.startsWith(r.route.replace(/^\//, '').replace(/\*.*$/, '')));
check('/cursos-abiertos/no-existe-xyz no la atrapa ninguna regla comodín', atrapa.length === 0, atrapa.map((r) => r.route).join(', '));

console.log('Mapa del sitio');
const sm = leer('sitemap.xml');
const locs = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
check('trae /cursos-abiertos y cada landing', [SITE + '/cursos-abiertos', ...SLUGS.map((s) => SITE + '/cursos-abiertos/' + s)].every((u) => locs.includes(u)));
check('ninguna entrada /cursos-abiertos/… sin su landing (sin huérfanas)', locs.filter((u) => u.startsWith(SITE + '/cursos-abiertos/')).every((u) => SLUGS.includes(u.slice((SITE + '/cursos-abiertos/').length))));
check('cada <lastmod> de cursos abiertos es una fecha válida', [...sm.matchAll(/<loc>(https:\/\/www\.alfredopina\.ai\/cursos-abiertos[^<]*)<\/loc>\s*<lastmod>([^<]*)<\/lastmod>/g)].every((m) => /^\d{4}-\d{2}-\d{2}$/.test(m[2])));
check('no hay direcciones repetidas', new Set(locs).size === locs.length);

console.log(fallos ? '\n' + fallos + ' FALLARON' : '\nCursos Abiertos (SEO: general + landings): todo en orden');
process.exit(fallos ? 1 : 0);
