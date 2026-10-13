// api/src/cola-tabla.js
// Cola de envíos públicos en Table Storage, genérica: la usan el Diagnóstico (diagnostico-cola.js) y la Encuesta
// (encuesta-cola.js). Nació en Solicitudes (solicitud-publica-cola.js, que se deja como está para no arriesgarla).
//
// POR QUÉ: la base SQL serverless se duerme y cada envío público que la tocaba la despertaba y la dejaba despierta
// 20-30 min (cuota gratis de 100 000 vCore-s al mes). La persona solo escribe aquí (Table Storage nunca se duerme, ~1 s)
// y el envío pasa a SQL ("importación") cuando Alfredo abre el panel o pulsa "Importar ahora".
//
// Una fila por envío: PartitionKey "pend", RowKey = envioId (UUID del navegador → idempotente: un reintento no crea otra
// fila, 409 = ya estaba), `recibidoEn`, `intentos`, `ultimoError` y lo propio de cada módulo (`datos` = JSON del envío).
// Importación: nunca lanza, una sola corrida a la vez por instancia, con tope de filas y de tiempo (la Function admite 45 s);
// las filas que ya fallaron se reintentan al final y se quedan visibles con su motivo.
const { TableClient } = require("@azure/data-tables");
const { ensureTable } = require("./diagnostico-tables");

const PARTICION = "pend";
const MAX_POR_CORRIDA = 25;
const PRESUPUESTO_MS = 30000;
const MAX_JSON = 30000; // una propiedad de Table Storage admite 32 K caracteres

const notFound = (err) => err && err.statusCode === 404;

function crearCola({ tabla }) {
  const state = { lista: false, enCurso: null };

  function getTable() {
    const conn = process.env.RECURSOS_STORAGE_CONNECTION;
    if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
    return TableClient.fromConnectionString(conn, tabla);
  }

  async function asegurar(table) {
    if (state.lista) return;
    await ensureTable(table);
    state.lista = true;
  }

  // extra = columnas propias del módulo (incluye `datos`, el JSON del envío). → { nueva:false } si ya estaba.
  async function encolar(table, envioId, extra, ahora = new Date()) {
    await asegurar(table);
    if (extra.datos && extra.datos.length > MAX_JSON) throw new Error("El envío es demasiado grande.");
    try {
      await table.createEntity({ partitionKey: PARTICION, rowKey: envioId, recibidoEn: ahora.toISOString(), intentos: 0, ultimoError: "", ...extra });
      return { nueva: true };
    } catch (err) {
      if (err.statusCode === 409) return { nueva: false };
      throw err;
    }
  }

  async function leer(table, envioId) {
    try { return await table.getEntity(PARTICION, envioId); } catch (err) { if (notFound(err)) return null; throw err; }
  }

  async function borrar(table, envioId) {
    try { await table.deleteEntity(PARTICION, envioId); } catch (err) { if (!notFound(err)) throw err; }
  }

  // Solo Table Storage (no despierta la base). { total, errores, lista, ...lo que sume `agrupar(e, r)` }.
  // `fila(e)` arma el renglón de las que tienen error (máx. 20).
  async function resumen(table, { select, agrupar, fila }) {
    const r = { total: 0, errores: 0, lista: [] };
    try {
      for await (const e of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTICION}'`, select: ["rowKey", "recibidoEn", "intentos", "ultimoError", ...(select || [])] } })) {
        r.total++;
        if (agrupar) agrupar(e, r);
        if (e.ultimoError) {
          r.errores++;
          if (r.lista.length < 20) r.lista.push(fila(e));
        }
      }
    } catch (err) {
      if (!notFound(err)) throw err; // sin tabla = nada pendiente
    }
    return r;
  }

  // `insertar(envioId, datos, recibidoEn)` escribe en SQL. NUNCA lanza. → { importadas, errores, restantes }.
  function importar(table, insertar, context, opciones = {}) {
    if (state.enCurso) return state.enCurso;
    const max = opciones.max || MAX_POR_CORRIDA;
    const presupuesto = opciones.presupuestoMs || PRESUPUESTO_MS;
    state.enCurso = (async () => {
      const inicio = Date.now();
      const r = { importadas: 0, errores: 0, restantes: 0 };
      try {
        await asegurar(table);
        const pendientes = [];
        for await (const e of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTICION}'` } })) pendientes.push(e);
        // las nuevas primero; las que ya fallaron al final (la causa pudo arreglarse: p. ej. se restauró el cliente)
        pendientes.sort((a, b) => (a.ultimoError ? 1 : 0) - (b.ultimoError ? 1 : 0) || String(a.recibidoEn).localeCompare(String(b.recibidoEn)));
        let tocadas = 0;
        for (const e of pendientes) {
          if (tocadas >= max || Date.now() - inicio > presupuesto) break;
          tocadas++;
          try {
            await insertar(e.rowKey, JSON.parse(e.datos), new Date(e.recibidoEn));
            await borrar(table, e.rowKey);
            r.importadas++;
          } catch (err) {
            r.errores++;
            if (context) context.log.error("Cola " + tabla + ": no se pudo importar " + e.rowKey + ":", err.message);
            try {
              await table.updateEntity({ partitionKey: PARTICION, rowKey: e.rowKey, intentos: (e.intentos || 0) + 1, ultimoError: String(err.safe ? err.message : "No se pudo guardar en la base (" + err.message + ")").slice(0, 300) }, "Merge");
            } catch (_) { /* si no se puede anotar el error, se reintenta la próxima vez */ }
          }
        }
        r.restantes = pendientes.length - r.importadas;
      } catch (err) {
        if (context) context.log.error("Cola " + tabla + ": no se pudo importar:", err.message);
      }
      return r;
    })();
    const p = state.enCurso;
    return p.finally(() => { if (state.enCurso === p) state.enCurso = null; });
  }

  return { getTable, asegurar, encolar, leer, borrar, resumen, importar, reiniciar: () => { state.lista = false; } };
}

module.exports = { crearCola, PARTICION, MAX_POR_CORRIDA };
