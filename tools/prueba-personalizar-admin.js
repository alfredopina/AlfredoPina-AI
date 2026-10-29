// tools/prueba-personalizar-admin.js — prueba funcional del panel Personalizar del admin (LinkedIn de la portada, contacto, perfiles y aviso)
// cargando admin/index.html en jsdom con un servidor falso. No toca nada real.
// jsdom NO es dependencia del proyecto: instálalo en una carpeta temporal y apunta a ella (ver tools/prueba-barra-admin.js):
//   set JSDOM_DIR=%TEMP%jsdom-barra && node tools/prueba-personalizar-admin.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_DIR ? path.join(process.env.JSDOM_DIR, 'node_modules', 'jsdom') : 'jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');

const EMBED = 'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7490820891162054656?collapsed=1';
const llamadas = []; // { url, metodo, cuerpo }
let guardado = { meta: {} };
let rechazar = null; // si se define, el próximo guardado responde 400 con este texto
function respuesta(cuerpo, status = 200) { return Promise.resolve({ ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) }); }
function fetchFalso(url, op = {}) {
  const u = String(url); const metodo = (op.method || 'GET').toUpperCase();
  llamadas.push({ url: u, metodo, cuerpo: op.body ? JSON.parse(op.body) : null });
  if (u.includes('/api/getConfiguracionSitioAdmin')) return respuesta(JSON.parse(JSON.stringify(guardado)));
  if (u.includes('/api/guardarConfiguracionSitio')) {
    if (rechazar) { const m = rechazar; rechazar = null; return respuesta({ error: m }, 400); }
    const b = JSON.parse(op.body);
    guardado[b.seccion] = b.seccion === 'linkedin' ? { mostrar: b.datos.mostrar, embed: (/src="([^"]+)"/.exec(b.datos.codigo) || [null, b.datos.codigo])[1], alto: Number(b.datos.alto) || 560 } : b.datos;
    guardado.meta[b.seccion] = { en: new Date().toISOString(), por: 'alfredo.pina@lifezen.com.mx' };
    return respuesta({ ok: true });
  }
  if (u.includes('/assets/data/linkedin.json')) return respuesta({ embed: EMBED, alto: 628 });
  if (u.includes('/.auth/me')) return respuesta({ clientPrincipal: { userDetails: 'alfredo.pina@lifezen.com.mx', userRoles: ['admin'] } });
  if (/\/api\/(list|buscarClientes|getNotificaciones|getEstado)/.test(u)) return respuesta(u.includes('getNotificacionesActivas') ? { total: 0, grupos: {} } : []);
  return respuesta({}, 200);
}

const errores = [];
process.on('unhandledRejection', () => {});
process.on('uncaughtException', (e) => { errores.push('excepción de la página: ' + String(e && e.message).slice(0, 120)); });
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errores.push('jsdomError: ' + (e.detail && e.detail.message || e.message)));
vc.on('error', (e) => errores.push('console.error: ' + String(e).slice(0, 200)));
const dom = new JSDOM(HTML, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://www.alfredopina.ai/admin/', virtualConsole: vc,
  beforeParse(w) {
    w.fetch = fetchFalso;
    w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    w.QRCodeStyling = function () { return { append() {}, getRawData: async () => new Blob([]) }; };
    w.Sortable = { create() { return {}; } };
    w.IntersectionObserver = function () { return { observe() {}, disconnect() {} }; };
    w.ResizeObserver = function () { return { observe() {}, disconnect() {} }; };
    w.HTMLElement.prototype.scrollIntoView = function () {};
    w.scrollTo = () => {};
    w.eval(fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'herramientas.js'), 'utf8'));
  },
});
const w = dom.window, d = w.document;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0;
const check = (n, ok, det) => { console.log((ok ? '  OK ' : '  FALLA ') + n + (ok || !det ? '' : ' → ' + det)); if (!ok) fallos++; };
const q = (s) => d.querySelector(s);
const txt = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
const escribir = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const volcar = (nombre) => { if(!process.env.VOLCAR_HTML) return; const copia = d.documentElement.cloneNode(true); copia.querySelectorAll('script').forEach((s) => s.remove()); fs.writeFileSync(path.join(process.env.VOLCAR_HTML, nombre + '.html'), '<!doctype html>' + copia.outerHTML); }; // VOLCAR_HTML=carpeta guarda el DOM para tomarle captura
const posts = () => llamadas.filter((l) => l.metodo === 'POST');

(async () => {
  await pausa(700);
  check('el script de la página corrió sin errores graves', errores.filter((e) => !/Not implemented|navigation|resource/i.test(e)).length === 0, errores.slice(0, 3).join(' | '));
  console.log('Ubicación y apertura');
  const items = Array.from(d.querySelectorAll('.admin-nav-item')).map((b) => b.dataset.panel);
  const iDash = items.indexOf('dashboard'), iPers = items.indexOf('personalizar'), iMarca = items.indexOf('marca');
  check('"Personalizar" está en el grupo SITIO, entre Dashboard y Marca', iDash >= 0 && iPers === iDash + 1 && iMarca === iPers + 1, items.join(','));
  check('el botón del menú dice "Personalizar"', txt('.admin-nav-item[data-panel="personalizar"]') === 'Personalizar');
  q('.admin-nav-item[data-panel="personalizar"]').click(); await pausa(400);
  check('abre su panel y el título de la barra dice "Personalizar"', q('#panel-personalizar').classList.contains('active') && txt('#topbarTitle') === 'Personalizar');
  check('al entrar desde el menú vuelve a leer lo guardado (se refresca)', llamadas.filter((l) => l.url.includes('getConfiguracionSitioAdmin')).length >= 2);

  console.log('Sin nada guardado: muestra los valores originales del sitio');
  check('franja: "Sin cambios guardados"', txt('#pzEstadoTit') === 'Sin cambios guardados', txt('#pzEstadoTit'));
  check('contacto con el correo y el WhatsApp de siempre, con formato', q('#pzCoCorreo').value === 'alfredo.pina@lifezen.com.mx' && q('#pzCoWa').value === '+52 81 1725 5937', q('#pzCoWa').value);
  check('LinkedIn toma la publicación original del sitio (assets/data/linkedin.json)', q('#pzLiCodigo').value === EMBED && q('#pzLiAlto').value === '628' && q('#pzLiMostrar').checked && /Valor original/.test(txt('#pzLiChip')));
  check('perfiles: LinkedIn personal de siempre; empresa y YouTube vacíos', q('#pzPeLiPersonal').value === 'https://www.linkedin.com/in/alfredopinacortez' && q('#pzPeLiEmpresa').value === '' && q('#pzPeYoutube').value === '');
  check('aviso apagado: "Sin aviso" (ícono + texto)', /Sin aviso/.test(txt('#pzAvChip')) && q('#pzAvChip svg'));
  check('vista previa de LinkedIn con la liga detectada y "Liga válida" (con ícono y texto)', !!q('#pzLiPrev iframe') && /Liga válida/.test(txt('#pzLiValida')) && q('#pzLiValida svg'));

  volcar('personalizar-original');
  console.log('LinkedIn: pegar el código de inserción');
  escribir('pzLiCodigo', '<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:share:7388888888888888888" height="700" width="504" frameborder="0"></iframe>'); await pausa(600);
  check('saca la liga y el alto del código <iframe>', q('#pzLiLiga').value === 'https://www.linkedin.com/embed/feed/update/urn:li:share:7388888888888888888' && q('#pzLiAlto').value === '700', q('#pzLiLiga').value + ' / ' + q('#pzLiAlto').value);
  escribir('pzLiCodigo', 'https://evil.com/embed/feed/update/urn:li:share:7388888888888888888'); await pausa(600);
  check('una liga que no es de LinkedIn avisa (ícono + texto) y quita la vista previa', /No es una publicación incrustada/.test(txt('#pzLiValida')) && !q('#pzLiPrev iframe'));
  escribir('pzLiCodigo', '<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:share:7388888888888888888" height="700"></iframe>'); await pausa(600);
  q('#pzLiGuardar').click(); await pausa(400);
  let p = posts().pop();
  check('Guardar y publicar: manda sección linkedin con el código, el alto y "mostrar"', p && p.cuerpo.seccion === 'linkedin' && /urn:li:share:7388888888888888888/.test(p.cuerpo.datos.codigo) && p.cuerpo.datos.mostrar === true, JSON.stringify(p && p.cuerpo));
  check('avisa que se guardó y el chip pasa a "Publicada"', /ya sale en la portada/.test(txt('#pzToast')) && /Publicada/.test(txt('#pzLiChip')));
  check('la franja de estado dice "Todo publicado" con quién y cuándo', txt('#pzEstadoTit') === 'Todo publicado' && /LinkedIn de la portada/.test(txt('#pzEstadoSub')) && /alfredo\.pina@lifezen\.com\.mx/.test(txt('#pzEstadoSub')), txt('#pzEstadoSub'));

  console.log('Contacto');
  escribir('pzCoCorreo', 'hola@alfredopina.ai'); escribir('pzCoWa', '+52 81 9999 0000');
  q('#pzCoGuardar').click(); await pausa(400);
  p = posts().pop();
  check('Guardar: manda correo y WhatsApp tal cual los escribiste (el servidor los normaliza)', p.cuerpo.seccion === 'contacto' && p.cuerpo.datos.correo === 'hola@alfredopina.ai' && p.cuerpo.datos.whatsapp === '+52 81 9999 0000');
  check('la vista previa muestra la fórmula =CONTACTAR( correo , whatsapp )', /=CONTACTAR\(\s*correo\s*,\s*whatsapp\s*\)/.test(txt('#pzCoFormula')), txt('#pzCoFormula'));
  rechazar = 'Escribe un correo válido.';
  q('#pzCoGuardar').click(); await pausa(300);
  check('si el servidor rechaza, muestra el motivo en rojo y no cambia el estado', /Escribe un correo válido/.test(txt('#pzToast')) && q('#pzToast').classList.contains('err'));

  console.log('Perfiles');
  escribir('pzPeYoutube', 'https://www.youtube.com/@alfredopina');
  q('#pzPeGuardar').click(); await pausa(400);
  p = posts().pop();
  check('Guardar: manda las tres ligas', p.cuerpo.seccion === 'perfiles' && p.cuerpo.datos.youtube === 'https://www.youtube.com/@alfredopina' && p.cuerpo.datos.linkedinPersonal === 'https://www.linkedin.com/in/alfredopinacortez');

  console.log('Aviso');
  escribir('pzAvTexto', 'Nuevas fechas de cursos abiertos en noviembre'); escribir('pzAvEnlace', '/cursos-abiertos');
  check('contador de caracteres y vista previa con "Ver →"', /45 de 120/.test(txt('#pzAvCuenta')) && /Nuevas fechas/.test(txt('#pzAvPrev')) && /Ver →/.test(txt('#pzAvPrev')), txt('#pzAvCuenta'));
  q('#pzAvActivo').checked = true;
  const en3 = new Date(Date.now() - 6 * 3600 * 1000 + 3 * 86400000).toISOString().slice(0, 10);
  q('#pzAvHasta').value = en3;
  q('#pzAvGuardar').click(); await pausa(400);
  p = posts().pop();
  check('Guardar: manda activo, texto, enlace y fecha', p.cuerpo.seccion === 'aviso' && p.cuerpo.datos.activo === true && p.cuerpo.datos.hasta === en3 && p.cuerpo.datos.enlace === '/cursos-abiertos');
  check('"Vence en 3 días" con ícono de reloj y en ámbar (texto, no solo color)', /Vence en 3 días/.test(txt('#pzAvChip')) && q('#pzAvChip').classList.contains('pz-aviso') && q('#pzAvChip svg'), txt('#pzAvChip'));
  check('la franja de estado también avisa del vencimiento próximo', q('#pzEstado').classList.contains('pz-aviso') && /vence en 3 días/i.test(txt('#pzEstadoTit')), txt('#pzEstadoTit'));
  q('#pzAvHasta').value = '2020-01-01'; guardado.aviso.hasta = '2020-01-01';
  q('.admin-nav-item[data-panel="personalizar"]').click(); await pausa(300);
  check('un aviso vencido se marca "Vencido" y dice que ya no se muestra', /Vencido/.test(txt('#pzAvChip')) && /Ya no se muestra/.test(txt('#pzEstadoSub')), txt('#pzAvChip') + ' / ' + txt('#pzEstadoSub'));

  volcar('personalizar-guardado');
  console.log('Seguridad del panel');
  escribir('pzAvTexto', '<img src=x onerror=alert(1)>');
  check('el texto con HTML se ve como TEXTO en la vista previa (no se interpreta)', !q('#pzAvPrev img') && /<img src=x/.test(txt('#pzAvPrev')));
  guardado.perfiles = { linkedinPersonal: '', linkedinEmpresa: '', youtube: '' }; guardado.contacto = { correo: '<b>x</b>@y.co', whatsapp: '528111111111' };
  q('.admin-nav-item[data-panel="personalizar"]').click(); await pausa(300);
  check('un correo con HTML guardado se muestra como texto (value), sin crear elementos', q('#pzCoCorreo').value === '<b>x</b>@y.co' && !q('#pzCardContacto b'));

  console.log(fallos ? '\n' + fallos + ' FALLARON' : '\npanel Personalizar: todo en orden');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
