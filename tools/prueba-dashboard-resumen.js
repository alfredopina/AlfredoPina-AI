// tools/prueba-dashboard-resumen.js — prueba funcional de Dashboard → Resumen (dinero): carga admin/index.html en jsdom con un servidor falso que responde
// con la salida REAL de api/src/dashboard-dinero.js (así se prueba también el contrato servidor ↔ pantalla). Datos ficticios; no toca nada real.
// jsdom NO es dependencia del proyecto (ver tools/prueba-barra-admin.js):
//   set JSDOM_DIR=%TEMP%jsdom-barra && node tools/prueba-dashboard-resumen.js
// Con VOLCAR_HTML=carpeta guarda el DOM (sin scripts) para tomarle captura.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_DIR ? path.join(process.env.JSDOM_DIR, 'node_modules', 'jsdom') : 'jsdom');
const { calcularDinero } = require('../api/src/dashboard-dinero');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');

const ms = (s) => Date.parse(s + 'T06:00:00Z');
const AHORA = new Date('2026-10-28T18:00:00Z');
const cuenta = (o) => ({ estrategia: 'empresas', tipo_factura: 'Empresa', estatus: 'Facturada', subtotal: 1000, total: 1160, emision: null, creada: ms('2026-01-01'), vencimiento: null, tipo: 'Directo', herrs: ['excel'], pagos: [], ...o });
const cot = (o) => ({ id: 0, estatus: 'Enviada', precio: 0, alt: null, herr: 'excel', creada: ms('2026-01-01'), enviada: ms('2026-01-01'), cierre: null, cierreReal: null, motivo: null, tipo: 'Directo', ...o });
const sol = (o) => ({ herr: 'excel', canal: 'Sitio', estatus: 'Nueva', creada: ms('2026-10-03'), tipo: 'Directo', ...o });
const DATOS = {
  cuentas: [
    cuenta({ emision: '2026-08-20', creada: ms('2026-08-20'), vencimiento: '2026-09-19', pagos: [{ fecha: '2026-09-10', creada: ms('2026-09-10'), monto: 1160, anulado: false }], estatus: 'Pagada' }),
    cuenta({ subtotal: 3000, total: 3480, emision: '2026-09-10', creada: ms('2026-09-10'), vencimiento: '2026-10-10', herrs: ['powerbi'], pagos: [{ fecha: '2026-10-12', creada: ms('2026-10-12'), monto: 1740, anulado: false }] }),
    cuenta({ subtotal: 400, total: 464, emision: '2026-10-01', creada: ms('2026-10-01'), vencimiento: '2026-11-30' }),
    cuenta({ subtotal: 500, total: 580, estatus: 'Por facturar', creada: ms('2026-10-15'), cotId: 3, herrs: ['powerbi'] }),
  ],
  cotizaciones: [
    cot({ id: 1, estatus: 'Ganada', precio: 10000, enviada: ms('2026-08-25'), cierre: ms('2026-09-12') }),
    cot({ id: 2, estatus: 'Perdida', precio: 4000, enviada: ms('2026-09-01'), cierre: ms('2026-09-20'), motivo: 'Precio alto' }),
    cot({ id: 3, estatus: 'Ganada', precio: 6000, herr: 'powerbi', enviada: ms('2026-09-25'), cierre: ms('2026-10-08') }),
    cot({ id: 4, precio: 8000, enviada: ms('2026-10-10') }),
    cot({ id: 5, estatus: 'Perdida', precio: 2500, enviada: ms('2026-10-05'), cierre: ms('2026-10-20'), motivo: 'Sin respuesta' }),
  ],
  solicitudes: [sol({}), sol({ estatus: 'Cotizada', creada: ms('2026-10-04') }), sol({ estatus: 'Cotizada', canal: 'Manual', creada: ms('2026-10-06') }), sol({ estatus: 'Cotizada', creada: ms('2026-09-10') })],
};
let METAS = {}; // metas propias de Configuración → Metas (se cambian en la prueba)

const llamadas = [];
let fallarResumen = null; // status de error a devolver
function respuesta(cuerpo, status = 200) { return Promise.resolve({ ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) }); }
function fetchFalso(url) {
  const u = String(url); llamadas.push(u);
  if (u.includes('/api/getDashboardResumenAdmin')) {
    if (fallarResumen) return respuesta({ error: 'Error de prueba' }, fallarResumen);
    const p = new URL(u, 'https://x.test').searchParams;
    const r = calcularDinero(DATOS, { mes: p.get('mes') || '', estrategia: p.get('estrategia') || '', tipoCliente: p.get('tipoCliente') || '', herramienta: p.get('herramienta') || '' }, { ahora: AHORA, metas: METAS });
    r.meta.generado = '2026-10-28T16:42:00.000Z';
    return respuesta(r);
  }
  if (u.includes('/.auth/me')) return respuesta({ clientPrincipal: { userDetails: 'alfredo.pina@lifezen.com.mx', userRoles: ['admin'] } });
  if (/\/api\/(list|buscarClientes|getResumen|getCatalogo|getRecursos|getModelo)/.test(u)) return respuesta([]);
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
const qa = (s) => [...d.querySelectorAll(s)];
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
const volcar = (nombre) => { if (!process.env.VOLCAR_HTML) return; const copia = d.documentElement.cloneNode(true); copia.querySelectorAll('script').forEach((s) => s.remove()); fs.writeFileSync(path.join(process.env.VOLCAR_HTML, nombre + '.html'), '<!doctype html>' + copia.outerHTML); };
const cambia = (sel, valor) => { const s = q(sel); s.value = valor; s.dispatchEvent(new w.Event('change', { bubbles: true })); };
const resumenes = () => llamadas.filter((u) => u.includes('getDashboardResumenAdmin'));
const nombres = () => qa('.rs-fila .nm .a').map((e) => txt(e).replace(/FOCO: AUMENTAR|SIN FILTRAR/g, '').trim()).join('|');
const ancho = (sel) => parseFloat((q(sel) || { style: { width: '0' } }).style.width);
const segs = (k) => qa('.rs-fila[data-k="' + k + '"] .rs-lg > span').map((e) => txt(e).replace(/\s*[\d$].*$/, '').trim());

(async () => {
  await pausa(700);
  check('el script de la página corrió sin errores graves', errores.filter((e) => !/Not implemented|navigation|resource/i.test(e)).length === 0, errores.slice(0, 3).join(' | '));
  check('al abrir /admin NO se pide el Resumen (solo al entrar al Dashboard)', resumenes().length === 0);

  console.log('Estructura del panel');
  check('pestañas: Resumen, Cobranza, Ventas, Operaciones (las tres últimas «pronto») y Productos', qa('#dashTabs .dash-etab').map((b) => txt(b)).join('|') === 'Resumen|Cobranzapronto|Ventaspronto|Operacionespronto|Productos', qa('#dashTabs .dash-etab').map((b) => txt(b)).join('|'));
  check('un panel de pestaña por cada una', qa('#panel-dashboard > .dash-tabpanel').map((p) => p.id).join('|') === 'dashTab-resumen|dashTab-cobranza|dashTab-ventas|dashTab-operaciones|dashTab-productos');
  check('Resumen es la pestaña abierta por defecto', q('#dashTab-resumen').classList.contains('active') && !q('#dashTab-productos').classList.contains('active'));
  check('Productos conserva su contenido (KPIs, inventario y huecos)', q('#dashTab-productos #dashKpis') && q('#dashTab-productos #dashInv') && q('#dashTab-productos #dashHuecos'));
  check('filtros: botones de limpiar y actualizar solo con ícono (con nombre accesible) y selector de comparación de 3 botones', q('#rsLimpiar svg') && !txt(q('#rsLimpiar')) && q('#rsLimpiar').getAttribute('aria-label') && q('#rsActualizar svg') && !txt(q('#rsActualizar')) && qa('#rsModo button').length === 3);

  console.log('Entrar al Dashboard desde la barra superior');
  q('#btnDashboard').click(); await pausa(400);
  check('pide el Resumen una sola vez', resumenes().length === 1, String(resumenes().length));
  check('una sola pantalla: ya no hay selector de vistas', !q('.rs-vista') && !q('#rsVistas'));
  check('el embudo: Solicitudes → Cotizado → Ganado → Facturado → Cobrado', nombres() === 'Solicitudes|Cotizado|Ganado|Facturado|Cobrado', nombres());
  check('Cotizado lleva la etiqueta de foco', /FOCO: AUMENTAR/.test(txt(q('.rs-fila[data-k="cot"] .nm'))));
  check('Solicitudes es una cantidad (3 en octubre), no pesos', /^3 solicitudes/.test(txt(q('.rs-fila[data-k="sol"] .vv'))), txt(q('.rs-fila[data-k="sol"] .vv')));
  check('montos sin IVA: cotizado de octubre = $8,000 (abierta) + $2,500 (perdida) = $10,500', txt(q('.rs-fila[data-k="cot"] .vv')) === '$10,500', txt(q('.rs-fila[data-k="cot"] .vv')));
  check('cada fila: barra apilada, línea de 12 meses y variación con ÍCONO + TEXTO', qa('.rs-fila').every((f) => f.querySelector('.rs-stk') && f.querySelector('.rs-sp2') && f.querySelector('.rs-d svg') && txt(f.querySelector('.rs-d')).length > 2));
  check('Cotizado se reparte por tipo de servicio, con cuántas cotizaciones son y su monto (aquí solo cursos estándar: 2 cotizaciones)', segs('cot').join('|') === 'Cursos estándar' && /2 cotizaciones/.test(txt(q('.rs-fila[data-k="cot"] .rs-lg'))) && /\$10,500/.test(txt(q('.rs-fila[data-k="cot"] .rs-lg'))), txt(q('.rs-fila[data-k="cot"] .rs-lg')));
  check('la etiqueta de cada segmento es su MONTO (no un porcentaje): el de Cotizado dice $10,500; el de Solicitudes, una cantidad', /^\$10,500$/.test(txt(q('.rs-fila[data-k="cot"] .rs-stk .rs-sg'))) && /^\d+$/.test(txt(q('.rs-fila[data-k="sol"] .rs-stk .rs-sg'))) && !/%/.test(txt(q('.rs-fila[data-k="cot"] .rs-stk'))), txt(q('.rs-fila[data-k="cot"] .rs-stk')) + ' / ' + txt(q('.rs-fila[data-k="sol"] .rs-stk')));
  check('Solicitudes: del sitio, manuales y SIN ATENDER (ámbar) con ícono de alerta en la leyenda', segs('sol').join('|') === 'Del sitio|Manuales|Sin atender' && !!q('.rs-fila[data-k="sol"] .rs-lg .mal-i.pend svg') && !!q('.rs-fila[data-k="sol"] .rs-stk .rs-sg.pend'), segs('sol').join('|'));
  check('Ganado: los $6,000 de la cotización ganada siguen Por facturar (cuenta ligada sin factura), en ámbar con ícono', segs('gan').join('|') === 'Por facturar' && !!q('.rs-fila[data-k="gan"] .mal-i.pend svg'), segs('gan').join('|'));
  check('Facturado: lo emitido en octubre ($400) está Por cobrar en plazo; no hay vencido, así que no hay rojo', segs('fac').join('|') === 'Por cobrar en plazo' && !q('.rs-fila[data-k="fac"] .rs-sg.venc'), segs('fac').join('|'));
  check('Cobrado: $1,500 de facturas de meses anteriores (la de septiembre) y nada de este mes', segs('cob').join('|') === 'De meses anteriores' && txt(q('.rs-fila[data-k="cob"] .vv')) === '$1,500', segs('cob').join('|') + ' ' + txt(q('.rs-fila[data-k="cob"] .vv')));
  check('lo normal va sin color de alerta: Cotizado y Cobrado no traen ámbar ni rojo', !q('.rs-fila[data-k="cot"] .rs-sg.pend, .rs-fila[data-k="cot"] .rs-sg.venc, .rs-fila[data-k="cob"] .rs-sg.pend, .rs-fila[data-k="cob"] .rs-sg.venc'));
  check('lo atendido de Solicitudes (2 de 3) mide lo mismo que la barra de Cotizado (misma escala)', Math.abs(ancho('.rs-fila[data-k="sol"] .rs-stk') * 2 / 3 - ancho('.rs-fila[data-k="cot"] .rs-stk')) < 0.6, ancho('.rs-fila[data-k="sol"] .rs-stk') + ' vs ' + ancho('.rs-fila[data-k="cot"] .rs-stk'));
  check('cada segmento mide en proporción a su valor dentro de la barra (Solicitudes: 1, 1 y 1)', qa('.rs-fila[data-k="sol"] .rs-stk .rs-sg').map((s) => s.style.flex.replace(/\s+/g, ' ')).join('|') === '1 1 0px|1 1 0px|1 1 0px' || qa('.rs-fila[data-k="sol"] .rs-stk .rs-sg').every((s) => /^1 /.test(s.style.flex)), qa('.rs-fila[data-k="sol"] .rs-stk .rs-sg').map((s) => s.style.flex).join('|'));
  check('cada barra trae su contorno punteado de meta, con ancho', qa('.rs-fila').every((f) => f.querySelector('.rs-goal')) && qa('.rs-goal').every((g) => parseFloat(g.style.width) > 0));
  check('la meta se explica con texto e ícono («sobre su meta» o «bajo su meta») y dice si es promedio', qa('.rs-fila .rs-est').every((e) => /meta/.test(txt(e)) && e.querySelector('svg')) && /prom\. 12 m/.test(txt(q('.rs-fila[data-k="cot"] .rs-est'))), txt(q('.rs-fila[data-k="cot"] .rs-est')));
  check('el tooltip de un segmento dice nombre, monto y cuántas cotizaciones', qa('.rs-fila[data-k="cot"] .rs-stk .rs-sg').some((s) => /Cursos estándar/.test(s.dataset.tip) && /\$10,500/.test(s.dataset.tip) && /2 cotizaciones/.test(s.dataset.tip)));
  check('puntos de la línea con mes y monto para el tooltip', qa('.rs-fila[data-k="cot"] .hit').length >= 3 && qa('.rs-fila[data-k="cot"] .hit').every((h) => /\|/.test(h.dataset.tip)) && /al día 28/.test(qa('.rs-fila[data-k="cot"] .hit').pop().dataset.tip));
  check('la variación trae porcentaje y monto («vs sep»); Solicitudes lo da en cantidad', /vs sep/.test(txt(q('.rs-fila[data-k="cot"] .rs-dl'))) && /[+−]\$/.test(txt(q('.rs-fila[data-k="cot"] .rs-dl'))) && /solicitud/.test(txt(q('.rs-fila[data-k="sol"] .rs-dl'))), txt(q('.rs-fila[data-k="sol"] .rs-vc')));
  check('tres lecturas, una por etapa (Cotizado, Facturado, Cobrado), con ícono + palabra y un botón al Tracking', qa('.rs-in').length === 3 && qa('.rs-in').map((i) => txt(i.querySelector('.tg')).split('·')[1].trim()).join('|') === 'COTIZADO|FACTURADO|COBRADO' && qa('.rs-in').every((i) => i.querySelector('.tg svg') && /ATENCIÓN|REVISAR|DATO|VA BIEN/.test(txt(i.querySelector('.tg'))) && i.querySelector('button[data-panel]')));
  check('la lectura de Cotizado avisa de la solicitud sin atender', /1 solicitud sin atender/.test(txt(qa('.rs-in')[0])), txt(qa('.rs-in')[0]));
  check('la lectura de Facturado habla de lo ganado sin factura y del vencido de toda la cartera', /ganados sin factura/.test(txt(qa('.rs-in')[1])) && /vencidos/.test(txt(qa('.rs-in')[1])), txt(qa('.rs-in')[1]));
  check('franja «Hoy» con toda la cartera: Por vender $8,000, Por facturar $500, Por cobrar $1,900 con $1,500 vencido (ícono + texto)', /Por vender \$8,000/.test(txt(q('.rs-hoy .hx:nth-child(1)'))) && /\$500/.test(txt(q('.rs-hoy .hx:nth-child(2)'))) && /\$1,900/.test(txt(q('.rs-hoy .hx:nth-child(3)'))) && /\$1,500 vencido/.test(txt(q('.rs-hoy .rs-d.urg'))) && !!q('.rs-hoy .rs-d.urg svg'), txt(q('.rs-hoy')));
  check('el encabezado de columnas dice contra qué se compara', /VARIACIÓN vs SEP/.test(txt(q('.rs-cab'))), txt(q('.rs-cab')));
  volcar('dashboard-resumen');

  console.log('Metas propias (Configuración → Metas)');
  METAS = { sol: 10, cot: 20000, gan: 5000 };
  q('#rsActualizar').click(); await pausa(300);
  check('la meta propia reemplaza al promedio y lo dice («meta $20,000»); Facturado usa la meta de Ganado ($5,000); Cobrado sigue con su promedio', /meta \$20,000/.test(txt(q('.rs-fila[data-k="cot"] .rs-est'))) && /bajo su meta/.test(txt(q('.rs-fila[data-k="cot"] .rs-est'))) && /meta \$5,000/.test(txt(q('.rs-fila[data-k="gan"] .rs-est'))) && /meta \$5,000/.test(txt(q('.rs-fila[data-k="fac"] .rs-est'))) && /prom\. 12 m/.test(txt(q('.rs-fila[data-k="cob"] .rs-est'))), txt(q('.rs-fila[data-k="fac"] .rs-est')));
  check('la barra y su contorno de meta guardan proporción: Solicitudes 3 de 10 (30 %) y Cotizado $10,500 de $20,000 (52 %)', Math.abs(ancho('.rs-fila[data-k="sol"] .rs-stk') / ancho('.rs-fila[data-k="sol"] .rs-goal') - 0.3) < 0.02 && Math.abs(ancho('.rs-fila[data-k="cot"] .rs-stk') / ancho('.rs-fila[data-k="cot"] .rs-goal') - 0.525) < 0.02, ancho('.rs-fila[data-k="sol"] .rs-stk') + '/' + ancho('.rs-fila[data-k="sol"] .rs-goal'));
  check('la meta de Solicitudes es una cantidad («meta 10») y la lectura de Cotizado dice «llegar a tu meta»', /meta 10/.test(txt(q('.rs-fila[data-k="sol"] .rs-est'))) && /para llegar a tu meta/.test(txt(qa('.rs-in')[0])), txt(q('.rs-fila[data-k="sol"] .rs-est')));
  METAS = {};
  q('#rsActualizar').click(); await pausa(300);

  console.log('Comparar con');
  const n0 = resumenes().length;
  q('#rsModo button[data-m="p3"]').click(); await pausa(50);
  check('promedio de 3 meses: cambia la etiqueta de la columna y de las píldoras, sin pedir datos', /VARIACIÓN vs PROM. 3 M/.test(txt(q('.rs-cab'))) && /vs prom. 3 m/.test(txt(q('.rs-fila[data-k="cot"] .rs-dl'))) && resumenes().length === n0, txt(q('.rs-fila[data-k="cot"] .rs-dl')));
  q('#rsModo button[data-m="anio"]').click(); await pausa(50);
  check('año pasado sin historia: «sin datos» con ícono (no un número inventado)', qa('.rs-fila .rs-d.na').length === 5 && /sin datos/.test(txt(q('.rs-fila[data-k="cot"] .rs-d'))) && q('.rs-fila[data-k="cot"] .rs-d svg'));
  check('las lecturas siguen funcionando sin referencia del año pasado', qa('.rs-in').length === 3);
  q('#rsModo button[data-m="mes"]').click(); await pausa(50);
  check('mes anterior: el botón queda resaltado', q('#rsModo button[data-m="mes"]').classList.contains('on') && qa('#rsModo button.on').length === 1);

  console.log('Ayuda');
  check('el panel de ayuda empieza cerrado', q('#rsPop').hidden);
  q('#rsAyuda').click();
  check('el botón ? abre la explicación del embudo, los colores, la línea y la variación', !q('#rsPop').hidden && /BARRAS/.test(txt(q('#rsPop'))) && /COLORES/.test(txt(q('#rsPop'))) && /GRÁFICA DE 12 MESES/.test(txt(q('#rsPop'))) && /VARIACIÓN/.test(txt(q('#rsPop'))) && q('#rsAyuda').getAttribute('aria-expanded') === 'true');
  d.body.click();
  check('un clic fuera la cierra', q('#rsPop').hidden);

  console.log('Filtros');
  cambia('#rsHerramienta', 'powerbi'); await pausa(300);
  check('pide con herramienta=powerbi', resumenes().pop().includes('herramienta=powerbi'), resumenes().pop());
  check('el filtro activo se resalta y el mes no', q('#rsHerramienta').parentNode.classList.contains('act') && !q('#rsSwMes').classList.contains('act'));
  check('Power BI: cotizado de octubre en $0 y ganado de $6,000 (la cotización que lleva esa herramienta)', txt(q('.rs-fila[data-k="cot"] .vv')) === '$0' && txt(q('.rs-fila[data-k="gan"] .vv')) === '$6,000', txt(q('.rs-fila[data-k="cot"] .vv')) + ' ' + txt(q('.rs-fila[data-k="gan"] .vv')));
  check('avisa que las cuentas manuales sin herramienta no se incluyen', /cuentas manuales/.test(txt(q('.rs-nota'))), txt(q('.rs-nota')));
  cambia('#rsEstrategia', 'abiertos'); await pausa(300);
  check('Estrategia solo existe en Cobranza: Solicitudes, Cotizado y Ganado quedan SIN FILTRAR con ícono y texto', qa('.rs-fila .rs-nf').length === 3 && qa('.rs-nf').every((t) => /SIN FILTRAR/.test(txt(t)) && t.querySelector('svg')), String(qa('.rs-fila .rs-nf').length));
  check('en la franja «Hoy» solo Por vender queda sin filtrar', qa('.rs-hoy .rs-nf').length === 1);
  cambia('#rsMes', 'todo'); await pausa(300);
  check('«Todo el historial» pide mes=todo, resalta el mes y muestra «acumulado» sin meta', resumenes().pop().includes('mes=todo') && q('#rsSwMes').classList.contains('act') && qa('.rs-d.acum').length === 5 && /sin meta aún/.test(txt(q('.rs-fila .rs-est'))));
  q('#rsLimpiar').click(); await pausa(300);
  const ultima = resumenes().pop();
  check('Limpiar filtros regresa todo a su valor inicial y pide sin filtros', !/estrategia|herramienta|mes=/.test(ultima) && !qa('.rs-sw.act').length && qa('.rs-nf').length === 0, ultima);
  check('el mes vuelve al mes en curso', /Octubre 2026/.test(q('#rsMes').selectedOptions[0].textContent));
  cambia('#rsMes', '2026-09'); await pausa(300);
  check('mes pasado: título de mes completo, sin «al día» en la línea, franja «Al cierre de sep 26» y pide mes=2026-09', resumenes().pop().includes('mes=2026-09') && /mes completo/i.test(txt(q('.rs-emb-t small'))) && !/al día/.test(qa('.rs-fila[data-k="cot"] .hit').pop().dataset.tip) && /AL CIERRE DE SEP 26/.test(txt(q('.rs-hoy-t'))), txt(q('.rs-emb-t small')) + ' / ' + txt(q('.rs-hoy-t')));
  q('#rsLimpiar').click(); await pausa(300);

  console.log('Navegación');
  const antes = resumenes().length;
  qa('.rs-in button').find((b) => b.dataset.panel === 'cobranza').click(); await pausa(200);
  check('el botón de una lectura abre el Tracking de Cobranza', q('#panel-cobranza').classList.contains('active') && !q('#panel-dashboard').classList.contains('active'));
  q('#btnDashboard').click(); await pausa(400);
  check('volver al Dashboard desde la barra refresca el Resumen', resumenes().length === antes + 1, String(resumenes().length - antes));
  q('#dashTabs .dash-etab[data-dashtab="ventas"]').click(); await pausa(100);
  check('una pestaña pendiente (Ventas) muestra su explicación y apaga el Resumen', q('#dashTab-ventas').classList.contains('active') && !q('#dashTab-resumen').classList.contains('active') && /Solicitudes, Cotizaciones y Clientes/.test(txt(q('#dashTab-ventas'))));
  q('#dashTabs .dash-etab[data-dashtab="productos"]').click(); await pausa(300);
  check('pestaña Productos: se activa su panel', q('#dashTab-productos').classList.contains('active') && !q('#dashTab-ventas').classList.contains('active'));
  check('cambiar de pestaña no apaga las pestañas de OTROS paneles (Diagnósticos)', !!q('#diagTabs .dash-etab.active'));
  const n2 = resumenes().length;
  q('#dashTabs .dash-etab[data-dashtab="resumen"]').click(); await pausa(300);
  check('volver a la pestaña Resumen lo refresca', resumenes().length === n2 + 1 && q('#dashTab-resumen').classList.contains('active'));

  console.log('Errores');
  fallarResumen = 400;
  q('#rsActualizar').click(); await pausa(300);
  check('un error del servidor muestra aviso con texto y botón Reintentar (sin perder lo pintado)', !q('#rsAviso').hidden && /No se pudo cargar el resumen: Error de prueba/.test(txt(q('#rsAvisoTxt'))) && qa('.rs-fila').length === 5);
  fallarResumen = null;
  q('#rsReintentar').click(); await pausa(300);
  check('Reintentar lo vuelve a cargar y oculta el aviso', q('#rsAviso').hidden && /^Actualizar · hoy/.test(q('#rsActualizar').dataset.tt));

  check('sin errores de la página al final', errores.filter((e) => !/Not implemented|navigation|resource/i.test(e)).length === 0, errores.slice(0, 3).join(' | '));
  console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : '\nTodas las comprobaciones de Dashboard → Resumen pasaron.');
  process.exit(fallos ? 1 : 0);
})();
