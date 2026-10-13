// test-diagnostico-cola.js — el Diagnóstico ya NO escribe en SQL al enviarse: queda en una COLA (Table Storage) y se importa
// cuando Alfredo abre el panel (2026-10-13). Sin red: tablas en memoria y un SQL simulado.
// Cubre: enviarDiagnostico (califica, encola, idempotente, "una persona no contesta dos veces" pero mismo dispositivo/IP sí,
// nunca toca SQL), importación (orden, errores visibles, tope, una corrida a la vez, nunca lanza, idempotente), descartar,
// contador (pendientes, siembra SQL + cola) y eliminar respuesta (libera la huella).
const Module = require("module");
const assert = require("assert");

const tablas = {}; // nombre -> Map(pk|rk -> entidad)
let etag = 0;
const fallas = { cola: 0 }; // fallas simuladas de createEntity en la cola
function fakeTable(nombre) {
  const m = tablas[nombre] || (tablas[nombre] = new Map());
  const k = (p, r) => p + "|" + r;
  const err = (c) => { const e = new Error("estado " + c); e.statusCode = c; return e; };
  return {
    createTable: async () => {},
    getEntity: async (p, r) => { const e = m.get(k(p, r)); if (!e) throw err(404); return { ...e }; },
    createEntity: async (e) => {
      if (nombre === "DiagnosticoPendientes" && fallas.cola > 0) { fallas.cola--; throw err(500); }
      if (m.has(k(e.partitionKey, e.rowKey))) throw err(409);
      m.set(k(e.partitionKey, e.rowKey), { ...e, etag: String(++etag) });
    },
    updateEntity: async (e, modo, opts) => {
      const cur = m.get(k(e.partitionKey, e.rowKey)); if (!cur) throw err(404);
      if (opts && opts.etag && opts.etag !== cur.etag) throw err(412);
      m.set(k(e.partitionKey, e.rowKey), { ...cur, ...e, etag: String(++etag) });
    },
    upsertEntity: async (e, modo) => { const cur = m.get(k(e.partitionKey, e.rowKey)); m.set(k(e.partitionKey, e.rowKey), { ...(modo === "Merge" ? cur : {}), ...e, etag: String(++etag) }); },
    deleteEntity: async (p, r) => { if (!m.delete(k(p, r))) throw err(404); },
    listEntities: (o) => {
      const f = o && o.queryOptions && o.queryOptions.filter; const mm = f && /PartitionKey eq '([^']+)'/.exec(f);
      return (async function* () { for (const e of [...m.values()]) if (!mm || e.partitionKey === mm[1]) yield { ...e }; })();
    },
  };
}

// SQL simulado: registra lo que se pide y responde según el texto de la consulta
const sqlLog = { consultas: [], commits: 0, rollbacks: 0, tocado: 0 };
let sqlModo = { duplicada: false, falla: null, enSql: { total: 4, excel: 3, powerbi: 1 }, eliminar: null };
class FakeRequest {
  constructor() { this.params = {}; }
  input(n, t, v) { this.params[n] = v === undefined ? t : v; return this; }
  async query(texto) {
    sqlLog.tocado++;
    sqlLog.consultas.push({ texto, params: { ...this.params } });
    if (sqlModo.falla && texto.includes(sqlModo.falla.en)) throw new Error(sqlModo.falla.msg);
    if (texto.includes("sp_getapplock")) return { recordset: [{ r: 0 }] };
    if (texto.includes("SELECT TOP 1 id FROM DiagnosticoRespuesta")) return { recordset: sqlModo.duplicada ? [{ id: 99 }] : [] };
    if (texto.includes("INSERT INTO DiagnosticoRespuesta (")) return { recordset: [{ id: 7 }] };
    if (texto.includes("INSERT INTO DiagnosticoRespuestaDetalle")) return { recordset: [] };
    if (texto.includes("COUNT(*) AS total")) return { recordset: [sqlModo.enSql] };
    if (texto.includes("SELECT r.herramienta, r.nombre")) return { recordset: sqlModo.eliminar ? [sqlModo.eliminar] : [] };
    if (texto.includes("DELETE FROM DiagnosticoRespuesta WHERE")) return { recordset: [], rowsAffected: [1] };
    return { recordset: [] };
  }
}
class FakeTransaction { async begin() {} async commit() { sqlLog.commits++; } async rollback() { sqlLog.rollbacks++; } }
const fakeSql = { Request: FakeRequest, Transaction: FakeTransaction, NVarChar: "nv", VarChar: "v", Int: "i", Char: "c", TinyInt: "t", Bit: "b", DateTime2: "d" };
const fakePool = { request: () => new FakeRequest() };

const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "@azure/data-tables") return { TableClient: { fromConnectionString: (_c, nombre) => fakeTable(nombre) } };
  if (/backoffice-db$/.test(req)) return { getPool: async () => { sqlLog.tocado++; return fakePool; }, sql: fakeSql }; // cada getPool = una conexión a SQL
  if (/cliente-resolver$/.test(req)) return { resolverCliente: async (exec, empresa, tipo, o) => { if (empresa.clienteId === 404) throw (o && o.crearError ? o.crearError("El cliente seleccionado ya no existe.") : new Error("no existe")); return { id: empresa.clienteId || 3, nombre: "X", codigo: "X" }; } };
  return origLoad.call(this, req, ...a);
};
process.env.RECURSOS_STORAGE_CONNECTION = "x";

const enviar = require("./enviarDiagnostico");
const cola = require("./src/diagnostico-cola");
const getContador = require("./getContadorDiagnosticoAdmin");
const descartarFn = require("./descartarDiagnosticoPendiente");
const eliminarFn = require("./eliminarRespuestaDiagnostico");
const importarFn = require("./importarDiagnosticosPendientes");

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };
const ctx = () => ({ log: { error() {}, warn() {} }, res: null });
const llamar = async (fn, req) => { const c = ctx(); await fn(c, req || {}); return c.res; };
const enCola = () => (tablas.DiagnosticoPendientes ? [...tablas.DiagnosticoPendientes.values()].filter((e) => e.partitionKey === "pend").length : 0);
const huellas = () => (tablas.DiagnosticoHuellas ? tablas.DiagnosticoHuellas.size : 0);
const contadorTotal = () => { const e = tablas.DiagnosticoContador && tablas.DiagnosticoContador.get("contador|global"); return e ? e.total : 0; };

// banco de preguntas de Table Storage (opcion_correcta/nivel)
const preg = fakeTable("DiagnosticoPreguntas");
const sembrarBanco = async () => {
  await preg.createEntity({ partitionKey: "excel", rowKey: "q1", nivel: 1, opcion_correcta: "A" });
  await preg.createEntity({ partitionKey: "excel", rowKey: "q2", nivel: 2, opcion_correcta: "C" });
};
const cuerpo = (extra = {}) => ({
  envioId: "env-0001-aaaa", nombre: "Ana Pérez", herramienta: "excel", empresa: { clienteId: 5 }, area: "Finanzas", correo: "ana@acme.com", tiempoRespuestaSeg: 300,
  respuestas: [{ preguntaId: "q1", opcionSeleccionada: "A" }, { preguntaId: "q2", opcionSeleccionada: "B" }, { preguntaId: "fantasma", opcionSeleccionada: "A" }], ...extra,
});
const enviarDiag = (body, ip = "9.9.9.9") => llamar(enviar, { body, headers: { "x-forwarded-for": ip } });

(async () => {
  await sembrarBanco();
  console.log("enviarDiagnostico → cola");

  let r = await enviarDiag(cuerpo());
  check("envío válido: 200 inmediato, 1 en la cola, 1 huella, contador +1", r.status === 200 && r.body.ok === true && enCola() === 1 && huellas() === 1 && contadorTotal() === 1);
  const codigoEnviar = require("fs").readFileSync(require.resolve("./enviarDiagnostico"), "utf8").split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join(" ");
  check("NUNCA toca SQL al enviar (ni getPool ni backoffice-db en su código)", sqlLog.tocado === 0 && !/backoffice-db|getPool/.test(codigoEnviar));
  const fila = [...tablas.DiagnosticoPendientes.values()][0];
  const datos = JSON.parse(fila.datos);
  check("califica al encolar con el banco de ese momento (q1 correcta, q2 no) y omite la pregunta inexistente", datos.detalles.length === 2 && datos.detalles[0].fue === true && datos.detalles[1].fue === false && datos.detalles[1].nivel === 2);
  check("la fila guarda quién es (para la tarjeta) y dónde está su huella", fila.nombre === "Ana Pérez" && fila.huellaPk === "c5|excel" && fila.herramienta === "excel");

  r = await enviarDiag(cuerpo());
  check("mismo envío reintentado por el navegador: 200 duplicada, sin otra fila ni otro conteo", r.status === 200 && r.body.duplicada === true && enCola() === 1 && contadorTotal() === 1);

  r = await enviarDiag(cuerpo({ envioId: "env-0002-bbbb" }));
  check("la misma persona otra vez (otro envío): 409 con mensaje claro", r.status === 409 && /Ya recibimos/.test(r.body.error) && enCola() === 1);
  r = await enviarDiag(cuerpo({ envioId: "env-0003-cccc", nombre: "  ANA   PEREZ " }));
  check("mayúsculas, acentos y espacios no engañan: sigue siendo la misma persona", r.status === 409);

  r = await enviarDiag(cuerpo({ envioId: "env-0004-dddd", nombre: "Luis Gómez" }), "9.9.9.9");
  check("OTRA persona desde la misma IP/dispositivo: 200 (no se limita por IP)", r.status === 200 && enCola() === 2);
  r = await enviarDiag(cuerpo({ envioId: "env-0005-eeee", empresa: { clienteId: 6 } }), "9.9.9.9");
  check("mismo nombre en OTRA empresa: 200 (son personas distintas)", r.status === 200 && enCola() === 3);
  r = await enviarDiag(cuerpo({ envioId: "env-0006-ffff", herramienta: "powerbi", respuestas: [{ preguntaId: "q1", opcionSeleccionada: "A" }] }));
  check("mismo nombre en OTRA herramienta sin banco: 400 'preguntas cambiaron' (no queda huella huérfana)", r.status === 400 && enCola() === 3);

  // huella caducada
  const hk = [...tablas.DiagnosticoHuellas.values()].find((e) => e.partitionKey === "c5|excel");
  hk.en = new Date(Date.now() - 31 * 86400000).toISOString();
  r = await enviarDiag(cuerpo({ envioId: "env-0007-gggg" }));
  check("la huella caduca a los 30 días: puede repetir el diagnóstico", r.status === 200 && enCola() === 4);

  // falla de la cola: libera la huella y el reintento (mismo id) sí entra
  fallas.cola = 1;
  r = await enviarDiag(cuerpo({ envioId: "env-0008-hhhh", nombre: "Marta Ruiz" }));
  check("si falla la cola: 500 y NO queda a la persona bloqueada", r.status === 500 && enCola() === 4);
  r = await enviarDiag(cuerpo({ envioId: "env-0008-hhhh", nombre: "Marta Ruiz" }));
  check("el reintento del navegador entra", r.status === 200 && enCola() === 5);

  // validaciones
  check("sin nombre: 400", (await enviarDiag(cuerpo({ nombre: "" }))).status === 400);
  check("herramienta inválida: 400", (await enviarDiag(cuerpo({ herramienta: "word" }))).status === 400);
  check("sin respuestas: 400", (await enviarDiag(cuerpo({ respuestas: [] }))).status === 400);
  check("correo mal escrito: 400", (await enviarDiag(cuerpo({ correo: "no-es-correo" }))).status === 400);
  check("sin empresa: 400", (await enviarDiag(cuerpo({ empresa: {} }))).status === 400);
  check("empresa tecleada (link genérico): se acepta con nombre y código", (await enviarDiag(cuerpo({ envioId: "env-0009-iiii", nombre: "Pedro", empresa: { nombre: "Femsa SA", codigo: "FEMSA" } }))).status === 200);
  check("tras todo eso, SQL sigue sin tocarse", sqlLog.tocado === 0);

  // ── resumen para la tarjeta ──
  console.log("tarjeta de pendientes");
  const resumen = await cola.resumenPendientes(cola.getColaTable());
  check("cuenta pendientes por herramienta", resumen.total === 6 && resumen.excel === 6 && resumen.errores === 0 && resumen.lista.length === 0);

  // ── importación ──
  console.log("importación a SQL");
  const insertados = [];
  const insertarOk = async (id, d, recibido) => { insertados.push({ id, nombre: d.nombre, recibido }); };
  let res = await cola.importarPendientes(cola.getColaTable(), insertarOk, ctx());
  check("importa todo y vacía la cola", res.importadas === 6 && res.restantes === 0 && enCola() === 0 && insertados.length === 6);
  check("conserva la fecha en que contestó la persona", insertados.every((x) => x.recibido instanceof Date && !isNaN(x.recibido)));
  check("importar NO cambia el contador (ya contó al encolar)", contadorTotal() === 6);
  check("las huellas siguen (la persona no puede repetir aunque ya esté en SQL)", huellas() >= 5);

  // errores: se quedan visibles, se reintentan al final y no frenan a las demás
  await enviarDiag(cuerpo({ envioId: "env-1001-aaaa", nombre: "Falla Uno", empresa: { clienteId: 404 } }));
  await enviarDiag(cuerpo({ envioId: "env-1002-bbbb", nombre: "Bien Dos", empresa: { clienteId: 8 } }));
  const insertarMixto = async (id, d) => { if (d.empresa.clienteId === 404) { const e = new Error("El cliente seleccionado ya no existe."); e.safe = true; throw e; } insertados.push({ id, nombre: d.nombre }); };
  res = await cola.importarPendientes(cola.getColaTable(), insertarMixto, ctx());
  check("un error no frena a los demás: pasa 1, la atorada se queda", res.importadas === 1 && res.errores === 1 && res.restantes === 1 && enCola() === 1);
  const atorada = [...tablas.DiagnosticoPendientes.values()][0];
  check("la atorada guarda el motivo y cuenta el intento", atorada.ultimoError === "El cliente seleccionado ya no existe." && atorada.intentos === 1);
  let rs = await cola.resumenPendientes(cola.getColaTable());
  check("la tarjeta ve 1 con error y su detalle", rs.total === 1 && rs.errores === 1 && rs.lista[0].nombre === "Falla Uno" && rs.lista[0].error.includes("ya no existe"));

  // las atoradas van al final y respetan el tope
  await enviarDiag(cuerpo({ envioId: "env-1003-cccc", nombre: "Nueva Tres", empresa: { clienteId: 9 } }));
  const orden = [];
  await cola.importarPendientes(cola.getColaTable(), async (id, d) => { orden.push(d.nombre); }, ctx(), { max: 1 });
  check("con tope de 1, primero entra la NUEVA y no la atorada", orden.length === 1 && orden[0] === "Nueva Tres");
  res = await cola.importarPendientes(cola.getColaTable(), insertarOk, ctx(), { max: 1 });
  check("con tope: devuelve cuántas quedan para que el admin vuelva a llamar", res.restantes === 0 && res.importadas === 1);

  // una sola corrida a la vez
  await enviarDiag(cuerpo({ envioId: "env-1004-dddd", nombre: "Conc Cuatro", empresa: { clienteId: 9 } }));
  let corridas = 0;
  const lenta = async () => { corridas++; await new Promise((x) => setTimeout(x, 30)); };
  const [a, b] = await Promise.all([cola.importarPendientes(cola.getColaTable(), lenta, ctx()), cola.importarPendientes(cola.getColaTable(), lenta, ctx())]);
  check("dos llamadas juntas = una sola corrida", corridas === 1 && a === b);

  // nunca lanza
  const rota = { listEntities() { throw new Error("storage caído"); }, createTable: async () => {} };
  let lanzo = false, rr;
  try { rr = await cola.importarPendientes(rota, insertarOk, ctx()); } catch (e) { lanzo = true; }
  check("si Storage falla, no lanza (devuelve ceros)", !lanzo && rr.importadas === 0);

  // tope de tiempo
  await enviarDiag(cuerpo({ envioId: "env-1005-eeee", nombre: "Tiempo Cinco", empresa: { clienteId: 9 } }));
  await enviarDiag(cuerpo({ envioId: "env-1006-ffff", nombre: "Tiempo Seis", empresa: { clienteId: 9 } }));
  let n = 0;
  res = await cola.importarPendientes(cola.getColaTable(), async () => { n++; await new Promise((x) => setTimeout(x, 15)); }, ctx(), { presupuestoMs: 10 });
  check("respeta el tope de tiempo (para no pasar los 45 s de la Function)", n === 1 && res.restantes >= 1);
  await cola.importarPendientes(cola.getColaTable(), async () => {}, ctx());

  // ── insertarEnSql (SQL simulado) ──
  console.log("insertarEnSql");
  sqlLog.consultas.length = 0; sqlLog.commits = 0; sqlLog.rollbacks = 0;
  const { resolverCliente } = require("./src/cliente-resolver");
  const recibido = new Date("2026-10-10T15:30:00.000Z");
  const unDato = { nombre: "Ana Pérez", herramienta: "excel", empresa: { clienteId: 5 }, area: "Finanzas", correo: null, tiempoRespuestaSeg: 300, detalles: [{ preguntaId: "q1", nivel: 1, opcion: "A", fue: true }, { preguntaId: "q2", nivel: 2, opcion: "B", fue: false }] };
  let ins = await cola.insertarEnSql(fakePool, fakeSql, resolverCliente, "env-x-1234", unDato, recibido);
  const cab = sqlLog.consultas.find((c) => c.texto.includes("INSERT INTO DiagnosticoRespuesta ("));
  const det = sqlLog.consultas.filter((c) => c.texto.includes("INSERT INTO DiagnosticoRespuestaDetalle"));
  check("inserta la cabecera con la fecha en que contestó", ins.id === 7 && ins.duplicada === false && cab.params.recibido === recibido && /fecha_envio/.test(cab.texto));
  check("el detalle va en UN solo INSERT de varias filas", det.length === 1 && (det[0].texto.match(/\(@respuestaId/g) || []).length === 2);
  check("todo en una transacción (commit, sin rollback)", sqlLog.commits === 1 && sqlLog.rollbacks === 0);

  sqlLog.consultas.length = 0; sqlModo.duplicada = true;
  ins = await cola.insertarEnSql(fakePool, fakeSql, resolverCliente, "env-x-1234", unDato, recibido);
  check("si la corrida anterior se cortó tras el COMMIT, no duplica la respuesta", ins.duplicada === true && !sqlLog.consultas.some((c) => c.texto.includes("INSERT INTO")));
  sqlModo.duplicada = false;

  sqlModo.falla = { en: "INSERT INTO DiagnosticoRespuestaDetalle", msg: "se cayó" };
  sqlLog.rollbacks = 0;
  let cayo = false;
  try { await cola.insertarEnSql(fakePool, fakeSql, resolverCliente, "env-x-5678", unDato, recibido); } catch (e) { cayo = e.message === "se cayó"; }
  check("si falla el detalle: rollback y error (la fila se queda en la cola)", cayo && sqlLog.rollbacks === 1);
  sqlModo.falla = null;

  // la Function de importación (con la base simulada)
  await enviarDiag(cuerpo({ envioId: "env-2001-aaaa", nombre: "Via Function", empresa: { clienteId: 8 } }));
  let f = await llamar(importarFn);
  check("importarDiagnosticosPendientes: 200 con importadas/restantes", f.status === 200 && f.body.importadas === 1 && f.body.restantes === 0 && enCola() === 0);

  // ── descartar ──
  console.log("descartar");
  await enviarDiag(cuerpo({ envioId: "env-3001-aaaa", nombre: "Para Descartar", empresa: { clienteId: 404 } }));
  const totalAntes = contadorTotal();
  f = await llamar(descartarFn, { body: { id: "env-3001-aaaa" } });
  check("descarta: borra la fila, resta 1 del contador y libera la huella", f.status === 200 && enCola() === 0 && contadorTotal() === totalAntes - 1 && !tablas.DiagnosticoHuellas.has("c404|excel|" + cola.huellaDe({ clienteId: 404 }, "excel", "Para Descartar").rk));
  r = await enviarDiag(cuerpo({ envioId: "env-3002-bbbb", nombre: "Para Descartar", empresa: { clienteId: 404 } }));
  check("tras descartar, esa persona puede volver a enviar", r.status === 200);
  await cola.importarPendientes(cola.getColaTable(), async () => {}, ctx());
  check("descartar algo que ya no está: 404", (await llamar(descartarFn, { body: { id: "env-3001-aaaa" } })).status === 404);
  check("descartar con id inválido: 400", (await llamar(descartarFn, { body: { id: "x" } })).status === 400);

  // ── contador ──
  console.log("contador del admin");
  await enviarDiag(cuerpo({ envioId: "env-4001-aaaa", nombre: "Pend Uno", empresa: { clienteId: 8 } }));
  await enviarDiag(cuerpo({ envioId: "env-4002-bbbb", nombre: "Pend Dos", empresa: { clienteId: 8 } }));
  f = await llamar(getContador, { query: {} });
  check("el contador devuelve los pendientes (para la tarjeta)", f.status === 200 && f.body.pendientes && f.body.pendientes.total === 2 && f.body.pendientes.excel === 2);
  sqlLog.tocado = 0;
  f = await llamar(getContador, { query: {} });
  check("consultar el contador NO toca SQL", sqlLog.tocado === 0);
  f = await llamar(getContador, { query: { recalcular: "1" } });
  check("'Recalcular' = lo que hay en SQL + lo que espera en la cola", f.body.total === 4 + 2 && f.body.excel === 3 + 2 && f.body.powerbi === 1);

  // ── eliminar una respuesta libera la huella ──
  console.log("eliminar respuesta");
  const h1 = cola.huellaDe({ clienteId: 5 }, "excel", "Ana Pérez");
  await cola.registrarHuella(cola.getHuellasTable(), h1, "env-zzzz-9999");
  sqlModo.eliminar = { herramienta: "excel", nombre: "Ana Pérez", cliente_id: 5, codigo: "ACME" };
  f = await llamar(eliminarFn, { body: { id: 7 } });
  check("eliminar la respuesta: 200 y la persona puede volver a contestar", f.status === 200 && !tablas.DiagnosticoHuellas.has(h1.pk + "|" + h1.rk));

  if (fallos) { console.log("\n" + fallos + " prueba(s) fallaron"); process.exit(1); }
  console.log("\ntest-diagnostico-cola: ok");
})().catch((e) => { console.error(e); process.exit(1); });
