// tools/prueba-dashboard-resumen.js — prueba funcional de Dashboard → Resumen (dinero): carga admin/index.html en jsdom con un servidor falso que responde
// con la salida REAL de api/src/dashboard-dinero.js (así se prueba también el contrato servidor ↔ pantalla). Datos ficticios; no toca nada real.
// jsdom NO es dependencia del proyecto (ver tools/prueba-barra-admin.js):
//   set JSDOM_DIR=%TEMP%jsdom-barra && node tools/prueba-dashboard-resumen.js
// Con VOLCAR_HTML=carpeta guarda el DOM (sin scripts) para tomarle captura.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_DIR ? path.join(process.env.JSDOM_DIR, 'node_modules', 'jsdom') : 'jsdom');
const { calcularDinero } = require('../api/src/dashboard-dinero');
const { calcularLecturas } = require('../api/src/dashboard-lecturas');
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
    const l = calcularLecturas(DATOS, r, { ahora: AHORA, umbrales: { cotizacionesSeguimientoDias: 6, cotizacionesDias: 10, solicitudesSeguimientoHoras: 24, solicitudesHoras: 72, cobranzaPorVencerDias: 7 } });
    r.lecturas = l.principales; r.lecturasOtras = l.otras;
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
const rgbAHex = (c) => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(c); return m ? '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('') : c; };
const ancho = (sel) => parseFloat((q(sel) || { style: { width: '0' } }).style.width);
const segs = (k) => qa('.rs-fila[data-k="' + k + '"] .rs-lg > span').map((e) => txt(e).replace(/\s*[\d$(].*$/, '').trim());

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
  check('el embudo: Solicitudes → Cotizado → Ganado → Facturado → Cobrado', nombres() === 'Solicitudes|Cotizado|Vendido|Facturado|Cobrado', nombres());
  check('Cotizado ya no lleva la etiqueta de foco, y las filas no traen subtítulo', !/FOCO/.test(txt(q('.rs-fila[data-k="cot"] .nm'))) && !q('.rs-fila .nm .b'));
  check('Solicitudes es una cantidad (3 en octubre), no pesos', /^3 solicitudes/.test(txt(q('.rs-fila[data-k="sol"] .vv'))), txt(q('.rs-fila[data-k="sol"] .vv')));
  check('montos sin IVA: cotizado de octubre = $8,000 (abierta) + $2,500 (perdida) = $10,500', txt(q('.rs-fila[data-k="cot"] .vv')) === '$10,500', txt(q('.rs-fila[data-k="cot"] .vv')));
  check('cada fila: barra con su marca de meta, línea de 12 meses y variación con ÍCONO + TEXTO', qa('.rs-fila').every((f) => f.querySelector('.rs-track .fill') && f.querySelector('.rs-sp2') && f.querySelector('.rs-d svg') && txt(f.querySelector('.rs-d')).length > 2));
  check('Cotizado: la leyenda trae estándar, personalizados y consultoría, con cuántas cotizaciones (entre paréntesis) y el monto (aquí 2 estándar)', segs('cot').join('|') === 'Estándar|Personalizados|Consultoría' && /Estándar \(2\) \$10,500/.test(txt(q('.rs-fila[data-k="cot"] .rs-lg'))), txt(q('.rs-fila[data-k="cot"] .rs-lg')));
  check('la barra se divide en segmentos con su monto dentro: Cotizado $10,500 en un segmento; Solicitudes 1, 1 y 1', txt(q('.rs-fila[data-k="cot"] .rs-track .fill')) === '$10,500' && qa('.rs-fila[data-k="sol"] .rs-track .sg').map((s) => txt(s)).join('|') === '1|1|1', txt(q('.rs-fila[data-k="cot"] .rs-track')) + ' / ' + qa('.rs-fila[data-k="sol"] .rs-track .sg').map((s) => txt(s)).join('|'));
  check('Solicitudes: la leyenda dice del sitio, manuales y sin atender (con ícono de alerta porque hay 1)', segs('sol').join('|') === 'Del sitio|Manuales|Sin atender' && !!q('.rs-fila[data-k="sol"] .rs-lg .mal-i svg'), segs('sol').join('|'));
  check('Vendido: la leyenda dice Facturado y Por facturar; los $6,000 siguen Por facturar (cuenta ligada sin factura), con ícono de alerta', segs('gan').join('|') === 'Facturado|Por facturar' && !!q('.rs-fila[data-k="gan"] .mal-i svg') && /Por facturar \$6,000/.test(txt(q('.rs-fila[data-k="gan"] .rs-lg'))), txt(q('.rs-fila[data-k="gan"] .rs-lg')));
  check('Facturado: cobrado, por cobrar en plazo ($400) y vencido (en cero: sin ícono de alerta)', segs('fac').join('|') === 'Cobrado|Por cobrar en plazo|Vencido' && /Por cobrar en plazo \$400/.test(txt(q('.rs-fila[data-k="fac"] .rs-lg'))) && !q('.rs-fila[data-k="fac"] .mal-i'), txt(q('.rs-fila[data-k="fac"] .rs-lg')));
  check('Cobrado: $1,500 de facturas de meses anteriores (la de septiembre) y $0 de este mes, ambas en la leyenda', segs('cob').join('|') === 'De este mes|De meses anteriores' && /De meses anteriores \$1,500/.test(txt(q('.rs-fila[data-k="cob"] .rs-lg'))) && txt(q('.rs-fila[data-k="cob"] .vv')) === '$1,500', txt(q('.rs-fila[data-k="cob"] .rs-lg')));
  check('las leyendas se muestran aunque valgan cero (atenuadas) y sus muestras son los mismos tonos de azul de los segmentos', qa('.rs-fila[data-k="cot"] .rs-lg > span.cero').length === 2 && qa('.rs-fila[data-k="cot"] .rs-lg > span').length === 3 && qa('.rs-lg i').every((i) => /^#(3d7fff|7fb0ff|cfe0ff)$/i.test(rgbAHex(i.style.backgroundColor))) && qa('.rs-fila[data-k="sol"] .rs-track .sg').length === 3 && qa('.rs-fila[data-k="sol"] .rs-track .sg.t0, .rs-fila[data-k="sol"] .rs-track .sg.t1, .rs-fila[data-k="sol"] .rs-track .sg.t2').length === 3, qa('.rs-lg i').map((i) => i.style.backgroundColor).join('|'));
  check('la meta de Solicitudes mide lo mismo que la de Cotizado: sus dos marcas quedan en el mismo punto', Math.abs(parseFloat(q('.rs-fila[data-k="sol"] .rs-track .meta').style.left) - parseFloat(q('.rs-fila[data-k="cot"] .rs-track .meta').style.left)) < 0.1, q('.rs-fila[data-k="sol"] .rs-track .meta').style.left + ' vs ' + q('.rs-fila[data-k="cot"] .rs-track .meta').style.left);
  check('cada barra trae su marca de meta (la del v4), con posición', qa('.rs-fila').every((f) => f.querySelector('.rs-track .meta')) && qa('.rs-track .meta').every((m) => parseFloat(m.style.left) > 0));
  check('la meta se muestra con TRIÁNGULO (verde hacia arriba si va sobre su meta, rojo hacia abajo si va por debajo) y la meta al lado; sin texto «sobre/bajo su meta» a la vista', qa('.rs-fila .rs-est').every((e) => e.querySelector('svg') && /meta|prom\. 12 m/.test(txt(e))) && !!q('.rs-fila[data-k="cot"] .rs-est .tri.up') && !!q('.rs-fila[data-k="fac"] .rs-est .tri.down') && /prom\. 12 m \$10,167/.test(txt(q('.rs-fila[data-k="cot"] .rs-est'))) && !!q('.rs-fila[data-k="cot"] .rs-est .rs-sr'), txt(q('.rs-fila[data-k="cot"] .rs-est')));
  check('al rebasar su meta la barra vibra (clase vibra) en lugar de cambiar de color; la que va por debajo no', !!q('.rs-fila[data-k="cot"] .rs-track .fill.vibra') && !q('.rs-fila[data-k="fac"] .rs-track .fill.vibra') && qa('.rs-track .fill.on, .rs-track .fill.off').length === 0);
  check('Facturado tiene un ícono distinto al de Cotizado', q('.rs-fila[data-k="fac"] .nm svg path').getAttribute('d') !== q('.rs-fila[data-k="cot"] .nm svg path').getAttribute('d'));
  check('Cotizado: 3 de $10,500 etiquetas dentro de la barra (tooltip con el tipo y cuántas cotizaciones)', /Estándar/.test(q('.rs-fila[data-k="cot"] .rs-track .sg').dataset.tip) && /2 cotizaciones/.test(q('.rs-fila[data-k="cot"] .rs-track .sg').dataset.tip), q('.rs-fila[data-k="cot"] .rs-track .sg').dataset.tip);
  check('puntos de la línea con mes y monto para el tooltip', qa('.rs-fila[data-k="cot"] .hit').length >= 3 && qa('.rs-fila[data-k="cot"] .hit').every((h) => /\|/.test(h.dataset.tip)) && /al día 28/.test(qa('.rs-fila[data-k="cot"] .hit').pop().dataset.tip));
  check('la variación trae porcentaje y monto («vs sep»); Solicitudes lo da en cantidad', /vs sep/.test(txt(q('.rs-fila[data-k="cot"] .rs-dl'))) && /[+−]\$/.test(txt(q('.rs-fila[data-k="cot"] .rs-dl'))) && /solicitud/.test(txt(q('.rs-fila[data-k="sol"] .rs-dl'))), txt(q('.rs-fila[data-k="sol"] .rs-vc')));
  check('tres lecturas elegidas por el servidor, cada una con ícono + palabra + la etapa, y un botón al Tracking donde se atiende', qa('.rs-in').length === 3 && qa('.rs-in').every((i) => i.querySelector('.tg svg') && /ATENCIÓN|REVISAR|DATO|VA BIEN/.test(txt(i.querySelector('.tg'))) && /COTIZADO|VENDIDO|FACTURADO|COBRADO|SOLICITUDES/.test(txt(i.querySelector('.tg'))) && i.querySelector('button[data-panel]')), qa('.rs-in .tg').map((e) => txt(e)).join(' | '));
  check('la primera lectura es la más urgente (ATENCIÓN) y las negritas se pintan como negritas, sin asteriscos visibles', /ATENCIÓN/.test(txt(qa('.rs-in')[0].querySelector('.tg'))) && qa('.rs-in b').length >= 3 && !/\*\*/.test(txt(q('#rsCuerpo'))), txt(qa('.rs-in')[0]));
  check('las lecturas citan nombres y cifras: lista de clientes bajo la lectura, con su monto', qa('.rs-in ul li').length >= 1 && qa('.rs-in').some((i) => /vencidos/.test(txt(i)) && /\$1,500/.test(txt(i))), qa('.rs-in').map((i) => txt(i).slice(0, 80)).join(' || '));
  check('lo que dicen las lecturas es lo que eligió el servidor (mismas lecturas y mismo orden que en la respuesta)', JSON.stringify(qa('.rs-in').map((i) => txt(i.querySelector('.tg')).split('·')[1].trim())) === JSON.stringify(w.__resumenDashboardEstado().ultimo.lecturas.map((l) => l.etapa)));
  check('el encabezado de columnas dice contra qué se compara', /VARIACIÓN vs SEP/.test(txt(q('.rs-cab'))), txt(q('.rs-cab')));
  check('la meta es una MUESCA que cruza la barra y su monto vive en el subtítulo (triángulo + meta), sin etiqueta aparte', qa('.rs-track .meta').length === 5 && !q('.rs-metal') && /prom\. 12 m \$10,167/.test(txt(q('.rs-fila[data-k="cot"] .rs-est'))) && /prom\. 12 m 1\.3/.test(txt(q('.rs-fila[data-k="sol"] .rs-est'))), txt(q('.rs-fila[data-k="cot"] .rs-est')));
  check('las barras miden todas lo mismo (misma pista) y los segmentos van pegados, sin separadores', qa('.rs-trk').length === 5 && qa('.rs-track .fill > *').every((c) => c.classList.contains('sg')));

  console.log('Siguientes lecturas');
  const est0 = w.__resumenDashboardEstado().ultimo, todas0 = est0.lecturas.length + est0.lecturasOtras.length, paginas0 = Math.ceil(todas0 / 3);
  check('hay más de 3 lecturas por prioridad y el encabezado dice cuáles se ven («1–3 DE n»)', todas0 > 3 && new RegExp('1–3 DE ' + todas0).test(txt(q('.rs-ins-t'))), txt(q('.rs-ins-t')));
  check('el botón «Siguientes 3» lleva ícono (chispas animadas), nombre accesible y texto', !!q('#rsMas svg path.c1') && qa('#rsMas svg path').length === 3 && /Siguientes 3/.test(txt(q('#rsMas'))) && !!q('#rsMas').getAttribute('aria-label'));
  const primera0 = txt(qa('.rs-in')[0]);
  q('#rsMas').click(); await pausa(60);
  check('al pulsar, el ícono entra en modo «pensando» un instante', q('#rsMas') && q('#rsMas').classList.contains('pensando'));
  await pausa(800);
  const hasta = Math.min(6, todas0);
  check('muestra las siguientes 3 por prioridad (distintas a las primeras) y el encabezado avanza', qa('.rs-in').length === Math.min(3, todas0 - 3) && txt(qa('.rs-in')[0]) !== primera0 && new RegExp('4–' + hasta + ' DE ' + todas0).test(txt(q('.rs-ins-t'))) && q('.rs-ins3').classList.contains('cambia'), txt(q('.rs-ins-t')));
  check('las siguientes lecturas traen el mismo formato (ícono + palabra + etapa y botón al Tracking)', qa('.rs-in').every((i) => i.querySelector('.tg svg') && /ATENCIÓN|REVISAR|DATO|VA BIEN/.test(txt(i.querySelector('.tg'))) && i.querySelector('button[data-panel]')));
  for (let k = 1; k < paginas0; k++) { q('#rsMas').click(); await pausa(800); }
  check('al terminar las páginas vuelve a las primeras 3 (más importantes)', new RegExp('1–3 DE ' + todas0).test(txt(q('.rs-ins-t'))) && txt(qa('.rs-in')[0]) === primera0, txt(q('.rs-ins-t')));
  q('#rsMas').click(); await pausa(800);
  q('#rsActualizar').click(); await pausa(400);
  check('al actualizar los datos las lecturas regresan a las 3 más importantes', new RegExp('1–3 DE').test(txt(q('.rs-ins-t'))) && txt(qa('.rs-in')[0]) === primera0, txt(q('.rs-ins-t')));
  volcar('dashboard-resumen');

  console.log('Metas propias (Configuración → Metas)');
  METAS = { sol: 10, cot: 20000, gan: 5000 };
  q('#rsActualizar').click(); await pausa(300);
  check('la meta propia reemplaza al promedio y lo dice («meta $20,000»); Facturado usa la meta de Ganado ($5,000); Cobrado sigue con su promedio', /meta \$20,000/.test(txt(q('.rs-fila[data-k="cot"] .rs-est'))) && /bajo su meta/.test(txt(q('.rs-fila[data-k="cot"] .rs-est'))) && /meta \$5,000/.test(txt(q('.rs-fila[data-k="gan"] .rs-est'))) && /meta \$5,000/.test(txt(q('.rs-fila[data-k="fac"] .rs-est'))) && /prom\. 12 m/.test(txt(q('.rs-fila[data-k="cob"] .rs-est'))), txt(q('.rs-fila[data-k="fac"] .rs-est')));
  check('la barra y su marca de meta guardan proporción: Solicitudes 3 de 10 (30 %) y Cotizado $10,500 de $20,000 (52 %)', Math.abs(ancho('.rs-fila[data-k="sol"] .rs-track .fill') / parseFloat(q('.rs-fila[data-k="sol"] .rs-track .meta').style.left) - 0.3) < 0.02 && Math.abs(ancho('.rs-fila[data-k="cot"] .rs-track .fill') / parseFloat(q('.rs-fila[data-k="cot"] .rs-track .meta').style.left) - 0.525) < 0.02, ancho('.rs-fila[data-k="sol"] .rs-track .fill') + '/' + q('.rs-fila[data-k="sol"] .rs-track .meta').style.left);
  check('la meta de Solicitudes es una cantidad («meta 10») y las reglas de lecturas usan la meta propia («tu meta de $20,000»)', /meta 10/.test(txt(q('.rs-fila[data-k="sol"] .rs-est'))) && [...w.__resumenDashboardEstado().ultimo.lecturas, ...w.__resumenDashboardEstado().ultimo.lecturasOtras].some((l) => l.id === 'proyeccion-cotizado' && l.texto.includes('tu meta de **$20,000')), txt(q('.rs-fila[data-k="sol"] .rs-est')));
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
  check('el botón ? abre la explicación del embudo, la leyenda, la línea y la variación', !q('#rsPop').hidden && /BARRAS/.test(txt(q('#rsPop'))) && /CÓMO SE CUENTA/.test(txt(q('#rsPop'))) && /GRÁFICA DE 12 MESES/.test(txt(q('#rsPop'))) && /VARIACIÓN/.test(txt(q('#rsPop'))) && q('#rsAyuda').getAttribute('aria-expanded') === 'true');
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
  cambia('#rsMes', 'todo'); await pausa(300);
  check('«Todo el historial» pide mes=todo, resalta el mes y muestra «acumulado» sin meta', resumenes().pop().includes('mes=todo') && q('#rsSwMes').classList.contains('act') && qa('.rs-d.acum').length === 5 && /sin meta aún/.test(txt(q('.rs-fila .rs-est'))));
  q('#rsLimpiar').click(); await pausa(300);
  const ultima = resumenes().pop();
  check('Limpiar filtros regresa todo a su valor inicial y pide sin filtros', !/estrategia|herramienta|mes=/.test(ultima) && !qa('.rs-sw.act').length && qa('.rs-nf').length === 0, ultima);
  check('el mes vuelve al mes en curso', /Octubre 2026/.test(q('#rsMes').selectedOptions[0].textContent));
  cambia('#rsMes', '2026-09'); await pausa(300);
  check('mes pasado: título de mes completo, sin «al día» en la línea y pide mes=2026-09', resumenes().pop().includes('mes=2026-09') && /mes completo/i.test(txt(q('.rs-emb-t small'))) && !/al día/.test(qa('.rs-fila[data-k="cot"] .hit').pop().dataset.tip), txt(q('.rs-emb-t small')));
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
