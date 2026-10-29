// tools/prueba-sitio-publico.js — prueba de lo que el SITIO PÚBLICO hace con lo configurado en admin → Personalizar (assets/js/sitio.js y
// assets/js/linkedin.js sobre index.html) en jsdom con un servidor falso. No toca nada real.
//   set JSDOM_DIR=%TEMP%jsdom-barra && node tools/prueba-sitio-publico.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_DIR ? path.join(process.env.JSDOM_DIR, 'node_modules', 'jsdom') : 'jsdom');
const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const SITIO_JS = fs.readFileSync(path.join(RAIZ, 'assets', 'js', 'sitio.js'), 'utf8');
const LINKEDIN_JS = fs.readFileSync(path.join(RAIZ, 'assets', 'js', 'linkedin.js'), 'utf8');
const EMBED_ARCHIVO = 'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7490820891162054656?collapsed=1';
const EMBED_NUEVO = 'https://www.linkedin.com/embed/feed/update/urn:li:share:7388888888888888888';

let fallos = 0;
const check = (n, ok, det) => { console.log((ok ? '  OK ' : '  FALLA ') + n + (ok || !det ? '' : ' → ' + det)); if (!ok) fallos++; };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const hoy = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const enDias = (n) => new Date(Date.now() - 6 * 3600 * 1000 + n * 86400000).toISOString().slice(0, 10);

// Carga la portada con una respuesta de getConfiguracionSitio (o fallo) y corre los dos scripts del sitio.
async function pagina(config, { fallaApi = false } = {}) {
  const vc = new VirtualConsole();
  const dom = new JSDOM(HTML.replace(/<script[^>]*src=[^>]*><\/script>/g, ''), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://www.alfredopina.ai/', virtualConsole: vc });
  const w = dom.window;
  const llamadas = [];
  w.fetch = (u) => {
    llamadas.push(String(u));
    if (String(u).includes('getConfiguracionSitio')) return fallaApi ? Promise.reject(new Error('sin red')) : Promise.resolve({ ok: true, json: async () => config });
    if (String(u).includes('linkedin.json')) return Promise.resolve({ ok: true, json: async () => ({ embed: EMBED_ARCHIVO, alto: 628 }) });
    return Promise.resolve({ ok: false, json: async () => ({}) });
  };
  w.eval(SITIO_JS); w.eval(LINKEDIN_JS);
  await pausa(150);
  return { w, d: w.document, llamadas };
}

(async () => {
  console.log('Sin nada guardado (o la lectura falla): el sitio se ve como siempre');
  for (const [nombre, cfg, op] of [['sin nada guardado', {}, {}], ['la función falla', null, { fallaApi: true }]]) {
    const { d } = await pagina(cfg, op);
    check(nombre + ': sin franja de aviso', !d.querySelector('.aviso-sitio'));
    check(nombre + ': el WhatsApp y el correo del pie siguen siendo los de siempre', d.querySelector('[data-sitio="whatsapp"]').href === 'https://wa.me/528117255937' && d.querySelector('[data-sitio="correo"]').href === 'mailto:alfredo.pina@lifezen.com.mx');
    check(nombre + ': LinkedIn sale con la publicación del archivo de siempre', d.querySelector('#liEmbed iframe') && d.querySelector('#liEmbed iframe').src === EMBED_ARCHIVO && d.getElementById('linkedin').hidden === false);
  }

  console.log('Contacto y perfiles');
  let { d } = await pagina({ contacto: { correo: 'hola@alfredopina.ai', whatsapp: '528199990000' }, perfiles: { linkedinPersonal: 'https://www.linkedin.com/in/otro-perfil', linkedinEmpresa: 'https://www.linkedin.com/company/999999', youtube: 'https://www.youtube.com/@alfredopina' } });
  check('el pie usa el correo y el WhatsApp configurados', d.querySelector('[data-sitio="correo"]').href === 'mailto:hola@alfredopina.ai' && d.querySelector('[data-sitio="whatsapp"]').href === 'https://wa.me/528199990000');
  check('"Seguirme en LinkedIn" usa el perfil personal configurado', d.querySelector('[data-sitio="linkedin-personal"]').href === 'https://www.linkedin.com/in/otro-perfil');
  const reds = Array.from(d.querySelectorAll('.contact-meta [data-sitio-red]'));
  check('LinkedIn de la empresa y YouTube salen en el pie, abren en pestaña nueva y antes del ©', reds.length === 2 && reds.every((a) => a.target === '_blank' && /noopener/.test(a.rel)) && reds[1].nextElementSibling.tagName === 'SPAN');
  ({ d } = await pagina({ perfiles: { linkedinPersonal: 'javascript:alert(1)', linkedinEmpresa: 'http://www.linkedin.com/company/1', youtube: 'https://evil.com/x' }, contacto: { correo: '"><script>x</script>', whatsapp: 'abc' } }));
  check('ligas peligrosas o mal formadas se ignoran (se queda lo de siempre)', d.querySelector('[data-sitio="linkedin-personal"]').href === 'https://www.linkedin.com/in/alfredopinacortez' && d.querySelectorAll('.contact-meta [data-sitio-red]').length === 0 && d.querySelector('[data-sitio="correo"]').href === 'mailto:alfredo.pina@lifezen.com.mx' && d.querySelector('[data-sitio="whatsapp"]').href === 'https://wa.me/528117255937');

  console.log('LinkedIn de la portada');
  ({ d } = await pagina({ linkedin: { mostrar: true, embed: EMBED_NUEVO, alto: 700 } }));
  check('usa la publicación guardada en el admin (y su alto), no la del archivo', d.querySelector('#liEmbed iframe').src === EMBED_NUEVO && d.querySelector('#liEmbed iframe').style.height === '700px');
  let r = await pagina({ linkedin: { mostrar: false, embed: '', alto: 560 } });
  check('si Alfredo apagó la sección, NO sale (aunque el archivo tenga una publicación) y no se lee el archivo', !r.d.querySelector('#liEmbed iframe') && r.d.getElementById('linkedin').hidden === true && !r.llamadas.some((u) => u.includes('linkedin.json')));
  ({ d } = await pagina({ linkedin: { mostrar: true, embed: 'https://evil.com/embed/feed/update/urn:li:share:1', alto: 560 } }));
  check('una liga que no es de LinkedIn no se incrusta', !d.querySelector('#liEmbed iframe'));

  console.log('Aviso del sitio');
  ({ d } = await pagina({ aviso: { activo: true, texto: 'Nuevas fechas en noviembre', enlace: '/cursos-abiertos', hasta: enDias(3) } }));
  const barra = d.querySelector('.aviso-sitio');
  check('aparece como PRIMER elemento de la página, con el texto y "Ver →" al enlace', barra && d.body.firstElementChild === barra && /Nuevas fechas en noviembre/.test(barra.textContent) && barra.querySelector('a').getAttribute('href') === '/cursos-abiertos' && /Ver →/.test(barra.textContent));
  ({ d } = await pagina({ aviso: { activo: true, texto: '<img src=x onerror=alert(1)>', enlace: 'javascript:alert(1)', hasta: '' } }));
  check('el texto con HTML entra como texto y un enlace javascript: no se pone', d.querySelector('.aviso-sitio') && !d.querySelector('.aviso-sitio img') && /<img src=x/.test(d.querySelector('.aviso-sitio').textContent) && !d.querySelector('.aviso-sitio a'));
  ({ d } = await pagina({ aviso: { activo: true, texto: 'Vencido', hasta: enDias(-1) } }));
  check('un aviso vencido no se muestra (aunque el servidor lo mande)', !d.querySelector('.aviso-sitio'));
  ({ d } = await pagina({ aviso: { activo: true, texto: 'Hoy es el último día', hasta: hoy() } }));
  check('el día del vencimiento todavía se muestra completo', !!d.querySelector('.aviso-sitio'));
  ({ d } = await pagina({ aviso: { activo: false, texto: 'Apagado' } }));
  check('un aviso apagado no se muestra', !d.querySelector('.aviso-sitio'));

  console.log('Páginas con el encabezado compartido');
  const stamped = ['index.html', 'cursos.html', 'recursos.html', 'agenda.html', 'aviso-privacidad.html', 'terminos-uso.html', 'diagnostico.html', 'encuesta.html'];
  check('las 8 páginas con el encabezado compartido cargan sitio.js', stamped.every((f) => /\/assets\/js\/sitio\.js/.test(fs.readFileSync(path.join(RAIZ, f), 'utf8'))), stamped.filter((f) => !/\/assets\/js\/sitio\.js/.test(fs.readFileSync(path.join(RAIZ, f), 'utf8'))).join(','));
  const funcionales = ['propuesta.html', 'verificar.html', 'diplomas-grupo.html', 'reporte-diagnostico.html', 'reporte-encuesta.html', 'reporte-resultados.html'];
  check('las páginas funcionales (propuesta, diploma, reportes) NO cargan el aviso', funcionales.every((f) => !/sitio\.js/.test(fs.readFileSync(path.join(RAIZ, f), 'utf8'))));

  console.log(fallos ? '\n' + fallos + ' FALLARON' : '\nsitio público con Personalizar: todo en orden');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
