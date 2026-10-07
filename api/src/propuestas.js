// api/src/propuestas.js
// La "propuesta" es lo que ve el cliente al cotizar: una página (propuesta.html, link /propuesta/{código}) que lee un
// snapshot YA ARMADO de Table Storage (tabla "PropuestasCotizacion") — nunca toca SQL, así abre al instante aunque
// apcweb-backoffice esté dormida. Mismo patrón que los reportes/diplomas públicos: PartitionKey fijo "propuesta",
// RowKey = código corto opaco (codigo-corto.js).
//
// Nace en crearCotizacion (que guarda el código en Cotizacion.blob_path como "propuesta/{código}"; las cotizaciones
// viejas guardan ahí el nombre de su PDF, "…pdf"). Junto al snapshot viven los datos "vivos": vistas del cliente
// (sin contar admin ni robots), cuándo la aceptó y si una versión nueva la reemplazó.
const { TableClient } = require("@azure/data-tables");
const { actualizarConReintento } = require("./table-contador");
const { NIVEL_LABEL } = require("./cursos-calc");

const TROZO = 30000;
const MAX_TROZOS = 30;
const PREFIJO = "propuesta/";

// Términos y condiciones: se congelan en cada propuesta (cambiar este texto no altera las ya emitidas).
const TERMINOS = [
  "Horario a definir, mínimo 4 horas a la semana en 1 o 2 sesiones.",
  "Las sesiones en línea se realizan vía Google Meet, Zoom o Teams.",
  "El precio aplica igual para modalidad presencial o virtual.",
  "La sesión de proyecto final es virtual, sin costo adicional.",
  "Cotización realizada como persona física con actividad empresarial: monto antes de impuestos, aplican IVA e ISR y retenciones conforme a la ley.",
];

const TOOL_LABELS = {
  excel: "Excel", powerbi: "Power BI", powerapps: "Power Apps",
  powerautomate: "Power Automate", ia: "IA Aplicada", ofimatica: "Ofimática Básica",
};

function getConexion() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}
function getPropuestasTable() {
  return TableClient.fromConnectionString(getConexion(), "PropuestasCotizacion");
}
async function ensureTable(table) {
  try {
    await table.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err;
  }
  return table;
}
function isTableNotFound(err) {
  if (!err || err.statusCode !== 404) return false;
  return /TableNotFound/i.test(err.code || "") || /table.*not.*found/i.test(err.message || "");
}

function partirEnTrozos(texto) {
  const partes = {};
  const n = Math.ceil(texto.length / TROZO);
  if (n > MAX_TROZOS) throw new Error("La propuesta es demasiado grande para guardarse.");
  for (let i = 0; i < n; i++) partes["snap" + i] = texto.slice(i * TROZO, (i + 1) * TROZO);
  return { partes, n };
}
function unirTrozos(entidad) {
  let texto = "";
  for (let i = 0; i < (entidad.snapPartes || 0); i++) texto += entidad["snap" + i] || "";
  return texto;
}

// "propuesta/ab12cd34" -> "ab12cd34"; el PDF de una cotización vieja ("AP_…pdf") o vacío -> null
function codigoDePropuesta(blobPath) {
  const s = String(blobPath || "");
  return s.startsWith(PREFIJO) ? s.slice(PREFIJO.length) : null;
}
const blobPathDePropuesta = (codigo) => PREFIJO + codigo;

const iso = (f) => (f instanceof Date ? f.toISOString() : String(f));
const redondea2 = (n) => Math.round(n * 100) / 100;

// Datos de la cotización -> snapshot que pinta propuesta.html. Función pura (sin red) para poder probarla.
// `d` = { folio, cliente, contacto, herramienta, programa, temas, horas, modalidad, participantes, ciudadSede,
//         fechaTentativa, objetivo, dirigidoA, proyectos, tarifaHora, precioSugerido, precioFinal, emitida, vigencia }
function armarSnapshot(d) {
  const temas = (Array.isArray(d.temas) ? d.temas : []).map((t) => ({
    n: String(t.nombre || "").trim(),
    nivel: Number(t.nivel) || 0,
    d: String(t.descripcion || "").trim(),
  })).filter((t) => t.n);
  const niveles = temas.map((t) => t.nivel).filter((n) => n > 0);
  let nivelTxt = "";
  if (niveles.length) {
    const min = Math.min(...niveles);
    const max = Math.max(...niveles);
    nivelTxt = min === max ? NIVEL_LABEL[min] : `${NIVEL_LABEL[min]} a ${NIVEL_LABEL[max]}`;
  }

  const sugerido = redondea2(Number(d.precioSugerido) || 0);
  const total = redondea2(Number(d.precioFinal) || 0);
  // descuento efectivo (el precio final se puede editar a mano sin pasar por el %)
  const descuentoPct = sugerido > 0 && total < sugerido ? Math.round((1 - total / sugerido) * 1000) / 10 : 0;

  return {
    folio: d.folio,
    cliente: d.cliente,
    contacto: d.contacto || null,
    herramienta: d.herramienta,
    herramientaNombre: TOOL_LABELS[d.herramienta] || d.herramienta,
    programa: d.programa,
    horas: Number(d.horas) || 0,
    modalidad: d.modalidad || null,
    participantes: d.participantes || null,
    ciudad: d.ciudadSede || null,
    fechaTentativa: d.fechaTentativa || null,
    nivelTxt,
    objetivo: d.objetivo || null,
    dirigido: d.dirigidoA || null,
    temas,
    proyectos: (d.proyectos || []).map((p) => ({ n: p.nombre, r: p.resumen || "", img: p.imagenUrl || null })),
    tarifaHora: Number(d.tarifaHora) || 0,
    sugerido,
    total,
    descuentoPct,
    emitida: iso(d.emitida),
    vigencia: iso(d.vigencia).slice(0, 10), // solo la fecha (YYYY-MM-DD): evita que la zona horaria la corra un día
    terminos: TERMINOS,
  };
}

async function guardarPropuesta(table, { codigo, snapshot }) {
  await ensureTable(table);
  const { partes, n } = partirEnTrozos(JSON.stringify(snapshot));
  await table.upsertEntity(
    {
      partitionKey: "propuesta",
      rowKey: codigo,
      folio: snapshot.folio,
      cliente: snapshot.cliente,
      generadoEn: new Date().toISOString(),
      vistas: 0,
      snapPartes: n,
      ...partes,
    },
    "Replace"
  );
}

// { snapshot, vivo } | null. `vivo` = lo que cambia después de emitida.
async function leerPropuesta(table, codigo) {
  try {
    const e = await table.getEntity("propuesta", codigo);
    return {
      snapshot: JSON.parse(unirTrozos(e)),
      vivo: {
        vistas: e.vistas || 0,
        primeraVista: e.primeraVista || null,
        ultimaVista: e.ultimaVista || null,
        aceptadaEn: e.aceptadaEn || null,
        aceptadaPor: e.aceptadaPor || null,
        aceptadaComentario: e.aceptadaComentario || null,
        reemplazadaPorCodigo: e.reemplazadaPorCodigo || null,
        reemplazadaPorFolio: e.reemplazadaPorFolio || null,
      },
    };
  } catch (err) {
    if (err.statusCode === 404 || isTableNotFound(err)) return null;
    throw err;
  }
}

// nunca debe tumbar la carga de la página
async function registrarVistaPropuesta(table, codigo) {
  const ahora = new Date().toISOString();
  await actualizarConReintento(
    table,
    "propuesta",
    codigo,
    (e) => ({ vistas: (e.vistas || 0) + 1, ultimaVista: ahora, primeraVista: e.primeraVista || ahora }),
    () => ({ vistas: 1, ultimaVista: ahora, primeraVista: ahora })
  );
}

// Solo la PRIMERA aceptación queda guardada (un segundo envío no pisa el nombre ni repite el aviso).
// Regresa { primera: boolean, snapshot } o null si la propuesta no existe.
async function registrarAceptacion(table, codigo, { nombre, comentario }) {
  let e;
  try {
    e = await table.getEntity("propuesta", codigo);
  } catch (err) {
    if (err.statusCode === 404 || isTableNotFound(err)) return null;
    throw err;
  }
  const snapshot = JSON.parse(unirTrozos(e));
  if (e.aceptadaEn) return { primera: false, snapshot };
  try {
    await table.updateEntity(
      { partitionKey: "propuesta", rowKey: codigo, aceptadaEn: new Date().toISOString(), aceptadaPor: nombre, aceptadaComentario: comentario || "" },
      "Merge",
      { etag: e.etag }
    );
  } catch (err) {
    if (err.statusCode === 412) return { primera: false, snapshot }; // otro envío ganó la carrera
    throw err;
  }
  return { primera: true, snapshot };
}

// La versión vieja sigue abriendo, pero con un aviso de que ya existe una más reciente. Nunca lanza.
async function marcarReemplazada(table, codigo, nuevoCodigo, nuevoFolio) {
  try {
    await table.updateEntity(
      { partitionKey: "propuesta", rowKey: codigo, reemplazadaPorCodigo: nuevoCodigo, reemplazadaPorFolio: nuevoFolio },
      "Merge"
    );
  } catch (err) {
    console.warn("No se pudo marcar la propuesta como reemplazada:", err.message);
  }
}

// { codigo: { vistas, ultimaVista, aceptadaEn, aceptadaPor } } para pintar los avisos en el admin
async function listarEstadisticas(table) {
  const mapa = {};
  try {
    const entidades = table.listEntities({
      queryOptions: { filter: "PartitionKey eq 'propuesta'", select: ["rowKey", "vistas", "ultimaVista", "aceptadaEn", "aceptadaPor"] },
    });
    for await (const e of entidades) {
      mapa[e.rowKey] = { vistas: e.vistas || 0, ultimaVista: e.ultimaVista || null, aceptadaEn: e.aceptadaEn || null, aceptadaPor: e.aceptadaPor || null };
    }
  } catch (err) {
    if (!isTableNotFound(err)) throw err;
  }
  return mapa;
}

module.exports = {
  TERMINOS,
  getPropuestasTable,
  codigoDePropuesta,
  blobPathDePropuesta,
  armarSnapshot,
  guardarPropuesta,
  leerPropuesta,
  registrarVistaPropuesta,
  registrarAceptacion,
  marcarReemplazada,
  listarEstadisticas,
};
