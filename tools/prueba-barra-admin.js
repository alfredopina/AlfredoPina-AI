// tools/prueba-barra-admin.js — prueba funcional de la BARRA SUPERIOR del admin (Inicio, Alertas, Pendientes, estado de la base, tema,
// avatar y búsqueda global) cargando admin/index.html en jsdom con un servidor falso. No toca nada real.
// jsdom NO es dependencia del proyecto: instálalo en una carpeta temporal y apunta a ella:
//   mkdir %TEMP%jsdom-barra && cd %TEMP%jsdom-barra && npm init -y && npm i jsdom@24
//   set JSDOM_DIR=%TEMP%jsdom-barra && node tools/prueba-barra-admin.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_DIR ? path.join(process.env.JSDOM_DIR, 'node_modules', 'jsdom') : 'jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');

const llamadas = [];
let estadoBase = { estado: 'dormida', crudo: 'Paused', cuotaSegundos: 35298, cuotaEn: new Date(Date.now() - 4 * 86400000).toISOString() };
let alertas = { total: 3, umbrales: {}, grupos: { solicitudes: [], cotizaciones: [], grupos: [], clientes: [] } };
function respuesta(cuerpo, status = 200) { return Promise.resolve({ ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) }); }
function fetchFalso(url) {
  const u = String(url); llamadas.push(u);
  if (u.includes('/api/getEstadoBase')) return respuesta(estadoBase);
  if (u.includes('/api/getNotificacionesActivas')) return respuesta(alertas);
  if (u.includes('/api/listPendientes')) return respuesta({ categorias: [], pendientes: [{ id: 'a', archivado: false }, { id: 'b', archivado: false }, { id: 'c', archivado: true }] });
  if (u.includes('/api/buscarGlobalAdmin')) {
    const q = decodeURIComponent(u.split('q=')[1] || '');
    return respuesta({ q, clientes: [{ id: 7, nombre: 'Acme SA', codigo: 'ACME', tipo_cliente: 'Directo' }], cotizaciones: [{ id: 9, folio: 'AP_EXCEL_ACME_1', cliente: 'Acme SA', herramienta: 'excel', estatus: 'Enviada' }], grupos: [], solicitudes: [], contactos: [{ id: 3, nombre: 'Ana Acme', cliente_id: 7, cliente: 'Acme SA', correo: 'ana@acme.com' }] });
  }
  if (u.includes('/.auth/me')) return respuesta({ clientPrincipal: { userDetails: 'alfredo.pina@lifezen.com.mx', userRoles: ['admin'] } });
  if (/\/api\/(list|buscarClientes)/.test(u)) return respuesta([]);
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

(async () => {
  await pausa(600);
  console.log('Carga');
  check('el script de la página corrió sin errores graves', errores.filter((e) => !/Not implemented|navigation|resource/i.test(e)).length === 0, errores.slice(0, 3).join(' | '));
  // ESTRUCTURA: un <div> de más o de menos al editar la barra saca los paneles del diseño y el admin queda en blanco (pasó el 2026-10-24 al quitar "+ Nuevo")
  const barra = q('.admin-topbar'), contenido = q('.admin-content');
  check('la barra y el contenido son hermanos (misma caja padre)', barra && contenido && barra.parentElement === contenido.parentElement);
  check('la barra lleva dentro la búsqueda Y el bloque derecho (sesión, tema, estado de la base)', barra.contains(q('.tb-zona-izq')) && barra.contains(q('.admin-user')) && barra.contains(q('#btnDespertar')) && barra.contains(q('#tbAvatar')));
  check('todos los paneles están dentro del contenido', Array.from(d.querySelectorAll('.admin-panel')).every((p) => contenido.contains(p)));
  check('Tracking View ya NO está en el menú lateral', !q('.admin-nav-item[data-panel="tracking-view"]'));
  check('la pantalla de aterrizaje sigue siendo Tracking View (panel activo y título)', q('#panel-tracking-view').classList.contains('active') && txt('#topbarTitle') === 'Tracking View');
  check('Inicio nace resaltado', q('#btnInicio').classList.contains('activo'));

  console.log('Estado de la base (chip)');
  check('base dormida: etiqueta con texto y cuota a la vista', txt('#tbBdTxt') === 'Dormida · 35 %', txt('#tbBdTxt'));
  check('el tooltip trae los segundos y la antigüedad de la lectura', /35,298|35\.298/.test(q('#btnDespertar').title) && /hace 4 días/.test(q('#btnDespertar').title), q('#btnDespertar').title);
  check('dormida: ícono de luna y sin clase de color', !q('#btnDespertar').classList.contains('db-despierta'));

  console.log('Alertas y Pendientes');
  await pausa(300);
  check('Pendientes muestra 2 (las notas activas, sin archivadas)', txt('#tbPendN') === '2' && !q('#tbPendN').hidden, txt('#tbPendN'));

  check('Alertas: con 3 activas, el botón se marca en rojo y muestra el número', q('#btnNotificaciones').classList.contains('notif-vivo') && txt('#tbAlertasN') === '3' && !q('#tbAlertasN').hidden && /3 alertas/.test(q('#btnNotificaciones').title), txt('#tbAlertasN'));
  console.log('Navegación y resaltado');
  q('#btnPendientes').click(); await pausa(50);
  check('Pendientes: abre su panel y el botón queda resaltado', q('#panel-pendientes').classList.contains('active') && q('#btnPendientes').classList.contains('activo') && !q('#btnInicio').classList.contains('activo') && txt('#topbarTitle') === 'Pendientes');
  q('#btnConfig').click(); await pausa(50);
  check('Configuración: resaltada', q('#panel-config').classList.contains('active') && q('#btnConfig').classList.contains('activo') && !q('#btnPendientes').classList.contains('activo'));
  const antes = llamadas.filter((u) => u.includes('listPendientes')).length;
  q('#btnInicio').click(); await pausa(100);
  check('Inicio: vuelve al Tracking View y se resalta', q('#panel-tracking-view').classList.contains('active') && q('#btnInicio').classList.contains('activo') && !q('#btnConfig').classList.contains('activo'));
  q('#btnNotificaciones').click(); await pausa(50);
  check('Alertas: abre su panel y se resalta', q('#panel-alertas').classList.contains('active') && q('#btnNotificaciones').classList.contains('activo'));
  q('#btnPendientes').click(); await pausa(30); q('#btnInicio').click(); await pausa(100);
  check('al salir de Pendientes se refresca su contador', llamadas.filter((u) => u.includes('listPendientes')).length > antes);

  console.log('Tema');
  const tema0 = d.documentElement.getAttribute('data-theme');
  q('#themeToggle').click();
  check('el botón de tema alterna claro/oscuro', d.documentElement.getAttribute('data-theme') !== tema0 && /Cambiar a/.test(q('#themeToggle').title));
  q('#themeToggle').click();

  console.log('Menú del avatar');
  q('#tbAvatar').click();
  check('abre con el correo y "Cerrar sesión"', !q('#tbAvatarMenu').hidden && /Cerrar sesión/.test(q('#tbAvatarMenu').textContent) && q('#tbAvatarMenu a').getAttribute('href').includes('/.auth/logout'));
  check('el correo de la sesión se llena en el menú', /lifezen/.test(txt('#userEmail')), txt('#userEmail'));
  d.body.click();
  check('un clic fuera lo cierra', q('#tbAvatarMenu').hidden);

  console.log('Búsqueda global');
  const input = q('#tbBuscar');
  input.value = 'a'; input.dispatchEvent(new w.Event('input')); await pausa(600);
  check('con 1 letra no consulta (mínimo 2)', !llamadas.some((u) => u.includes('buscarGlobalAdmin')));
  input.value = 'Acme'; input.dispatchEvent(new w.Event('input')); await pausa(800);
  check('con 2+ letras consulta (tras esperar a que dejes de escribir) y muestra resultados agrupados', llamadas.filter((u) => u.includes('buscarGlobalAdmin')).length === 1 && !q('#tbResultados').hidden && d.querySelectorAll('.tb-res-grupo').length === 3 && d.querySelectorAll('.tb-res-item').length === 3, 'grupos ' + d.querySelectorAll('.tb-res-grupo').length);
  check('manda el texto en la dirección y sin pegarlo en rutas raras', llamadas.some((u) => u.endsWith('/api/buscarGlobalAdmin?q=Acme')));
  check('los resultados nombran cliente, folio y contacto', /Acme SA/.test(q('#tbResultados').textContent) && /AP_EXCEL_ACME_1/.test(q('#tbResultados').textContent) && /Ana Acme/.test(q('#tbResultados').textContent));
  let destino = null; w.irAAlerta = (k, id) => { destino = [k, id]; };
  input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  check('flecha abajo marca el primer resultado', d.querySelectorAll('.tb-res-item.activo').length === 1);
  input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  check('Enter abre el resultado marcado (cliente 7) y cierra la lista', destino && destino[0] === 'clientes' && destino[1] === 7 && q('#tbResultados').hidden, JSON.stringify(destino));
  input.value = 'Acme'; input.dispatchEvent(new w.Event('input')); await pausa(800);
  const items = d.querySelectorAll('.tb-res-item');
  items[2].click();
  check('un contacto lleva a SU cliente', destino && destino[0] === 'clientes' && destino[1] === 7);
  items[1].click && (input.value = 'Acme', input.dispatchEvent(new w.Event('input')), await pausa(800), d.querySelectorAll('.tb-res-item')[1].click());
  check('una cotización lleva a su seguimiento', destino && destino[0] === 'cotizaciones' && destino[1] === 9, JSON.stringify(destino));

  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  check('Ctrl+K enfoca la búsqueda desde cualquier panel', d.activeElement === input);
  input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Escape cierra y suelta el foco', q('#tbResultados').hidden && d.activeElement !== input);

  console.log('Estado de la base: despierta y cuota baja');
  estadoBase = { estado: 'despierta', crudo: 'Online', cuotaSegundos: 15000, cuotaEn: new Date().toISOString() };
  w.dispatchEvent(new w.Event('focus')); d.dispatchEvent(new w.Event('visibilitychange'));
  await pausa(300);
  check('despierta: texto, porcentaje y borde de "baja" (≤ 20 %)', txt('#tbBdTxt') === 'Despierta · 15 %' && q('#btnDespertar').classList.contains('db-despierta') && q('#btnDespertar').classList.contains('db-baja') && /baja/.test(q('#btnDespertar').title), txt('#tbBdTxt') + ' ' + q('#btnDespertar').className);

  console.log(fallos ? '\n' + fallos + ' FALLARON' : '\nbarra superior: todo en orden');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
