// tools/prueba-cobranza.js — prueba funcional del panel COBRANZA del admin: carga admin/index.html en jsdom con un servidor falso
// (datos FICTICIOS, nada real). jsdom no es dependencia del proyecto (ver tools/prueba-barra-admin.js para instalarlo):
//   set JSDOM_DIR=%TEMP%\jsdom-cbz && node tools/prueba-cobranza.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_DIR ? path.join(process.env.JSDOM_DIR, 'node_modules', 'jsdom') : 'jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');

const hoyMas = (n) => { const d = new Date(); d.setUTCHours(12); d.setUTCDate(d.getUTCDate() + n); return d.toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' }); };
const sem = (clave, dias) => ({ clave, dias });
const pago = (id, monto, fecha, anulado) => ({ id, monto, fecha, metodo: 'Transferencia', folio_complemento: '17', uuid_complemento: 'aaaa-bbbb', anulado: !!anulado });
const cuenta = (o) => ({ id: 1, cliente_id: 3, cliente: 'Acme SA', cliente_codigo: 'ACME', cotizacion_id: 7, cotizacion_folio: 'AP26-ACME-EXCEL-01', origen: 'Automática', estrategia: 'empresas',
  concepto: 'Curso de Excel', subtotal: 10000, iva: 1600, retencion_isr: 0, retencion_iva: 0, total: 11600, folio_factura: null, uuid_factura: null, fecha_emision: null, orden_compra: null, inicio_plazo: null,
  plazo_dias: 30, fecha_creacion: '2026-09-16T05:33:00.000Z', vencimiento: null, estatus: 'Por facturar', notas: null, pagos: [], pagado: 0, saldo: 11600, semaforo: sem('sin_plazo', null), ...o });
let cuentas = [
  cuenta({ id: 1, cliente: 'Zeta SA', razon_social: 'Zeta Servicios SA de CV', rfc_receptor: 'ZSE010101AB1', notas: null, estatus: 'Facturada', folio_factura: '201', fecha_emision: '2026-09-01', inicio_plazo: '2026-09-01', vencimiento: '2026-10-01', semaforo: sem('vencida', 21) }),
  cuenta({ id: 2, cliente: 'Beta SA', estatus: 'Facturada', folio_factura: '202', fecha_emision: '2026-10-10', inicio_plazo: '2026-10-10', vencimiento: hoyMas(3), semaforo: sem('por_vencer', 3) }),
  cuenta({ id: 3, cliente: 'Alfa SA', estatus: 'Parcial', folio_factura: '203', fecha_emision: '2026-10-12', inicio_plazo: '2026-10-12', vencimiento: hoyMas(35), pagado: 4000, saldo: 7600, pagos: [pago(1, 4000, '2026-10-15')], semaforo: sem('al_corriente', 39) }),
  cuenta({ id: 4, cliente: 'Gamma SA', estatus: 'Por facturar', semaforo: sem('sin_plazo', null) }),
  cuenta({ id: 5, cliente: 'Delta SA', estatus: 'Pagada', folio_factura: '190', fecha_emision: '2026-08-01', saldo: 0, pagado: 11600, pagos: [pago(2, 11600, '2026-08-20')], semaforo: sem('cerrada', null) }),
  cuenta({ id: 6, cliente: 'Epsilon SA', estatus: 'Cancelada', semaforo: sem('cerrada', null) }),
  cuenta({ id: 7, cliente: 'Taller Ejemplo SA', cliente_id: null, razon_social: 'Taller Ejemplo SA', tipo_factura: 'Otro', estrategia: null, estatus: 'Facturada', folio_factura: '300', fecha_emision: '2026-09-02', inicio_plazo: '2026-09-02', vencimiento: '2026-10-02', semaforo: sem('vencida', 20) }),
];
const resumen = { por_cobrar: 30000.5, por_cobrar_n: 3, vencido: 11600, vencido_n: 1, por_vencer: 11600, por_vencer_n: 1, por_facturar: 11600, por_facturar_n: 1, cobrado: 15600, cobrado_n: 2, dias_promedio: 19, contando_desde: null, contando_hasta: null };
const alertas = { total: 2, umbrales: { cobranzaPorVencerDias: 7 }, grupos: { solicitudes: [], cotizaciones: [], grupos: [], clientes: [], cobranza: [
  { tipo: 'cobranza', id: 1, cliente: 'Zeta SA', detalle: 'Cobro vencido, factura 201', dias: 21, pastilla: 'vencido 21 d' },
  { tipo: 'cobranza', id: 2, cliente: 'Beta SA', detalle: 'Cobro por vencer, factura 202', dias: 3, pastilla: 'vence en 3 d' } ] } };

let datosLista = cuentas;
const llamadas = []; // { url, cuerpo }
function respuesta(cuerpo, status = 200) { return Promise.resolve({ ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) }); }
const ajustesCorreo = { general: true, nuevaSolicitud: true, propuestaAbierta: true, propuestaAceptada: true, solicitudAtorada: true, resumenSemanal: true, nuevaCuentaCobranza: true,
  destinoNuevaSolicitud: '', destinoPropuestaAbierta: '', destinoPropuestaAceptada: '', destinoSolicitudAtorada: '', destinoResumen: 'viri@ejemplo.test', destinoNuevaCuentaCobranza: '' };
function fetchFalso(url, opts) {
  const u = String(url); const cuerpo = opts && opts.body ? JSON.parse(opts.body) : null; llamadas.push({ u, cuerpo });
  if (u.includes('/api/getConfiguracionCorreo')) return respuesta(ajustesCorreo);
  if (u.includes('/api/actualizarConfiguracionCorreo')) { Object.assign(ajustesCorreo, cuerpo); return respuesta(ajustesCorreo); }
  if (u.includes('/api/listCobranzaAdmin')) return respuesta(datosLista);
  if (u.includes('/api/getResumenCobranzaAdmin')) return respuesta(resumen);
  if (u.includes('/api/getNotificacionesActivas')) return respuesta(alertas);
  if (u.includes('/api/buscarClientesAdmin')) return respuesta([{ id: 3, nombre: 'Acme SA', codigo: 'ACME', tipo_cliente: 'Directo' }, { id: 4, nombre: 'Beta SA', codigo: 'BETA', tipo_cliente: 'Intermediario' }, { id: 9, nombre: 'Taller Ejemplo SA', codigo: 'TAL', tipo_cliente: 'Tercero' }]);
  if (u.includes('/api/registrarPagoCobranza') && cuerpo.monto > 7600) return respuesta({ error: 'El pago excede el saldo (queda por cobrar 7600.00).' }, 409);
  if (u.includes('/api/eliminarCuentaCobrar') && cuerpo.id === 3) return respuesta({ error: 'Esa cuenta ya tiene pagos registrados: no se borra, se cancela (anula los pagos primero).' }, 409);
  if (/\/api\/(actualizarNotasCuentaCobrar|eliminarCuentaCobrar|registrarPagoCobranza|anularPagoCobranza|editarCuentaCobrar|cambiarEstatusCuentaCobrar|dividirCuentaCobrar|crearCuentaCobrar)/.test(u)) return respuesta({ ok: true });
  if (u.includes('/.auth/me')) return respuesta({ clientPrincipal: { userDetails: 'alfredo.pina@lifezen.com.mx', userRoles: ['admin'] } });
  if (u.includes('/api/getMetricasDesde')) return respuesta({ solicitudes: {}, cotizaciones: {}, grupos: {}, cobranza: {} });
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
const qa = (s) => [...d.querySelectorAll(s)];
const txt = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
const clic = async (el) => { el.click(); await pausa(80); };
const valorDe = (id) => d.getElementById(id).value;
const poner = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };

(async () => {
  await pausa(600);
  check('el script de la página corrió sin errores graves', errores.filter((e) => !/Not implemented|navigation|resource/i.test(e)).length === 0, errores.slice(0, 3).join(' | '));

  console.log('Sidebar y entrada');
  const nav = q('.admin-nav-item[data-panel="cobranza"]');
  check('Cobranza está en el grupo TRACKING, después de Grupos', !!nav && nav.previousElementSibling.dataset.panel === 'tracking-operacion');
  await clic(nav);
  check('abre su panel y el título de la barra dice Cobranza', q('#panel-cobranza').classList.contains('active') && txt('#topbarTitle') === 'Cobranza');
  check('al navegar desde el sidebar refresca (pide lista y resumen)', llamadas.some((l) => l.u.includes('listCobranzaAdmin')) && llamadas.some((l) => l.u.includes('getResumenCobranzaAdmin')));

  console.log('Tarjetas');
  check('Por cobrar con su monto y conteo', /30,000\.50/.test(txt('#cbzKpiPorCobrar')) && /3/.test(txt('#cbzKpiPorCobrarN')), txt('#cbzKpiPorCobrar'));
  check('Vencido, Por facturar, Cobrado y Días promedio', /11,600/.test(txt('#cbzKpiVencido')) && /11,600/.test(txt('#cbzKpiPorFacturar')) && /15,600/.test(txt('#cbzKpiCobrado')) && txt('#cbzKpiDias') === '19');
  check('banner de vencidas con ícono y texto', !q('#cbzAlerta').hidden && /1 cuenta vencida/.test(txt('#cbzAlertaTexto')), txt('#cbzAlertaTexto'));

  console.log('Tabla: vistas, columnas, semáforo y filtros');
  const encabezados = qa('.cbz-tabla thead th').map((th) => th.textContent.replace(/[▲▼]/g, '').trim());
  check('columnas (caben en una pantalla): Creada, Cliente, Factura, Concepto, Total, Vencimiento, Semáforo, Acciones', encabezados.join('|') === 'Creada|Cliente|Factura|Concepto|Total|Vencimiento|Semáforo|Acciones', encabezados.join('|'));
  check('vistas en el orden pedido y Todo al final', qa('#cbzVistas .radm-tab').map((b) => b.dataset.vista).join(',') === 'facturar,vencidas,cobrar,pagadas,canceladas,terceros,todo');
  check('arranca en Por facturar', q('#cbzVistas .radm-tab.active').dataset.vista === 'facturar' && qa('#cbzListaBody tr[data-id]').length === 1);
  const cuentasDe = ['facturar', 'vencidas', 'cobrar', 'pagadas', 'canceladas', 'terceros', 'todo'].map((k) => txt('#cbzN-' + k)).join(',');
  check('contadores de las vistas', cuentasDe === '1,1,3,1,1,1,7', cuentasDe);
  const sinPlazo = q('#cbzListaBody .cbz-sem');
  check('Por facturar: neutro con ícono y texto, y cuántos días lleva creada', sinPlazo.classList.contains('sin_plazo') && !!sinPlazo.querySelector('svg') && /Por facturar/.test(sinPlazo.textContent) && /Creada \d+ d/.test(sinPlazo.textContent), sinPlazo.textContent);
  await clic(q('#cbzVistas [data-vista="vencidas"]'));
  const rojo = q('#cbzListaBody .cbz-sem');
  check('Vencidas: ROJO con ícono + texto y días emitida', rojo.classList.contains('vencida') && !!rojo.querySelector('svg') && /Vencida 21 d/.test(rojo.textContent) && /Emitida \d+ d/.test(rojo.textContent), rojo.textContent);
  const cli = q('#cbzListaBody tr[data-id="1"] .cbz-cli');
  check('Cliente: nombre fiscal arriba y debajo el comercial + RFC', /Zeta Servicios SA de CV/.test(cli.querySelector('b').textContent) && /Zeta SA · ZSE010101AB1/.test(cli.querySelector('.cbz-sub').textContent), cli.textContent);
  await clic(q('#cbzVistas [data-vista="cobrar"]'));
  let filas = qa('#cbzListaBody tr[data-id]');
  check('Por cobrar: Facturada y Parcial (3), la vencida primero', filas.length === 3 && filas[0].dataset.id === '1', filas.map((f) => f.dataset.id).join(','));
  const ambar = filas[1].querySelector('.cbz-sem'), neutro = filas[2].querySelector('.cbz-sem');
  check('ÁMBAR con ícono + texto: por vencer (3 d)', ambar.classList.contains('por_vencer') && !!ambar.querySelector('svg') && /Vence en 3 d/.test(ambar.textContent), ambar.textContent);
  check('con más de 7 días: neutro "En plazo" (no verde: verde es solo pagada)', neutro.classList.contains('en_plazo') && /En plazo/.test(neutro.textContent) && !neutro.classList.contains('pagada'), neutro.textContent);
  check('Parcial muestra el saldo debajo del total', /Saldo \$7,600\.00/.test(txt('#cbzListaBody tr[data-id="3"] .cbz-num')), txt('#cbzListaBody tr[data-id="3"] .cbz-num'));
  check('totales al pie de la vista', /3 cuentas/.test(txt('#cbzPie')) && /34,800\.00/.test(txt('#cbzPie')) && /30,800\.00/.test(txt('#cbzPie')), txt('#cbzPie'));
  await clic(q('#cbzVistas [data-vista="pagadas"]'));
  const verde = q('#cbzListaBody .cbz-sem');
  check('Pagadas: VERDE con ícono + texto', verde.classList.contains('pagada') && !!verde.querySelector('svg') && /Pagada/.test(verde.textContent));
  check('Pagadas: la columna cambia a Fecha de pago, con en cuántos días se cobró', /Fecha de pago/.test(txt('#cbzThVence')) && /20\/08\/2026/.test(txt('#cbzListaBody tr[data-id="5"]')) && /cobrada en 19 d/.test(txt('#cbzListaBody tr[data-id="5"]')), txt('#cbzListaBody tr[data-id="5"]'));
  await clic(q('#cbzVistas [data-vista="terceros"]'));
  const celdaFactura = (id) => txt('#cbzListaBody tr[data-id="' + id + '"] td:nth-child(3)');
  check('la factura de terceros muestra su tipo y NO una estrategia', /Otro/.test(celdaFactura(7)) && !/company|Abiertos/.test(celdaFactura(7)), celdaFactura(7));
  await clic(q('#cbzVistas [data-vista="todo"]'));
  check('una factura normal muestra folio y tipo en la misma celda (la estrategia solo se escribe si es Abiertos)', /Sin tipo/.test(celdaFactura(2)) && !/company/.test(celdaFactura(2)) && /202/.test(celdaFactura(2)), celdaFactura(2));
  await clic(q('#cbzVistas [data-vista="terceros"]'));
  check('Terceros lista solo la de terceros, con su tipo', qa('#cbzListaBody tr[data-id]').length === 1 && /Otro/.test(txt('#cbzListaBody tr[data-id="7"]')));
  await clic(q('#cbzVistas [data-vista="todo"]'));
  check('Todo lista las 7', qa('#cbzListaBody tr[data-id]').length === 7);
  await clic(q('.cbz-tabla th[data-sort="cliente"]'));
  check('ordenar por Cliente (clic en el encabezado)', qa('#cbzListaBody tr[data-id]')[0].dataset.id === '3', qa('#cbzListaBody tr[data-id]').map((f) => f.dataset.id).join(','));
  poner('cbzFCliente', 'ZSE010'); check('el filtro Cliente busca por RFC', qa('#cbzListaBody tr[data-id]').length === 1);
  poner('cbzFCliente', 'servicios sa de cv'); check('el filtro Cliente busca por nombre fiscal', qa('#cbzListaBody tr[data-id]').length === 1);
  poner('cbzFCliente', 'beta'); check('el filtro Cliente busca por nombre comercial', qa('#cbzListaBody tr[data-id]').length === 1);
  poner('cbzFCliente', ''); poner('cbzFFolio', '202'); check('el filtro Folio busca por folio de factura', qa('#cbzListaBody tr[data-id]').length === 1 && qa('#cbzListaBody tr[data-id]')[0].dataset.id === '2');
  d.getElementById('cbzFEstrategia').value = 'abiertos'; d.getElementById('cbzFEstrategia').dispatchEvent(new w.Event('change', { bubbles: true }));
  check('el filtro Estrategia se combina con los demás (ninguna abierta con ese folio)', qa('#cbzListaBody tr[data-id]').length === 0);
  await clic(q('#cbzLimpiar'));
  check('limpiar filtros regresa a la lista completa', qa('#cbzListaBody tr[data-id]').length === 7 && qa('#cbzListaBody tr[data-id]')[0].dataset.id === '1');
  check('la primera columna es Creada: solo la fecha a la vista y la hora al pasar el mouse', txt('#cbzListaBody tr td:first-child') === '15/09/2026' && /11:33/.test(q('#cbzListaBody tr td:first-child span').title), txt('#cbzListaBody tr td:first-child') + ' | ' + q('#cbzListaBody tr td:first-child span').title);

  console.log('Vista simple para Viri');
  check('Por cobrar dice cuánto de lo que incluye ya está vencido', /incluye \$11,600\.00 vencido/.test(txt('#cbzKpiPorCobrarSub')), txt('#cbzKpiPorCobrarSub'));
  check('las pestañas de trabajo llevan su número resaltado: Vencidas en rojo, Por facturar en ámbar', q('#cbzN-vencidas').classList.contains('cbz-urgente') && q('#cbzN-facturar').classList.contains('cbz-atencion') && !q('#cbzN-pagadas').classList.contains('cbz-urgente'));
  await clic(q('#cbzVistas [data-vista="cobrar"]'));
  await clic(q('#cbzAlerta'));
  check('el banner rojo es clicable y lleva a la pestaña Vencidas', q('#cbzVistas .radm-tab.active').dataset.vista === 'vencidas' && qa('#cbzListaBody tr[data-id]').length === 1);
  const cobrarBtn = q('#cbzListaBody tr[data-id="1"] .cbz-acc-pago');
  check('la acción principal de una factura dice "Cobrar" (con palabras)', !!cobrarBtn && /Cobrar/.test(cobrarBtn.textContent));
  await clic(q('#cbzVistas [data-vista="facturar"]'));
  const factBtn = q('#cbzListaBody tr[data-id="4"] .cbz-acc-facturar');
  check('una cuenta Por facturar trae el botón "Facturar" y no "Cobrar"', !!factBtn && /Facturar/.test(factBtn.textContent) && !q('#cbzListaBody tr[data-id="4"] .cbz-acc-pago'));
  await clic(factBtn); await pausa(120);
  check('"Facturar" abre el detalle con el foco en el folio de la factura', !q('#cbzDetalle').hidden && d.activeElement && d.activeElement.id === 'cbzDFolio');
  await clic(q('#cbzDetCerrar'));
  await clic(q('#cbzVistas [data-vista="todo"]'));

  console.log('Línea de cobros');
  await clic(q('#cbzVistas [data-vista="todo"]'));
  check('la línea de cobros está entre el banner y las vistas', q('#cbzAlerta').nextElementSibling === q('#cbzLinea') && q('#cbzLinea').nextElementSibling.classList.contains('sol-toolbar'));
  check('zona Vencido (las 2 vencidas, una de tercero) y zona Sin fecha (1 por facturar)', /Vencido · 2/.test(txt('.cbz-zona.venc')) && /Sin fecha · 1/.test(txt('.cbz-zona.sin')), txt('.cbz-zona.venc') + ' | ' + txt('.cbz-zona.sin'));
  const clases = (k) => qa('#cbzLienzo .cbz-stem.' + k).length;
  check('cada tipo tiene su línea: vencida, pronto, por llegar, por facturar y tercero', clases('v') === 1 && clases('p') === 1 && clases('l') === 1 && clases('sf') === 1 && clases('ter') === 1, ['v', 'p', 'l', 'sf', 'ter'].map((k) => k + clases(k)).join(' '));
  check('cada línea trae su símbolo (no solo color) y un aviso con cliente y monto', qa('#cbzLienzo .cbz-stem').every((b) => !!b.querySelector('svg') && /\$/.test(b.getAttribute('aria-label'))), qa('#cbzLienzo .cbz-stem').length + ' líneas');
  check('el tercero va punteado y gris (clase ter) y lo dice en su aviso', /tercero/.test(q('#cbzLienzo .cbz-stem.ter').getAttribute('aria-label')));
  check('la leyenda explica los 5 símbolos', qa('.cbz-linea-leyenda .cbz-leg').length === 5);
  await clic(q('#cbzVistas [data-vista="pagadas"]'));
  check('la línea NO depende de las vistas: sigue igual al cambiar de pestaña', qa('#cbzLienzo .cbz-stem').length === 5);
  await clic(q('#cbzVistas [data-vista="todo"]'));
  await clic(q('#cbzLienzo .cbz-stem.p')); await pausa(80);
  check('clic en una línea abre la cuenta (Beta SA)', !q('#cbzDetalle').hidden && txt('#cbzDetTitulo') === 'Beta SA', txt('#cbzDetTitulo'));
  await clic(q('#cbzDetCerrar'));
  await clic(q('#cbzLineaNav [data-meses="1"]'));
  check('con "1 mes" lo que vence más allá queda fuera de la ventana y se avisa en el pie', clases('l') === 0 && /Después de esta ventana: 1 cobro/.test(txt('#cbzLineaPie')), txt('#cbzLineaPie'));
  await clic(q('#cbzLineaNav [data-meses="6"]'));
  check('con "6 meses" vuelve a aparecer y el pie queda vacío', clases('l') === 1 && txt('#cbzLineaPie') === '');
  await clic(q('#cbzLineaNav [data-meses="3"]'));
  check('la flecha izquierda está apagada al inicio; la derecha mueve un mes y avisa lo que quedó atrás', q('#cbzLineaAtras').disabled === true);
  await clic(q('#cbzLineaAdelante'));
  check('después de avanzar un mes: se activa la izquierda y lo de esta semana queda "antes de esta ventana"', q('#cbzLineaAtras').disabled === false && /Antes de esta ventana: 1 cobro/.test(txt('#cbzLineaPie')) && !q('.cbz-hoy'), txt('#cbzLineaPie'));
  await clic(q('#cbzLineaAtras'));
  check('regresar deja la marca de HOY', !!q('.cbz-hoy') && /HOY/.test(txt('#cbzLienzo .hoy-et')));
  await clic(q('#cbzLineaOcultar'));
  check('Ocultar esconde la línea y lo recuerda', q('#cbzLineaCuerpo').hidden === true && /"oculta":true/.test(w.localStorage.getItem('admin-cbz-linea') || ''), w.localStorage.getItem('admin-cbz-linea'));
  await clic(q('#cbzLineaOcultar'));
  check('Mostrar la vuelve a pintar', q('#cbzLineaCuerpo').hidden === false && qa('#cbzLienzo .cbz-stem').length === 5);
  // varias facturas el mismo día se juntan en UNA línea con su lista
  const base = (id, cliente, extra) => Object.assign({}, cuentas[1], { id, cliente, concepto: 'Curso ' + id, estatus: 'Facturada', tipo_factura: 'Empresa', total: 5000, saldo: 5000, subtotal: 5000, vencimiento: hoyMas(20), semaforo: sem('al_corriente', 20), pagos: [] }, extra || {});
  datosLista = [base(31, 'Alfa SA'), base(32, 'Beta SA', { total: 7000, saldo: 7000 }), base(33, 'Gamma SA', { vencimiento: hoyMas(40) })];
  await clic(q('#cbzActualizar')); await pausa(150);
  check('dos facturas del mismo día = una línea ("2 facturas") y la otra aparte', qa('#cbzLienzo .cbz-stem').length === 2 && /2 facturas/.test(txt('#cbzLienzo')), qa('#cbzLienzo .cbz-stem').length + ' | ' + txt('#cbzLienzo'));
  const juntas = qa('#cbzLienzo .cbz-stem').find((b) => /2 facturas/.test(b.getAttribute('aria-label')));
  await clic(juntas);
  check('al tocar la línea agrupada sale la lista con cada factura y su monto', !q('#cbzLineaPop').hidden && qa('#cbzLineaPop button[data-id]').length === 2 && /12,000/.test(txt('#cbzLineaPop .t')), txt('#cbzLineaPop'));
  await clic(q('#cbzLineaPop button[data-id="32"]')); await pausa(80);
  check('y de la lista se abre la factura elegida', !q('#cbzDetalle').hidden && txt('#cbzDetTitulo') === 'Beta SA');
  await clic(q('#cbzDetCerrar'));
  datosLista = [];
  await clic(q('#cbzActualizar')); await pausa(150);
  check('sin nada pendiente, la línea lo dice con palabras', /Nada pendiente/.test(txt('#cbzLienzo')) && qa('#cbzLienzo .cbz-stem').length === 0);
  datosLista = cuentas;
  await clic(q('#cbzActualizar')); await pausa(150);
  await clic(q('#cbzVistas [data-vista="todo"]'));

  console.log('Info, acciones, notas, eliminar y exportar');
  await clic(q('#cbzInfoSemBtn'));
  check('Info Semáforo abre su popover con los 5 estados (cada uno con ícono y texto)', !q('#cbzInfoSemPopover').hidden && qa('#cbzInfoSemPopover .cbz-sem').length === 5 && qa('#cbzInfoSemPopover .cbz-sem svg').length === 5);
  await clic(q('#cbzInfoSemBtn'));
  const acc = q('#cbzListaBody tr[data-id="1"] .sol-acciones');
  check('Acciones: registrar pago, notas, editar y eliminar', ['cbz-acc-pago', 'cbz-acc-notas', 'cbz-acc-editar', 'cbz-acc-eliminar'].every((k) => !!acc.querySelector('.' + k)));
  check('una cuenta Por facturar no ofrece registrar pago', !q('#cbzListaBody tr[data-id="4"] .cbz-acc-pago'));
  const expo = q('#cbzExportarBtn');
  check('el botón Exportar reporte está junto a Nueva cuenta', !!expo && expo.parentElement === q('#cbzCrearBtn').parentElement && expo.nextElementSibling === q('#cbzCrearBtn'));
  await clic(expo);
  check('Exportar reporte avisa que está pendiente', /pendiente/.test(txt('#cbzToast')), txt('#cbzToast'));
  llamadas.length = 0;
  await clic(q('#cbzListaBody tr[data-id="1"] .cbz-acc-notas'));
  check('Notas abre su popover', !q('#cbzNotasPopover').hidden);
  poner('cbzNotasTextarea', 'Llamar el lunes a contabilidad');
  await clic(q('#cbzNotasGuardar'));
  const nota = llamadas.find((l) => l.u.includes('actualizarNotasCuentaCobrar'));
  check('guardar la nota manda el id y el texto y marca el botón', nota && nota.cuerpo.id === 1 && nota.cuerpo.notas === 'Llamar el lunes a contabilidad' && q('#cbzListaBody tr[data-id="1"] .cbz-acc-notas').classList.contains('tiene-nota') && q('#cbzNotasPopover').hidden, JSON.stringify(nota && nota.cuerpo));
  await clic(q('#cbzListaBody tr[data-id="1"] .cbz-acc-pago'));
  await pausa(120);
  check('Registrar pago abre el detalle con el foco en el monto', !q('#cbzDetalle').hidden && d.activeElement && d.activeElement.id === 'cbzPMonto');
  await clic(q('#cbzDetCerrar'));
  llamadas.length = 0;
  await clic(q('#cbzListaBody tr[data-id="4"] .cbz-acc-eliminar'));
  check('Eliminar pide confirmación fuerte (destructiva)', !!q('.admin-dialog-overlay:not([hidden]) .admin-dialog-destructivo'));
  q('.admin-dialog-overlay:not([hidden]) .admin-dialog-confirmar').click(); await pausa(120);
  check('al confirmar manda eliminarCuentaCobrar', llamadas.some((l) => l.u.includes('eliminarCuentaCobrar') && l.cuerpo.id === 4));
  llamadas.length = 0;
  await clic(q('#cbzListaBody tr[data-id="3"] .cbz-acc-eliminar'));
  q('.admin-dialog-overlay:not([hidden]) .admin-dialog-confirmar').click(); await pausa(120);
  check('si la cuenta tiene pagos, el servidor lo rechaza y el aviso manda a cancelar', /se cancela/.test(txt('#cbzToast')), txt('#cbzToast'));

  console.log('Detalle y pagos');
  await clic(q('#cbzVistas [data-vista="cobrar"]'));
  await clic(q('#cbzListaBody tr[data-id="3"]'));
  check('abre el detalle de la cuenta con sus montos', !q('#cbzDetalle').hidden && txt('#cbzDetTitulo') === 'Alfa SA' && /7,600/.test(txt('#cbzDetCuerpo')));
  check('con pagos ya no se edita el monto', !q('#cbzDSubtotal'));
  poner('cbzPMonto', '9000');
  await clic(q('[data-det="pago"]'));
  check('un pago que excede el saldo muestra el error del servidor y no se cierra', /excede el saldo/.test(txt('#cbzPError')) && !q('#cbzPError').hidden);
  poner('cbzPMonto', '7600');
  llamadas.length = 0;
  await clic(q('[data-det="pago"]'));
  const regPago = llamadas.find((l) => l.u.includes('registrarPagoCobranza'));
  check('registrar pago manda la cuenta, el monto y la fecha', regPago && regPago.cuerpo.cuenta_id === 3 && regPago.cuerpo.monto === 7600 && /^\d{4}-\d{2}-\d{2}$/.test(regPago.cuerpo.fecha), JSON.stringify(regPago && regPago.cuerpo));
  check('después de guardar refresca lista y resumen', llamadas.some((l) => l.u.includes('listCobranzaAdmin')) && llamadas.some((l) => l.u.includes('getResumenCobranzaAdmin')));

  console.log('Anular, cancelar y dividir');
  // el servidor falso devuelve la cuenta 3 igual (con un pago vigente) → se puede anular
  llamadas.length = 0;
  const anular = q('[data-anular]');
  check('hay botón Anular en el pago vigente', !!anular);
  anular.click(); await pausa(80);
  check('anular pide confirmación (confirmarAccion, no confirm())', !q('.admin-dialog-overlay:not([hidden]) .admin-dialog-confirmar') === false);
  q('.admin-dialog-overlay:not([hidden]) .admin-dialog-confirmar').click(); await pausa(120);
  check('al confirmar manda anularPagoCobranza', llamadas.some((l) => l.u.includes('anularPagoCobranza') && l.cuerpo.id === 1));
  await clic(q('#cbzDetCerrar'));
  check('cerrar el detalle', q('#cbzDetalle').hidden);
  await clic(q('#cbzVistas [data-vista="facturar"]'));
  await clic(q('#cbzListaBody tr[data-id="4"]'));
  check('cuenta sin pagos: monto editable y botón de dividir', !!q('#cbzDSubtotal') && !!q('[data-det="dividir"]'));
  check('el detalle trae las retenciones de ISR e IVA', !!q('#cbzDRetIsr') && !!q('#cbzDRetIva'));
  d.getElementById('cbzDTipo').value = 'Gobierno'; d.getElementById('cbzDTipo').dispatchEvent(new w.Event('change', { bubbles: true }));
  poner('cbzDSubtotal', '9600'); d.getElementById('cbzDSubtotal').dispatchEvent(new w.Event('change', { bubbles: true }));
  check('al elegir el tipo Gobierno y capturar el subtotal, las retenciones se calculan solas (ISR 960, IVA 0)', valorDe('cbzDRetIsr') === '960' && valorDe('cbzDRetIva') === '0' && valorDe('cbzDIva') === '1536', [valorDe('cbzDRetIsr'), valorDe('cbzDRetIva'), valorDe('cbzDIva')].join(','));
  d.getElementById('cbzDTipo').value = 'Empresa'; d.getElementById('cbzDTipo').dispatchEvent(new w.Event('change', { bubbles: true }));
  check('con Empresa: ISR 960 e IVA retenido 1,024 (2/3 del IVA)', valorDe('cbzDRetIsr') === '960' && valorDe('cbzDRetIva') === '1024', [valorDe('cbzDRetIsr'), valorDe('cbzDRetIva')].join(','));
  poner('cbzDRetIsr', '960'); llamadas.length = 0;
  await clic(q('[data-det="guardar"]'));
  const guard = llamadas.find((l) => l.u.includes('editarCuentaCobrar'));
  check('guardar manda tipo, nombre fiscal, RFC, subtotal y retenciones', guard && guard.cuerpo.retencion_isr === '960' && guard.cuerpo.subtotal === '9600' && guard.cuerpo.tipo_factura === 'Empresa' && 'razon_social' in guard.cuerpo && 'rfc_receptor' in guard.cuerpo, JSON.stringify(guard && guard.cuerpo));
  await clic(q('[data-det="dividir"]'));
  check('la división propone 2 partes que suman el total', qa('.cbz-parte-total').length === 2 && qa('.cbz-parte-total').reduce((a, i) => a + Number(i.value), 0) === 11600);
  llamadas.length = 0;
  await clic(q('[data-div="ok"]'));
  const div = llamadas.find((l) => l.u.includes('dividirCuentaCobrar'));
  check('dividir manda el id y las partes', div && div.cuerpo.id === 4 && div.cuerpo.partes.length === 2, JSON.stringify(div && div.cuerpo));
  await clic(q('[data-det="cancelar"]'));
  q('.admin-dialog-overlay:not([hidden]) .admin-dialog-confirmar').click(); await pausa(120);
  check('cancelar la cuenta pide confirmación y manda Cancelada', llamadas.some((l) => l.u.includes('cambiarEstatusCuentaCobrar') && l.cuerpo.estatus === 'Cancelada'));
  await clic(q('#cbzDetCerrar'));

  console.log('Alta manual');
  await clic(q('#cbzCrearBtn'));
  await pausa(100);
  check('abre el formulario con los clientes', !q('#cbzNueva').hidden && qa('#cbzNCliente option').length === 4 && !qa('#cbzNCliente option').some((o) => /Sin cliente/.test(o.textContent)) && llamadas.some((l) => l.u.includes('facturables=1')));
  llamadas.length = 0;
  poner('cbzNCliente', '4'); poner('cbzNConcepto', 'Curso abierto Excel'); poner('cbzNEstrategia', 'abiertos'); poner('cbzNMonto', '1160'); poner('cbzNModo', 'total');
  await clic(q('#cbzNGuardar'));
  const alta = llamadas.find((l) => l.u.includes('crearCuentaCobrar'));
  check('el alta ofrece ligar la cuenta a un grupo del cliente', !!q('#cbzNGrupo'));
  check('crea la cuenta con el cliente, la estrategia y el monto como total', alta && alta.cuerpo.cliente_id === 4 && alta.cuerpo.estrategia === 'abiertos' && alta.cuerpo.total === '1160' && !('subtotal' in alta.cuerpo), JSON.stringify(alta && alta.cuerpo));
  check('el formulario se cierra al guardar', q('#cbzNueva').hidden);

  await clic(q('#cbzCrearBtn')); await pausa(100); llamadas.length = 0;
  poner('cbzNCliente', '3'); poner('cbzNConcepto', 'Curso Gobierno'); poner('cbzNModo', 'subtotal'); poner('cbzNMonto', '9600'); poner('cbzNRetIsr', '960');
  await clic(q('#cbzNGuardar'));
  const alta2 = llamadas.find((l) => l.u.includes('crearCuentaCobrar'));
  check('alta con subtotal manda las retenciones (y no manda total)', alta2 && alta2.cuerpo.subtotal === '9600' && alta2.cuerpo.retencion_isr === '960' && !('total' in alta2.cuerpo), JSON.stringify(alta2 && alta2.cuerpo));

  check('el formulario de Crear Grupo tiene el monto a facturar (opcional)', HTML.includes('id="gruMonto"') && HTML.includes('MONTO A FACTURAR (SIN IVA, OPCIONAL)') && HTML.includes('id="gruToggleCobro"'));
  await clic(q('#cbzCrearBtn')); await pausa(100); llamadas.length = 0;
  poner('cbzNCliente', '9'); d.getElementById('cbzNCliente').dispatchEvent(new w.Event('change', { bubbles: true })); await pausa(50);
  check('al elegir un cliente Tercero la estrategia queda en "Sin estrategia" y bloqueada', valorDe('cbzNEstrategia') === '' && d.getElementById('cbzNEstrategia').disabled);
  check('al elegir un cliente Tercero el tipo de factura se pone solo en Otro y se bloquea', valorDe('cbzNTipo') === 'Otro' && d.getElementById('cbzNTipo').disabled);
  poner('cbzNRazon', 'Taller Ejemplo SA'); poner('cbzNRfc', 'XAXX010101000'); poner('cbzNConcepto', 'Mtto'); poner('cbzNModo', 'subtotal'); poner('cbzNMonto', '10000');
  await clic(q('#cbzNGuardar'));
  const alta3 = llamadas.find((l) => l.u.includes('crearCuentaCobrar'));
  check('alta de un Tercero: cliente Tercero, tipo Otro, nombre fiscal y RFC', alta3 && alta3.cuerpo.cliente_id === 9 && alta3.cuerpo.tipo_factura === 'Otro' && alta3.cuerpo.razon_social === 'Taller Ejemplo SA' && alta3.cuerpo.rfc_receptor === 'XAXX010101000' && alta3.cuerpo.retencion_isr === '', JSON.stringify(alta3 && alta3.cuerpo));

  console.log('Alertas y Configuración');
  q('#btnNotificaciones').click(); await pausa(300);
  const secCbz = q('.alr-sec[data-sec="cobranza"]');
  check('la página de Alertas tiene la sección Cobranza con sus 2 alertas', !!secCbz && secCbz.querySelectorAll('.alr-row').length === 2, secCbz && secCbz.textContent.slice(0, 80));
  check('la alerta lleva su pastilla con texto', /vencido 21 d/.test(secCbz.textContent) && /vence en 3 d/.test(secCbz.textContent));
  llamadas.length = 0;
  secCbz.querySelector('.alr-row').click(); await pausa(300);
  check('una alerta de Cobranza abre su cuenta', q('#panel-cobranza').classList.contains('active') && !q('#cbzDetalle').hidden && txt('#cbzDetTitulo') === 'Zeta SA', txt('#cbzDetTitulo'));
  await clic(q('#cbzDetCerrar'));

  console.log('Configuración → Notificaciones: destinatarios por aviso');
  q('#btnConfig').click(); await pausa(100);
  await clic(q('#cfgCorreoHead')); await pausa(200);
  const cajas = qa('#cfgCorreoLista .cfg-correo-destino-input');
  check('CADA aviso tiene su cuadro de destinatarios (6), no solo el resumen', cajas.length === 6 && cajas.map((c) => c.dataset.campo).sort().join(',') === 'destinoNuevaCuentaCobranza,destinoNuevaSolicitud,destinoPropuestaAbierta,destinoPropuestaAceptada,destinoResumen,destinoSolicitudAtorada', cajas.map((c) => c.dataset.campo).join(','));
  check('aparece el aviso "Cuenta nueva por facturar" y el resumen conserva su destinatario guardado', /Cuenta nueva por facturar/.test(txt('#cfgCorreoLista')) && q('.cfg-correo-destino-input[data-campo="destinoResumen"]').value === 'viri@ejemplo.test');
  const cajaViri = q('.cfg-correo-destino-input[data-campo="destinoNuevaCuentaCobranza"]'), btnViri = q('.cfg-correo-destino-btn[data-campo="destinoNuevaCuentaCobranza"]');
  check('el botón Guardar de cada cuadro empieza apagado', btnViri.disabled === true);
  cajaViri.value = 'viri@ejemplo.test, alfredo@ejemplo.test'; cajaViri.dispatchEvent(new w.Event('input', { bubbles: true }));
  check('al escribir se prende Guardar de ESE cuadro y de ningún otro', btnViri.disabled === false && qa('.cfg-correo-destino-btn').filter((b) => !b.disabled).length === 1);
  llamadas.length = 0;
  await clic(btnViri); await pausa(100);
  const guardado = llamadas.find((l) => l.u.includes('actualizarConfiguracionCorreo'));
  check('guardar manda SOLO el campo de ese aviso con sus correos', guardado && Object.keys(guardado.cuerpo).join() === 'destinoNuevaCuentaCobranza' && guardado.cuerpo.destinoNuevaCuentaCobranza === 'viri@ejemplo.test, alfredo@ejemplo.test', JSON.stringify(guardado && guardado.cuerpo));
  check('después de guardar el cuadro queda limpio (sin marca de cambio)', !cajaViri.classList.contains('cfg-notif-dirty') && btnViri.disabled === true);

  console.log(fallos ? '\n' + fallos + ' prueba(s) fallaron.' : '\nprueba-cobranza: ok');
  process.exit(fallos ? 1 : 0);
})();
