// tools/prueba-dashboard-resumen.js — prueba funcional de Dashboard → Resumen: carga admin/index.html en jsdom con un servidor falso que responde
// con la salida REAL de api/src/dashboard-resumen.js (así se prueba también el contrato servidor ↔ pantalla). Datos ficticios; no toca nada real.
// jsdom NO es dependencia del proyecto (ver tools/prueba-barra-admin.js):
//   set JSDOM_DIR=%TEMP%jsdom-barra && node tools/prueba-dashboard-resumen.js
// Con VOLCAR_HTML=carpeta guarda el DOM (sin scripts) para tomarle captura y compararlo con docs/mockups/dashboard-resumen.html.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_DIR ? path.join(process.env.JSDOM_DIR, 'node_modules', 'jsdom') : 'jsdom');
const R = require('../api/src/dashboard-resumen');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');

const ms = (s) => Date.parse(s + 'T06:00:00Z');
const AHORA = new Date('2026-10-28T18:00:00Z');
const cuenta = (o) => ({ estrategia: 'empresas', tipo_factura: 'Empresa', estatus: 'Facturada', total: 1000, emision: null, creada: ms('2026-01-01'), vencimiento: null, tipo: 'Directo', herrs: ['excel'], pagos: [], ...o });
const DATOS = {
  cuentas: [
    cuenta({ total: 1000, emision: '2026-08-20', creada: ms('2026-08-20'), vencimiento: '2026-09-19', pagos: [{ fecha: '2026-09-10', creada: ms('2026-09-10'), monto: 1000, anulado: false }], estatus: 'Pagada' }),
    cuenta({ total: 3000, emision: '2026-09-10', creada: ms('2026-09-10'), vencimiento: '2026-10-10', herrs: ['powerbi'] }),
    cuenta({ total: 500, estatus: 'Por facturar', creada: ms('2026-10-15') }),
  ],
  cotizaciones: [
    { id: 1, estatus: 'Ganada', precio: 10000, alt: null, herr: 'excel', creada: ms('2026-08-25'), cierre: ms('2026-09-12'), cierreReal: ms('2026-09-12'), tipo: 'Directo' },
    { id: 4, estatus: 'Enviada', precio: 8000, alt: null, herr: 'excel', creada: ms('2026-10-10'), cierre: null, cierreReal: null, tipo: 'Directo' },
  ],
  solicitudes: [{ herr: 'excel', canal: 'Sitio', estatus: 'Nueva', prospecto: false, creada: ms('2026-10-20'), primera: null, tipo: 'Directo' }],
  grupos: [{ herrs: ['excel'], cerrado: false, activo: true, fin: null, cierre: null, existe: ms('2026-10-01'), tipo: 'Directo' }],
  clientes: [{ tipo: 'Directo', creada: ms('2026-08-02'), contactos: 2, completo: true, activo: true }],
};

const llamadas = [];
let fallarResumen = null; // status de error a devolver
function respuesta(cuerpo, status = 200) { return Promise.resolve({ ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) }); }
function fetchFalso(url) {
  const u = String(url); llamadas.push(u);
  if (u.includes('/api/getDashboardResumenAdmin')) {
    if (fallarResumen) return respuesta({ error: 'Error de prueba' }, fallarResumen);
    const p = new URL(u, 'https://x.test').searchParams;
    const r = R.calcular(DATOS, { mes: p.get('mes') || '', estrategia: p.get('estrategia') || '', tipoCliente: p.get('tipoCliente') || '', herramienta: p.get('herramienta') || '' }, { ahora: AHORA });
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

(async () => {
  await pausa(700);
  check('el script de la página corrió sin errores graves', errores.filter((e) => !/Not implemented|navigation|resource/i.test(e)).length === 0, errores.slice(0, 3).join(' | '));
  check('al abrir /admin NO se pide el Resumen (solo al entrar al Dashboard)', resumenes().length === 0);

  console.log('Estructura del panel');
  const pd = q('#panel-dashboard');
  check('el panel Dashboard es un hermano más de los demás paneles (no sacó contenido del diseño)', pd && pd.parentElement === q('#panel-config').parentElement && pd.parentElement.querySelectorAll(':scope > .admin-panel').length >= 15, pd && String(pd.parentElement.querySelectorAll(':scope > .admin-panel').length));
  check('solo dos pestañas: Resumen y Productos (sin Comercial/Operación/Cierre muertas)', qa('#dashTabs .dash-etab').map((b) => txt(b)).join('|') === 'Resumen|Productos');
  check('dos paneles de pestaña directos del Dashboard', qa('#panel-dashboard > .dash-tabpanel').map((p) => p.id).join('|') === 'dashTab-resumen|dashTab-productos');
  check('Resumen es la pestaña abierta por defecto', q('#dashTab-resumen').classList.contains('active') && !q('#dashTab-productos').classList.contains('active'));
  check('los filtros y las secciones viven dentro de Resumen', q('#dashTab-resumen #rsFiltros') && q('#dashTab-resumen #rsSecciones'));
  check('Productos conserva su contenido (KPIs, inventario y huecos)', q('#dashTab-productos #dashKpis') && q('#dashTab-productos #dashInv') && q('#dashTab-productos #dashHuecos'));

  console.log('Entrar al Dashboard desde la barra superior');
  q('#btnDashboard').click(); await pausa(400);
  check('pide el Resumen una sola vez', resumenes().length === 1, String(resumenes().length));
  check('5 secciones en orden de importancia', qa('.rs-sec h2').map((h) => txt(h)).join('|') === 'Cobranza|Cotizaciones|Solicitudes|Grupos|Clientes', qa('.rs-sec h2').map((h) => txt(h)).join('|'));
  check('25 tarjetas, 5 por sección', qa('.rs-k').length === 25 && qa('.rs-sec').every((s) => s.querySelectorAll('.rs-k').length === 5));
  check('nombres exactos de las tarjetas', qa('.rs-lb').map((e) => txt(e)).join('|') === [
    'Por cobrar', 'Vencido', 'Por facturar', 'Cobrado', 'Días promedio de cobro',
    'Pipeline activo', 'Ganado', 'Perdido', 'Tasa de conversión', 'Tiempo promedio de cierre',
    'Solicitudes manuales', 'Solicitudes del sitio', '% Solicitudes atendidas', 'Horas promedio de atención', 'Prospectos generados',
    'Grupos Activos', 'Grupos Cerrados', 'Total', 'Días promedio de cierre', 'Grupos de Clientes Directos',
    'Clientes', 'Completos', 'Contactos', 'Clientes Activos', 'Clientes Directos',
  ].join('|'));
  check('cada tarjeta tiene número grande, línea y píldora con ÍCONO + TEXTO (nunca solo color)', qa('.rs-k').every((k) => txt(k.querySelector('.rs-v')) && k.querySelector('.rs-spw') && k.querySelector('.rs-d svg') && txt(k.querySelector('.rs-d')).length > 3));
  check('"Ver detalle →" en cada sección, hacia su Tracking', qa('.rs-ver').map((b) => b.dataset.panel).join('|') === 'cobranza|tracking-comercial|solicitudes|tracking-operacion|clientes');
  check('Vencido en aumento: borde rojo + la palabra «atención»', q('.rs-sec[data-sec="cobranza"] .rs-k.urg') && /atención/.test(txt(q('.rs-sec[data-sec="cobranza"] .rs-k.urg .rs-d'))), txt(q('.rs-sec[data-sec="cobranza"] .rs-k:nth-child(2) .rs-d')));
  check('tarjetas de estado del momento: píldora punteada «estado de hoy» con reloj y línea plana', (() => { const k = qa('.rs-sec[data-sec="grupos"] .rs-k')[0]; return k.querySelector('.rs-d.hoy') && txt(k.querySelector('.rs-d')) === 'estado de hoy' && k.querySelector('.rs-spw.hoy line'); })());
  check('una tarjeta con historia dibuja su línea (polyline) y el punto del valor actual', (() => { const k = qa('.rs-sec[data-sec="cobranza"] .rs-k')[3]; return k.querySelector('polyline') && k.querySelector('.rs-dot'); })());
  check('el valor de dinero va con signo $ y el valor nulo con raya', /^\$/.test(txt(qa('.rs-sec[data-sec="cobranza"] .rs-v')[0])) && txt(qa('.rs-sec[data-sec="cotizaciones"] .rs-v')[3]) === '—', txt(qa('.rs-sec[data-sec="cotizaciones"] .rs-v')[3]));
  check('sin filtros ninguna tarjeta dice SIN FILTRAR', qa('.rs-nftag').length === 0 && qa('.rs-k.nf').length === 0);
  check('nota del corte: «hasta el día 28»', /mismo corte del mes anterior \(hasta el día 28\)/.test(txt(q('#rsNota'))), txt(q('#rsNota')));
  check('el botón dice la hora de la lectura', /^Actualizar · hoy \d\d:\d\d$/.test(txt(q('#rsActualizar'))), txt(q('#rsActualizar')));
  check('lista de meses: el primero «en curso» y al final «Todo el historial»', /Octubre 2026 · en curso/.test(txt(q('#rsMes option'))) && [...q('#rsMes').options].pop().value === 'todo');
  check('el selector de herramienta trae las 6', [...q('#rsHerramienta').options].map((o) => o.value).join('|') === '|excel|powerbi|powerapps|powerautomate|ia|ofimatica');
  volcar('dashboard-resumen');

  console.log('Filtros');
  cambia('#rsHerramienta', 'powerbi'); await pausa(300);
  check('pide con herramienta=powerbi', resumenes().pop().includes('herramienta=powerbi'), resumenes().pop());
  check('el filtro activo se resalta', q('#rsHerramienta').classList.contains('act') && !q('#rsMes').classList.contains('act'));
  check('Clientes: 5 tarjetas con borde punteado y etiqueta SIN FILTRAR, y el encabezado lo explica', qa('.rs-sec[data-sec="clientes"] .rs-k.nf').length === 5 && qa('.rs-sec[data-sec="clientes"] .rs-nftag').every((t) => /SIN FILTRAR/.test(txt(t))) && /Herramienta: no aplica a Clientes/.test(txt(q('.rs-sec[data-sec="clientes"] .rs-chip'))));
  check('las demás secciones sí se filtran (sin etiqueta)', qa('.rs-sec:not([data-sec="clientes"]) .rs-nftag').length === 0);
  check('la herramienta se conserva tras recargar el selector de meses', q('#rsHerramienta').value === 'powerbi');
  cambia('#rsEstrategia', 'abiertos'); await pausa(300);
  check('Estrategia sin soporte en 4 secciones: quedan SIN FILTRAR (20 tarjetas); Cobranza sí filtra', qa('.rs-k.nf').length === 20 && qa('.rs-sec[data-sec="cobranza"] .rs-nftag').length === 0, String(qa('.rs-k.nf').length));
  cambia('#rsMes', 'todo'); await pausa(300);
  check('«Todo el historial» pide mes=todo, resalta el mes y muestra «acumulado» (sin comparación)', resumenes().pop().includes('mes=todo') && q('#rsMes').classList.contains('act') && qa('.rs-d.acum').length > 0 && /Todo el historial/.test(txt(q('#rsNota'))));
  q('#rsLimpiar').click(); await pausa(300);
  const ultima = resumenes().pop();
  check('Limpiar filtros regresa todo a su valor inicial y pide sin filtros', !/estrategia|herramienta|mes=/.test(ultima) && !qa('.rs-sel.act').length && qa('.rs-nftag').length === 0, ultima);
  check('el mes vuelve al mes en curso', /Octubre 2026/.test(q('#rsMes').selectedOptions[0].textContent));
  cambia('#rsMes', '2026-09'); await pausa(300);
  check('mes pasado: nota de mes completo contra mes completo', /Mes completo contra el mes anterior completo/.test(txt(q('#rsNota'))) && resumenes().pop().includes('mes=2026-09'));
  q('#rsLimpiar').click(); await pausa(300);

  console.log('Navegación');
  const antes = resumenes().length;
  q('.rs-sec[data-sec="cobranza"] .rs-ver').click(); await pausa(200);
  check('«Ver detalle →» abre el Tracking de Cobranza', q('#panel-cobranza').classList.contains('active') && !q('#panel-dashboard').classList.contains('active'));
  q('#btnDashboard').click(); await pausa(400);
  check('volver al Dashboard desde la barra refresca el Resumen', resumenes().length === antes + 1, String(resumenes().length - antes));
  q('#dashTabs .dash-etab[data-dashtab="productos"]').click(); await pausa(300);
  check('pestaña Productos: se activa su panel y se apaga el de Resumen', q('#dashTab-productos').classList.contains('active') && !q('#dashTab-resumen').classList.contains('active'));
  check('cambiar de pestaña no apaga las pestañas de OTROS paneles (Diagnósticos, Encuestas…)', q('#diagTabs .dash-etab.active') && q('#encTabs .dash-etab.active') && q('#diagTab-qr') !== null ? true : !!q('#diagTabs .dash-etab.active'));
  const n2 = resumenes().length;
  q('#dashTabs .dash-etab[data-dashtab="resumen"]').click(); await pausa(300);
  check('volver a la pestaña Resumen lo refresca', resumenes().length === n2 + 1 && q('#dashTab-resumen').classList.contains('active'));

  console.log('Errores');
  fallarResumen = 400;
  q('#rsActualizar').click(); await pausa(300);
  check('un error del servidor muestra aviso con texto y botón Reintentar (sin perder lo pintado)', !q('#rsAviso').hidden && /No se pudo cargar el resumen: Error de prueba/.test(txt(q('#rsAvisoTxt'))) && qa('.rs-k').length === 25);
  fallarResumen = null;
  q('#rsReintentar').click(); await pausa(300);
  check('Reintentar lo vuelve a cargar y oculta el aviso', q('#rsAviso').hidden && /^Actualizar · hoy/.test(txt(q('#rsActualizar'))));

  check('sin errores de la página al final', errores.filter((e) => !/Not implemented|navigation|resource/i.test(e)).length === 0, errores.slice(0, 3).join(' | '));
  console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : '\nTodas las comprobaciones de Dashboard → Resumen pasaron.');
  process.exit(fallos ? 1 : 0);
})();
