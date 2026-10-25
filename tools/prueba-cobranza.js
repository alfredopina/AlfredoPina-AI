// tools/prueba-cobranza.js — prueba funcional del panel COBRANZA del admin: carga admin/index.html en jsdom con un servidor falso
// (datos FICTICIOS, nada real). jsdom no es dependencia del proyecto (ver tools/prueba-barra-admin.js para instalarlo):
//   set JSDOM_DIR=%TEMP%\jsdom-cbz && node tools/prueba-cobranza.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_DIR ? path.join(process.env.JSDOM_DIR, 'node_modules', 'jsdom') : 'jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');

const sem = (clave, dias) => ({ clave, dias });
const pago = (id, monto, fecha, anulado) => ({ id, monto, fecha, metodo: 'Transferencia', folio_complemento: '17', uuid_complemento: 'aaaa-bbbb', anulado: !!anulado });
const cuenta = (o) => ({ id: 1, cliente_id: 3, cliente: 'Acme SA', cliente_codigo: 'ACME', cotizacion_id: 7, cotizacion_folio: 'AP26-ACME-EXCEL-01', origen: 'Automática', estrategia: 'empresas',
  concepto: 'Curso de Excel', subtotal: 10000, iva: 1600, retencion_isr: 0, retencion_iva: 0, total: 11600, folio_factura: null, uuid_factura: null, fecha_emision: null, orden_compra: null, inicio_plazo: null,
  plazo_dias: 30, fecha_creacion: '2026-09-16T05:33:00.000Z', vencimiento: null, estatus: 'Por facturar', notas: null, pagos: [], pagado: 0, saldo: 11600, semaforo: sem('sin_plazo', null), ...o });
let cuentas = [
  cuenta({ id: 1, cliente: 'Zeta SA', estatus: 'Facturada', folio_factura: '201', fecha_emision: '2026-09-01', inicio_plazo: '2026-09-01', vencimiento: '2026-10-01', semaforo: sem('vencida', 21) }),
  cuenta({ id: 2, cliente: 'Beta SA', estatus: 'Facturada', folio_factura: '202', fecha_emision: '2026-10-10', inicio_plazo: '2026-10-10', vencimiento: '2026-10-25', semaforo: sem('por_vencer', 3) }),
  cuenta({ id: 3, cliente: 'Alfa SA', estatus: 'Parcial', folio_factura: '203', fecha_emision: '2026-10-12', inicio_plazo: '2026-10-12', vencimiento: '2026-11-30', pagado: 4000, saldo: 7600, pagos: [pago(1, 4000, '2026-10-15')], semaforo: sem('al_corriente', 39) }),
  cuenta({ id: 4, cliente: 'Gamma SA', estatus: 'Por facturar', semaforo: sem('sin_plazo', null) }),
  cuenta({ id: 5, cliente: 'Delta SA', estatus: 'Pagada', folio_factura: '190', fecha_emision: '2026-08-01', saldo: 0, pagado: 11600, pagos: [pago(2, 11600, '2026-08-20')], semaforo: sem('cerrada', null) }),
  cuenta({ id: 6, cliente: 'Epsilon SA', estatus: 'Cancelada', semaforo: sem('cerrada', null) }),
  cuenta({ id: 7, cliente: 'Taller Ejemplo SA', cliente_id: null, razon_social: 'Taller Ejemplo SA', tipo_factura: 'Otro', estatus: 'Facturada', folio_factura: '300', fecha_emision: '2026-09-02', inicio_plazo: '2026-09-02', vencimiento: '2026-10-02', semaforo: sem('vencida', 20) }),
];
const resumen = { por_cobrar: 30000.5, por_cobrar_n: 3, vencido: 11600, vencido_n: 1, por_vencer: 11600, por_vencer_n: 1, por_facturar: 11600, por_facturar_n: 1, cobrado: 15600, cobrado_n: 2, dias_promedio: 19, contando_desde: null, contando_hasta: null };
const alertas = { total: 2, umbrales: { cobranzaPorVencerDias: 7 }, grupos: { solicitudes: [], cotizaciones: [], grupos: [], clientes: [], cobranza: [
  { tipo: 'cobranza', id: 1, cliente: 'Zeta SA', detalle: 'Cobro vencido, factura 201', dias: 21, pastilla: 'vencido 21 d' },
  { tipo: 'cobranza', id: 2, cliente: 'Beta SA', detalle: 'Cobro por vencer, factura 202', dias: 3, pastilla: 'vence en 3 d' } ] } };

const llamadas = []; // { url, cuerpo }
function respuesta(cuerpo, status = 200) { return Promise.resolve({ ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) }); }
function fetchFalso(url, opts) {
  const u = String(url); const cuerpo = opts && opts.body ? JSON.parse(opts.body) : null; llamadas.push({ u, cuerpo });
  if (u.includes('/api/listCobranzaAdmin')) return respuesta(cuentas);
  if (u.includes('/api/getResumenCobranzaAdmin')) return respuesta(resumen);
  if (u.includes('/api/getNotificacionesActivas')) return respuesta(alertas);
  if (u.includes('/api/buscarClientesAdmin')) return respuesta([{ id: 3, nombre: 'Acme SA', codigo: 'ACME', tipo_cliente: 'Directo' }, { id: 4, nombre: 'Beta SA', codigo: 'BETA', tipo_cliente: 'Intermediario' }, { id: 9, nombre: 'Taller Ejemplo SA', codigo: 'TAL', tipo_cliente: 'Tercero' }]);
  if (u.includes('/api/registrarPagoCobranza') && cuerpo.monto > 7600) return respuesta({ error: 'El pago excede el saldo (queda por cobrar 7600.00).' }, 409);
  if (/\/api\/(registrarPagoCobranza|anularPagoCobranza|editarCuentaCobrar|cambiarEstatusCuentaCobrar|dividirCuentaCobrar|crearCuentaCobrar)/.test(u)) return respuesta({ ok: true });
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

  console.log('Tabla: vista Por cobrar, orden y semáforo');
  let filas = qa('#cbzListaBody tr[data-id]');
  check('Por cobrar muestra Facturada y Parcial (3), en el orden del servidor (la vencida primero)', filas.length === 3 && filas[0].dataset.id === '1', filas.map((f) => f.dataset.id).join(','));
  check('contadores de las vistas', txt('#cbzN-cobrar') === '3' && txt('#cbzN-vencidas') === '1' && txt('#cbzN-facturar') === '1' && txt('#cbzN-pagadas') === '1' && txt('#cbzN-canceladas') === '1' && txt('#cbzN-terceros') === '1' && txt('#cbzN-todo') === '7', ['cobrar','vencidas','facturar','pagadas','canceladas','terceros','todo'].map((k) => txt('#cbzN-' + k)).join(','));
  check('la factura de terceros (Otro) NO está en Por cobrar ni en Vencidas, solo en Terceros y Todo', !qa('#cbzListaBody tr[data-id]').some((f) => f.dataset.id === '7'));
  check('"Todo" es la última vista', qa('#cbzVistas .radm-tab').pop().dataset.vista === 'todo');
  const s0 = filas[0].querySelector('.cbz-sem'), s1 = filas[1].querySelector('.cbz-sem');
  check('semáforo SIEMPRE con ícono + texto: vencida', s0.classList.contains('vencida') && !!s0.querySelector('svg') && /Vencida 21 d/.test(s0.textContent), s0.textContent);
  check('semáforo SIEMPRE con ícono + texto: por vencer', s1.classList.contains('por_vencer') && !!s1.querySelector('svg') && /Vence en 3 d/.test(s1.textContent), s1.textContent);
  await clic(q('#cbzVistas [data-vista="facturar"]'));
  const sinPlazo = q('#cbzListaBody .cbz-sem');
  check('sin inicio de plazo: estado neutro con texto "Sin plazo"', sinPlazo.classList.contains('sin_plazo') && /Sin plazo/.test(sinPlazo.textContent) && !!sinPlazo.querySelector('svg'));
  await clic(q('#cbzVistas [data-vista="todo"]'));
  check('Todo lista las 7', qa('#cbzListaBody tr[data-id]').length === 7);
  await clic(q('#cbzVistas [data-vista="terceros"]'));
  check('Terceros lista solo la de terceros, con su tipo', qa('#cbzListaBody tr[data-id]').length === 1 && /Otro/.test(txt('#cbzListaBody tr[data-id="7"]')));
  await clic(q('#cbzVistas [data-vista="todo"]'));
  await clic(q('.cbz-tabla th[data-sort="cliente"]'));
  check('ordenar por Cliente (clic en el encabezado)', qa('#cbzListaBody tr[data-id]')[0].dataset.id === '3', qa('#cbzListaBody tr[data-id]').map((f) => f.dataset.id).join(','));
  poner('cbzFBuscar', 'beta');
  check('el buscador filtra por cliente', qa('#cbzListaBody tr[data-id]').length === 1);
  await clic(q('#cbzLimpiar'));
  check('limpiar filtros regresa al orden del servidor', qa('#cbzListaBody tr[data-id]').length === 7 && qa('#cbzListaBody tr[data-id]')[0].dataset.id === '1');

  check('la primera columna es Creada, con fecha y hora', /Creada/.test(txt('.cbz-tabla thead th:first-child')) && txt('#cbzListaBody tr td:first-child').includes('15/09/2026') && /11:33/.test(txt('#cbzListaBody tr td:first-child')), txt('#cbzListaBody tr td:first-child'));
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

  console.log(fallos ? '\n' + fallos + ' prueba(s) fallaron.' : '\nprueba-cobranza: ok');
  process.exit(fallos ? 1 : 0);
})();
