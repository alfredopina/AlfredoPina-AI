// tools/prueba-config-tablero.js — prueba funcional del TABLERO de entrada de Configuración (franja de salud, tarjetas con estado en vivo,
// abrir una sección y volver) cargando admin/index.html en jsdom con un servidor falso. No toca nada real.
// jsdom NO es dependencia del proyecto: instálalo en una carpeta temporal y apunta a ella (ver tools/prueba-barra-admin.js):
//   set JSDOM_DIR=%TEMP%jsdom-barra && node tools/prueba-config-tablero.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_DIR ? path.join(process.env.JSDOM_DIR, 'node_modules', 'jsdom') : 'jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');

const llamadas = [];
const hoy = Date.now();
let estado = {
  cola: { pendientes: 0, masAntiguaHoras: null },
  base: { estado: 'dormida', cuota: { nivel: 'ok', porcentaje: 35, restante: 35298, total: 100000, horasAlMinimo: 70, costoHoraDespiertaUsd: 0.31 }, cuotaEn: new Date(hoy - 4 * 86400000).toISOString() },
  respaldo: { en: new Date(hoy - 3 * 86400000).toISOString(), origen: 'auto' },
  resumen: { en: null },
  correo: { configurado: true, remitente: 'n@x.com', general: true, avisosActivos: 9, avisosTotal: 12 },
};
let metricas = { solicitudes: { desde: null, hasta: null }, cotizaciones: { desde: null, hasta: null }, grupos: { desde: null, hasta: null } };
const actividad = [{ correo: 'alfredo.pina@lifezen.com.mx', veces: 40, ultimaVez: new Date(hoy - 3 * 3600000).toISOString() }, { correo: 'viri@lifezen.com.mx', veces: 5, ultimaVez: new Date(hoy - 86400000 * 3).toISOString() }];
const alertas = { total: 3, umbrales: {}, grupos: { solicitudes: [], cotizaciones: [], grupos: [], clientes: [] } };
function respuesta(cuerpo, status = 200) { return Promise.resolve({ ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) }); }
function fetchFalso(url) {
  const u = String(url); llamadas.push(u);
  if (u.includes('/api/getEstadoSistema')) return respuesta(estado || {}, estado ? 200 : 500);
  if (u.includes('/api/getMetricasDesde')) return respuesta(metricas);
  if (u.includes('/api/listActividadAdmin')) return respuesta(actividad);
  if (u.includes('/api/getEstadoBase')) return respuesta({ estado: 'dormida', cuotaSegundos: 35298, cuotaEn: new Date().toISOString() });
  if (u.includes('/api/getNotificacionesActivas')) return respuesta(alertas);
  if (u.includes('/api/getConfiguracionCorreo')) return respuesta({ general: true });
  if (u.includes('/api/getConfiguracionNotificaciones')) return respuesta({});
  if (u.includes('/api/listPendientes')) return respuesta({ categorias: [], pendientes: [] });
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
// VOLCAR_HTML=carpeta guarda el DOM de cada escenario para tomarle captura con un navegador (sin scripts)
const volcar = (nombre) => { if(!process.env.VOLCAR_HTML) return; const copia = d.documentElement.cloneNode(true); copia.querySelectorAll('script').forEach((s) => s.remove()); fs.writeFileSync(path.join(process.env.VOLCAR_HTML, nombre + '.html'), '<!doctype html>' + copia.outerHTML); };
const txt = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);

(async () => {
  await pausa(700);
  check('el script de la página corrió sin errores graves', errores.filter((e) => !/Not implemented|navigation|resource/i.test(e)).length === 0, errores.slice(0, 3).join(' | '));
  const antes = llamadas.filter((u) => u.includes('getEstadoSistema')).length;
  console.log('Entrada a Configuración (todo en orden)');
  q('#btnConfig').click(); await pausa(300);
  check('abre el TABLERO (no la lista de renglones): tablero visible, detalle oculto', !q('#cfgTablero').hidden && q('#cfgDetalle').hidden);
  check('pide el estado al servidor al entrar', llamadas.filter((u) => u.includes('getEstadoSistema')).length === antes + 1);
  check('no toca nada que despierte la base (sin buscarGlobal/listTarifas desde el tablero)', !llamadas.some((u) => /listTarifasAdmin|buscarGlobalAdmin/.test(u)));
  check('7 tarjetas', d.querySelectorAll('.cfgt-tile').length === 7);
  check('franja de salud: Todo en orden, con la base y el respaldo en el texto', txt('#cfgSalud .cfgt-salud-tit') === 'Todo en orden' && /Base dormida · cuota 35 %/.test(txt('#cfgSalud .cfgt-salud-sub')) && /hace 3 días/.test(txt('#cfgSalud .cfgt-salud-sub')), txt('#cfgSalud'));
  check('franja en verde-azulado (clase ok) y NO en ámbar', q('#cfgSalud').classList.contains('cfgt-salud-ok') && !q('#cfgSalud').classList.contains('cfgt-salud-revisar'));
  check('Estado del sistema: línea con la base y la cuota + chip "En orden" con texto', txt('[data-linea="estado"]') === 'Base dormida · cuota 35 %' && /En orden/.test(txt('[data-chip="estado"]')));
  check('Respaldos: "Último hace 3 días · automático"', txt('[data-linea="resp"]') === 'Último hace 3 días · automático', txt('[data-linea="resp"]'));
  check('Notificaciones: "9 de 12 avisos encendidos"', txt('[data-linea="correo"]') === '9 de 12 avisos encendidos');
  check('Métricas sin rango: "Contando todo el historial"', txt('[data-linea="met"]') === 'Contando todo el historial');
  check('Actividad: 2 administradores y último acceso', /^2 administradores · último acceso hace 3 h/.test(txt('[data-linea="act"]')), txt('[data-linea="act"]'));
  check('Tarifas: sin dato en vivo (vive en SQL), solo descripción', txt('[data-linea="tarifas"]') === 'Precio base de cada herramienta');
  check('Alertas: toma el número del ícono de la barra (3) con chip y texto', /3 alertas activas/.test(txt('[data-linea="notif"]')) && !q('[data-chip="notif"]').hidden && txt('[data-chip="notif"]') === '3', txt('[data-linea="notif"]') + ' / ' + txt('[data-chip="notif"]'));

  volcar('config-ok');
  console.log('Abrir una sección y volver');
  q('.cfgt-tile[data-cfg="estado"]').click(); await pausa(300);
  check('abre SOLO esa sección (las otras 6 tarjetas ocultas) y el tablero se oculta', q('#cfgTablero').hidden && !q('#cfgDetalle').hidden && d.querySelectorAll('#cfgDetalle .cfg-card:not([hidden])').length === 1 && !q('#cfgDetalle .cfg-card[data-cfg="estado"]').hidden);
  check('la sección queda desplegada (su lógica de siempre corre)', !q('#cfgEstadoBody').hidden);
  check('el botón de volver ahora dice "Configuración"', txt('#configBackTxt') === 'Configuración');
  q('#configBack').click(); await pausa(300);
  check('"Configuración" regresa al TABLERO (no sale de Configuración)', !q('#cfgTablero').hidden && q('#cfgDetalle').hidden && q('#panel-config').classList.contains('active') && txt('#configBackTxt') === 'Volver');
  q('.cfgt-tile[data-cfg="act"]').click(); await pausa(300);
  check('otra sección: Actividad se despliega y las demás se ocultan', !q('#cfgActividadBody').hidden && !q('#cfgDetalle .cfg-card[data-cfg="act"]').hidden && q('#cfgDetalle .cfg-card[data-cfg="estado"]').hidden);
  q('#btnConfig').click(); await pausa(300);
  check('pulsar el engrane estando en una sección también regresa al tablero', !q('#cfgTablero').hidden && q('#cfgDetalle').hidden);
  q('#configBack').click(); await pausa(100);
  check('"Volver" desde el tablero sale de Configuración (vuelve a la pantalla anterior)', !q('#panel-config').classList.contains('active') && q('#panel-tracking-view').classList.contains('active'));

  console.log('Con problemas');
  estado = Object.assign({}, estado, {
    cola: { pendientes: 2, masAntiguaHoras: 9 },
    base: { estado: 'despierta', cuota: { nivel: 'baja', porcentaje: 15, restante: 15000, total: 100000, horasAlMinimo: 30, costoHoraDespiertaUsd: 0.31 } },
    respaldo: { en: new Date(hoy - 12 * 86400000).toISOString(), origen: 'auto' },
  });
  metricas = { solicitudes: { desde: '2026-01-01T00:00:00Z', hasta: null }, cotizaciones: { desde: null, hasta: null }, grupos: { desde: null, hasta: '2026-06-01T00:00:00Z' } };
  q('#btnConfig').click(); await pausa(300);
  check('franja en ámbar: "2 cosas por revisar" con TEXTO, no solo color', q('#cfgSalud').classList.contains('cfgt-salud-revisar') && txt('#cfgSalud .cfgt-salud-tit') === '2 cosas por revisar', txt('#cfgSalud .cfgt-salud-tit'));
  const probs = Array.from(d.querySelectorAll('.cfgt-prob')).map((b) => b.textContent);
  check('cada problema es un botón que dice qué pasa', probs.length === 2 && /Estado del sistema: cuota baja, solicitudes atoradas en la cola/.test(probs[0]) && /Respaldos: el último respaldo es de hace 12 días/.test(probs[1]), JSON.stringify(probs));
  check('las tarjetas con problema llevan el chip "Revisar" con texto', /Revisar/.test(txt('[data-chip="estado"]')) && /Revisar/.test(txt('[data-chip="resp"]')) && /En orden/.test(txt('[data-chip="correo"]')));
  check('la línea de Estado incluye las solicitudes en espera', txt('[data-linea="estado"]') === 'Base despierta · cuota 15 % · 2 solicitudes en espera', txt('[data-linea="estado"]'));
  check('Métricas con rango: "Rango personalizado en 2 de 3 Trackings"', txt('[data-linea="met"]') === 'Rango personalizado en 2 de 3 Trackings', txt('[data-linea="met"]'));
  volcar('config-revisar');
  q('.cfgt-prob[data-cfg="resp"]').click(); await pausa(300);
  check('un clic en el problema abre esa sección (Respaldos)', q('#cfgTablero').hidden && !q('#cfgDetalle .cfg-card[data-cfg="resp"]').hidden && !q('#cfgRespaldosBody').hidden);
  q('#configBack').click(); await pausa(200);

  console.log('Si el servidor no responde');
  estado = null;
  q('#btnConfig').click(); await pausa(300);
  check('franja en ámbar avisando que no se pudo revisar (nunca "Todo en orden" por defecto)', q('#cfgSalud').classList.contains('cfgt-salud-revisar') && /no se pudo revisar/.test(txt('#cfgSalud')), txt('#cfgSalud'));

  console.log(fallos ? '\n' + fallos + ' FALLARON' : '\ntablero de Configuración: todo en orden');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
