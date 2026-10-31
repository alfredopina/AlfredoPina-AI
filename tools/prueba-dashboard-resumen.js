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
const DATOS = {
  cuentas: [
    cuenta({ emision: '2026-08-20', creada: ms('2026-08-20'), vencimiento: '2026-09-19', pagos: [{ fecha: '2026-09-10', creada: ms('2026-09-10'), monto: 1160, anulado: false }], estatus: 'Pagada' }),
    cuenta({ subtotal: 3000, total: 3480, emision: '2026-09-10', creada: ms('2026-09-10'), vencimiento: '2026-10-10', herrs: ['powerbi'] }),
    cuenta({ subtotal: 400, total: 464, emision: '2026-10-01', creada: ms('2026-10-01'), vencimiento: '2026-11-30' }),
    cuenta({ subtotal: 500, total: 580, estatus: 'Por facturar', creada: ms('2026-10-15') }),
  ],
  cotizaciones: [
    cot({ id: 1, estatus: 'Ganada', precio: 10000, enviada: ms('2026-08-25'), cierre: ms('2026-09-12') }),
    cot({ id: 2, estatus: 'Perdida', precio: 4000, enviada: ms('2026-09-01'), cierre: ms('2026-09-20'), motivo: 'Precio alto' }),
    cot({ id: 3, estatus: 'Ganada', precio: 6000, herr: 'powerbi', enviada: ms('2026-09-25'), cierre: ms('2026-10-08') }),
    cot({ id: 4, precio: 8000, enviada: ms('2026-10-10') }),
    cot({ id: 5, estatus: 'Perdida', precio: 2500, enviada: ms('2026-10-05'), cierre: ms('2026-10-20'), motivo: 'Sin respuesta' }),
  ],
};

const llamadas = [];
let fallarResumen = null; // status de error a devolver
function respuesta(cuerpo, status = 200) { return Promise.resolve({ ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) }); }
function fetchFalso(url) {
  const u = String(url); llamadas.push(u);
  if (u.includes('/api/getDashboardResumenAdmin')) {
    if (fallarResumen) return respuesta({ error: 'Error de prueba' }, fallarResumen);
    const p = new URL(u, 'https://x.test').searchParams;
    const r = calcularDinero(DATOS, { mes: p.get('mes') || '', estrategia: p.get('estrategia') || '', tipoCliente: p.get('tipoCliente') || '', herramienta: p.get('herramienta') || '' }, { ahora: AHORA });
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
const vista = (id) => q('.rs-vista[data-vista="' + id + '"]').click();

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
  check('tres vistas, con sus nombres: la primera activa', qa('.rs-vista h2').map((h) => txt(h)).join('|') === 'Flujo de Venta y Cobranza|Por vender y por cobrar|Oportunidades no cerradas' && q('.rs-vista.on').dataset.vista === 'flujo');
  check('solo la vista activa muestra filas (una sola pantalla)', qa('.rs-vista.on').length === 1 && qa('.rs-fila').length === 4, String(qa('.rs-fila').length));
  check('Flujo: Cotizado → Ganado → Facturado → Cobrado', nombres() === 'Cotizado|Ganado|Facturado|Cobrado', nombres());
  check('Cotizado lleva la etiqueta de foco', /FOCO: AUMENTAR/.test(txt(q('.rs-fila[data-k="cot"] .nm'))));
  check('montos sin IVA: cotizado de octubre = $8,000 (abierta) + $2,500 (perdida) = $10,500', txt(q('.rs-fila[data-k="cot"] .vv')) === '$10,500', txt(q('.rs-fila[data-k="cot"] .vv')));
  check('cada fila: barra con marca de meta, línea de 12 meses y variación con ÍCONO + TEXTO', qa('.rs-fila').every((f) => f.querySelector('.rs-track .fill') && f.querySelector('.rs-sp2') && f.querySelector('.rs-d svg') && txt(f.querySelector('.rs-d')).length > 2));
  check('la meta se explica con texto e ícono («sobre su meta» o «bajo su meta»), no solo por color', qa('.rs-fila .rs-est').every((e) => /meta/.test(txt(e)) && e.querySelector('svg')));
  check('barra azul (on) si está en su meta y azul claro (off) si no; la clase coincide con el texto', qa('.rs-fila').every((f) => !f.querySelector('.rs-est.on, .rs-est.off') || (f.querySelector('.fill.on') ? !!f.querySelector('.rs-est.on') : !!f.querySelector('.rs-est.off'))));
  check('puntos de la línea con mes y monto para el tooltip', qa('.rs-fila[data-k="cot"] .hit').length >= 3 && qa('.rs-fila[data-k="cot"] .hit').every((h) => h.dataset.m && Number(h.dataset.v) >= 0) && /al día 28/.test(qa('.rs-fila[data-k="cot"] .hit').pop().dataset.m));
  check('la variación trae porcentaje y monto («vs sep»)', /vs sep/.test(txt(q('.rs-fila[data-k="cot"] .rs-dl'))) && /[+−]\$/.test(txt(q('.rs-fila[data-k="cot"] .rs-dl'))), txt(q('.rs-fila[data-k="cot"] .rs-vc')));
  check('tres lecturas, cada una con etiqueta (ícono + palabra) y un botón que lleva a donde se atiende', qa('.rs-in').length === 3 && qa('.rs-in').every((i) => i.querySelector('.tg svg') && /ATENCIÓN|REVISAR|DATO|VA BIEN/.test(txt(i.querySelector('.tg'))) && i.querySelector('button[data-panel]')));
  check('el encabezado de columnas dice contra qué se compara', /VARIACIÓN vs SEP/.test(txt(q('.rs-cab'))), txt(q('.rs-cab')));
  volcar('dashboard-resumen');

  console.log('Cambiar de vista (sin volver a pedir datos)');
  const n0 = resumenes().length;
  vista('abierto'); await pausa(50);
  check('Por vender y por cobrar: 5 filas con el desglose en plazo / vencido como hijas', nombres() === 'Por vender|Por facturar|Por cobrar|Facturado en plazo|Facturado vencido' && qa('.rs-fila.hijo').length === 2, nombres());
  check('cambiar de vista no pide nada al servidor', resumenes().length === n0);
  check('por cobrar = en plazo + vencido (mismos montos de la pantalla)', (() => { const n = (k) => Number(txt(q('.rs-fila[data-k="' + k + '"] .vv')).replace(/[^\d]/g, '')); return n('pxc') === n('plz') + n('ven'); })());
  check('Por cobrar de octubre sin IVA: $3,400 (3,000 vencidos + 400 en plazo)', txt(q('.rs-fila[data-k="pxc"] .vv')) === '$3,400', txt(q('.rs-fila[data-k="pxc"] .vv')));
  check('el vencido en aumento: píldora roja con la palabra «atención»', /atención/.test(txt(q('.rs-fila[data-k="ven"] .rs-d'))) && q('.rs-fila[data-k="ven"] .rs-d.urg'), txt(q('.rs-fila[data-k="ven"] .rs-d')));
  check('tres lecturas también aquí', qa('.rs-in').length === 3);
  vista('perdido'); await pausa(50);
  check('Oportunidades no cerradas: una sola fila y los motivos de pérdida', nombres() === 'Cerradas sin venta' && /Sin respuesta/.test(txt(q('.rs-motivos'))) && qa('.rs-mo').length === 1, nombres());
  check('tres lecturas también aquí', qa('.rs-in').length === 3);
  vista('flujo'); await pausa(50);

  console.log('Comparar con');
  q('#rsModo button[data-m="p3"]').click(); await pausa(50);
  check('promedio de 3 meses: cambia la etiqueta de la columna y de las píldoras, sin pedir datos', /VARIACIÓN vs PROM. 3 M/.test(txt(q('.rs-cab'))) && /vs prom. 3 m/.test(txt(q('.rs-fila[data-k="cot"] .rs-dl'))) && resumenes().length === n0, txt(q('.rs-fila[data-k="cot"] .rs-dl')));
  q('#rsModo button[data-m="anio"]').click(); await pausa(50);
  check('año pasado sin historia: «sin datos» con ícono (no un número inventado)', qa('.rs-fila .rs-d.na').length === 4 && /sin datos/.test(txt(q('.rs-fila[data-k="cot"] .rs-d'))) && q('.rs-fila[data-k="cot"] .rs-d svg'));
  check('las lecturas siguen funcionando sin referencia del año pasado', qa('.rs-in').length === 3);
  q('#rsModo button[data-m="mes"]').click(); await pausa(50);
  check('mes anterior: el botón queda resaltado', q('#rsModo button[data-m="mes"]').classList.contains('on') && qa('#rsModo button.on').length === 1);

  console.log('Ayuda');
  check('el panel de ayuda empieza cerrado', q('#rsPop').hidden);
  q('#rsAyuda').click();
  check('el botón ? abre la explicación de barras, línea y variación', !q('#rsPop').hidden && /BARRAS/.test(txt(q('#rsPop'))) && /GRÁFICA DE 12 MESES/.test(txt(q('#rsPop'))) && /VARIACIÓN/.test(txt(q('#rsPop'))) && q('#rsAyuda').getAttribute('aria-expanded') === 'true');
  d.body.click();
  check('un clic fuera la cierra', q('#rsPop').hidden);

  console.log('Filtros');
  cambia('#rsHerramienta', 'powerbi'); await pausa(300);
  check('pide con herramienta=powerbi', resumenes().pop().includes('herramienta=powerbi'), resumenes().pop());
  check('el filtro activo se resalta y la vista sigue donde estaba', q('#rsHerramienta').parentNode.classList.contains('act') && !q('#rsSwMes').classList.contains('act') && q('.rs-vista.on').dataset.vista === 'flujo');
  check('Power BI: cotizado de octubre en $0 y ganado de $6,000 (la cotización que lleva esa herramienta)', txt(q('.rs-fila[data-k="cot"] .vv')) === '$0' && txt(q('.rs-fila[data-k="gan"] .vv')) === '$6,000', txt(q('.rs-fila[data-k="cot"] .vv')) + ' ' + txt(q('.rs-fila[data-k="gan"] .vv')));
  check('avisa que las cuentas manuales sin herramienta no se incluyen', /cuentas manuales/.test(txt(q('.rs-nota'))), txt(q('.rs-nota')));
  cambia('#rsEstrategia', 'abiertos'); await pausa(300);
  check('Estrategia solo existe en Cobranza: Cotizado y Ganado quedan SIN FILTRAR con ícono y texto', qa('.rs-nf').length === 2 && qa('.rs-nf').every((t) => /SIN FILTRAR/.test(txt(t)) && t.querySelector('svg')), String(qa('.rs-nf').length));
  vista('abierto'); await pausa(50);
  check('en Por vender y por cobrar solo Por vender queda sin filtrar', qa('.rs-nf').length === 1 && !!q('.rs-fila[data-k="pip"] .rs-nf'));
  cambia('#rsMes', 'todo'); await pausa(300);
  check('«Todo el historial» pide mes=todo, resalta el mes y muestra «acumulado» sin meta', resumenes().pop().includes('mes=todo') && q('#rsSwMes').classList.contains('act') && qa('.rs-d.acum').length === 5 && /sin meta aún/.test(txt(q('.rs-fila .rs-est'))));
  q('#rsLimpiar').click(); await pausa(300);
  const ultima = resumenes().pop();
  check('Limpiar filtros regresa todo a su valor inicial y pide sin filtros', !/estrategia|herramienta|mes=/.test(ultima) && !qa('.rs-sw.act').length && qa('.rs-nf').length === 0, ultima);
  check('el mes vuelve al mes en curso', /Octubre 2026/.test(q('#rsMes').selectedOptions[0].textContent));
  vista('flujo'); await pausa(50);
  cambia('#rsMes', '2026-09'); await pausa(300);
  check('mes pasado: subtítulo de mes completo, sin «al día» en la línea, y pide mes=2026-09', resumenes().pop().includes('mes=2026-09') && /mes completo/i.test(txt(q('.rs-vista.on small'))) && !/al día/.test(qa('.rs-fila[data-k="cot"] .hit').pop().dataset.m), txt(q('.rs-vista.on small')));
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
  check('un error del servidor muestra aviso con texto y botón Reintentar (sin perder lo pintado)', !q('#rsAviso').hidden && /No se pudo cargar el resumen: Error de prueba/.test(txt(q('#rsAvisoTxt'))) && qa('.rs-fila').length === 4);
  fallarResumen = null;
  q('#rsReintentar').click(); await pausa(300);
  check('Reintentar lo vuelve a cargar y oculta el aviso', q('#rsAviso').hidden && /^Actualizar · hoy/.test(q('#rsActualizar').dataset.tt));

  check('sin errores de la página al final', errores.filter((e) => !/Not implemented|navigation|resource/i.test(e)).length === 0, errores.slice(0, 3).join(' | '));
  console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : '\nTodas las comprobaciones de Dashboard → Resumen pasaron.');
  process.exit(fallos ? 1 : 0);
})();
