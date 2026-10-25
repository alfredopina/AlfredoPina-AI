// api/src/notificaciones-ajustes.js
// Ajustes de los AVISOS POR CORREO a Alfredo (no confundir con los umbrales de las Alertas de la campana, que viven en
// notificaciones-config.js). Table Storage (tabla "ConfiguracionNotificaciones", renglón config/correo): nunca depende
// de que SQL esté despierta, y las Functions públicas (solicitud nueva, propuesta aceptada/abierta) lo leen en cada
// aviso. Si algo falla al leerlo, se asumen los defaults (todo encendido): un fallo de configuración nunca debe
// tumbar un aviso ni el sitio.
//
//   general ............ interruptor maestro: apagado = ningún correo sale, sin importar los demás
//   nuevaSolicitud ..... el formulario del sitio recibió una solicitud
//   propuestaAceptada .. un cliente pulsó "Aceptar propuesta"
//   propuestaAbierta ... un cliente abrió su propuesta (primera vez, ya confirmada con la página abierta unos segundos)
//   solicitudAtorada ... una solicitud lleva más de `horasAtorada` horas en la cola sin pasar a SQL
//   resumenSemanal ..... el correo del lunes
//   nuevaCuentaCobranza  nació una cuenta por cobrar (cotización ganada o grupo): le avisa a quien factura (Viri)
//   destino<Aviso> ..... correos (separados por coma) que reciben ESE aviso; vacío = los de NOTIFICACIONES_DESTINO. Cada aviso tiene el suyo
//                        (destinoResumen es el del resumen semanal, el primero que existió)
//   ultimoResumen ...... { en, contadores } para contar solo lo NUEVO desde el resumen anterior (no es una métrica
//                        de Tracking: es el punto de comparación del correo)
const { TableClient } = require("@azure/data-tables");

const TABLA = "ConfiguracionNotificaciones";
const PK = "config";
const RK = "correo";

const TIPOS = ["nuevaSolicitud", "propuestaAceptada", "propuestaAbierta", "solicitudAtorada", "resumenSemanal", "nuevaCuentaCobranza"];
// campo donde se guardan los destinatarios de cada aviso
const CAMPO_DESTINO = {
  nuevaSolicitud: "destinoNuevaSolicitud",
  propuestaAceptada: "destinoPropuestaAceptada",
  propuestaAbierta: "destinoPropuestaAbierta",
  solicitudAtorada: "destinoSolicitudAtorada",
  resumenSemanal: "destinoResumen",
  nuevaCuentaCobranza: "destinoNuevaCuentaCobranza",
};
const DEFAULTS = {
  general: true,
  nuevaSolicitud: true,
  propuestaAceptada: true,
  propuestaAbierta: true,
  solicitudAtorada: true,
  resumenSemanal: true,
  nuevaCuentaCobranza: true,
  destinoNuevaSolicitud: "",
  destinoPropuestaAceptada: "",
  destinoPropuestaAbierta: "",
  destinoSolicitudAtorada: "",
  destinoResumen: "",
  destinoNuevaCuentaCobranza: "",
  horasAtorada: 4,
};
const MAX_DESTINOS = 5;
const CORREO_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function getTabla() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) return null;
  return TableClient.fromConnectionString(conn, TABLA);
}

async function asegurarTabla(tabla) {
  try {
    await tabla.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err;
  }
}

// nunca lanza: ante cualquier problema regresa los defaults
async function getAjustes() {
  const tabla = getTabla();
  if (!tabla) return { ...DEFAULTS };
  try {
    const e = await tabla.getEntity(PK, RK);
    const r = { ...DEFAULTS };
    for (const k of ["general", ...TIPOS]) if (typeof e[k] === "boolean") r[k] = e[k];
    for (const campo of Object.values(CAMPO_DESTINO)) if (typeof e[campo] === "string") r[campo] = e[campo];
    if (typeof e.horasAtorada === "number" && e.horasAtorada >= 1) r.horasAtorada = e.horasAtorada;
    return r;
  } catch (err) {
    return { ...DEFAULTS };
  }
}

async function activo(tipo) {
  const a = await getAjustes();
  return a.general !== false && a[tipo] !== false;
}

// correos configurados para un aviso (lista; vacía = el aviso va a los de NOTIFICACIONES_DESTINO). Nunca lanza: un campo mal escrito se ignora.
function destinosDe(a, tipo) {
  try { return parseDestinos((a || {})[CAMPO_DESTINO[tipo]]); } catch (err) { return []; }
}

// "a@x.com, b@y.com" → ["a@x.com","b@y.com"]; lanza Error con mensaje en español si algo no es un correo
function parseDestinos(texto) {
  const lista = String(texto || "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  if (lista.length > MAX_DESTINOS) throw new Error("Máximo " + MAX_DESTINOS + " correos.");
  for (const c of lista) if (!CORREO_RE.test(c)) throw new Error('"' + c + '" no parece un correo válido.');
  return lista;
}

// `cambios`: cualquier subconjunto de { general, <tipos>, destinoResumen }. Valida y guarda (Merge).
async function actualizarAjustes(cambios) {
  const tabla = getTabla();
  if (!tabla) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  const fila = {};
  for (const k of ["general", ...TIPOS]) {
    if (cambios[k] === undefined) continue;
    if (typeof cambios[k] !== "boolean") throw new Error('"' + k + '" debe ser verdadero o falso.');
    fila[k] = cambios[k];
  }
  for (const campo of Object.values(CAMPO_DESTINO)) {
    if (cambios[campo] !== undefined) fila[campo] = parseDestinos(cambios[campo]).join(", ");
  }
  if (!Object.keys(fila).length) throw new Error("No hay nada que guardar.");
  await asegurarTabla(tabla);
  await tabla.upsertEntity({ partitionKey: PK, rowKey: RK, ...fila }, "Merge");
  return getAjustes();
}

async function leerUltimoResumen() {
  const tabla = getTabla();
  if (!tabla) return null;
  try {
    const e = await tabla.getEntity(PK, RK);
    return e.ultimoResumen ? JSON.parse(e.ultimoResumen) : null;
  } catch (err) {
    return null;
  }
}

async function guardarUltimoResumen(valor) {
  const tabla = getTabla();
  if (!tabla) return;
  await asegurarTabla(tabla);
  await tabla.upsertEntity({ partitionKey: PK, rowKey: RK, ultimoResumen: JSON.stringify(valor) }, "Merge");
}

module.exports = { DEFAULTS, TIPOS, CAMPO_DESTINO, destinosDe, getAjustes, activo, parseDestinos, actualizarAjustes, leerUltimoResumen, guardarUltimoResumen };
