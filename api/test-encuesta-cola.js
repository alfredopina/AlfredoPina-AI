// test-encuesta-cola.js — la Encuesta ya NO escribe en SQL al contestarse: queda en una COLA (Table Storage) y se importa cuando
// Alfredo abre el panel (2026-10-13), mismo esquema que el Diagnóstico. Sin red: tablas en memoria y un SQL simulado.
// Cubre: enviarRespuesta (valida, copia el snapshot del link, link cerrado/inválido, idempotente, anónimo sin dedupe, contadores,
// nunca toca SQL), importación (snapshot, empresa del link genérico validada al importar, duplicado ya importado, errores
// visibles, tope), descartar (resta contadores) y el contador del admin con los pendientes.
const Module = require("module");

const tablas = {}; // nombre -> Map(pk|rk -> entidad)
let etag = 0;
function fakeTable(nombre) {
  const m = tablas[nombre] || (tablas[nombre] = new Map());
  const k = (p, r) => p + "|" + r;
  const err = (c) => { const e = new Error("estado " + c); e.statusCode = c; return e; };
  return {
    createTable: async () => {},
    getEntity: async (p, r) => { const e = m.get(k(p, r)); if (!e) throw err(404); return { ...e }; },
    createEntity: async (e) => { if (m.has(k(e.partitionKey, e.rowKey))) throw err(409); m.set(k(e.partitionKey, e.rowKey), { ...e, etag: String(++etag) }); },
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

// SQL simulado
const sqlLog = { consultas: [], commits: 0, rollbacks: 0, tocado: 0 };
let modo = { dupEnvio: false, falla: null, enSql: 0 };
class FakeRequest {
  constructor() { this.params = {}; }
  input(n, t, v) { this.params[n] = v === undefined ? t : v; return this; }
  async query(texto) {
    sqlLog.consultas.push({ texto, params: { ...this.params } });
    if (modo.falla && texto.includes(modo.falla.en)) { const e = new Error(modo.falla.msg); if (modo.falla.number) e.number = modo.falla.number; throw e; }
    if (texto.includes("INSERT INTO EncuestaRespuesta (")) { if (modo.dupEnvio) { const e = new Error("duplicate key"); e.number = 2601; throw e; } return { recordset: [{ id: ++modo.enSql }] }; }
    if (texto.includes("SELECT id, nombre, codigo FROM Cliente")) return { recordset: this.params.id === 404 ? [] : [{ id: this.params.id, nombre: "Acme", codigo: "ACME" }] };
    return { recordset: [] };
  }
}
class FakeTransaction { async begin() {} async commit() { sqlLog.commits++; } async rollback() { sqlLog.rollbacks++; } }
const fakeSql = { Request: FakeRequest, Transaction: FakeTransaction, NVarChar: "nv", Int: "i", Bit: "b", Date: "d", DateTime2: "dt", Decimal: () => "dec" };
const fakePool = { request: () => new FakeRequest() };

const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "@azure/data-tables") return { TableClient: { fromConnectionString: (_c, nombre) => fakeTable(nombre) } };
  if (/backoffice-db$/.test(req)) return { getPool: async () => { sqlLog.tocado++; return fakePool; }, sql: fakeSql };
  return origLoad.call(this, req, ...a);
};
process.env.RECURSOS_STORAGE_CONNECTION = "x";

const enviar = require("./enviarRespuesta");
const cola = require("./src/encuesta-cola");
const getContador = require("./getContadorRespuestas");
const descartarFn = require("./descartarEncuestaPendiente");
const importarFn = require("./importarEncuestasPendientes");
const { resolverClienteExistente } = require("./src/cliente-resolver");
const { fechaMexico } = require("./src/encuesta-logic");

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };
const ctx = () => ({ log: { error() {}, warn() {} }, res: null });
const llamar = async (fn, req) => { const c = ctx(); await fn(c, req || {}); return c.res; };
const enCola = () => (tablas.EncuestaPendientes ? [...tablas.EncuestaPendientes.values()].filter((e) => e.partitionKey === "pend").length : 0);
const contador = () => { const e = tablas.EncuestaLinks && tablas.EncuestaLinks.get("contador|global"); return e ? e.total : 0; };
const contadorLink = (t) => { const e = tablas.EncuestaLinks && tablas.EncuestaLinks.get("link|" + t); return e ? e.respuestas : null; };

// banco (Table Storage): 2 de escala + el comentario fijo
const banco = fakeTable("EncuestaPreguntas");
const links = fakeTable("EncuestaLinks");
const cuerpo = (extra = {}) => ({ envioId: "env-aaaa-0001", respuestas: [{ preguntaId: "p1", valor: 5 }, { preguntaId: "p2", valor: "4" }, { preguntaId: "comentarios", valor: "  Muy buen curso  " }], nombre: "Ana", correo: "ana@acme.com", token: "tok-abierto", ...extra });
const enviarEnc = (body) => llamar(enviar, { body });

(async () => {
  await banco.createEntity({ partitionKey: "Curso y Materiales", rowKey: "p1", texto: "Materiales claros", tipo: "escala", activa: true, orden: 1 });
  await banco.createEntity({ partitionKey: "Instructor", rowKey: "p2", texto: "Dominio del tema", tipo: "escala", activa: true, orden: 1 });
  await banco.createEntity({ partitionKey: "Globales", rowKey: "comentarios", texto: "¿Algún comentario?", tipo: "texto", activa: true, orden: 1000 });
  await links.createEntity({ partitionKey: "link", rowKey: "tok-abierto", grupoId: "12", clienteId: 5, clienteNombre: "Acme SA", curso: "Excel Intermedio", instructor: "Alfredo Piña", herramientas: "[\"excel\"]", horas: 20, modalidad: "Presencial", abierta: true, generadoEn: "2026-10-01T10:00:00.000Z", respuestas: 0 });
  await links.createEntity({ partitionKey: "link", rowKey: "tok-cerrado", grupoId: "13", clienteId: 5, clienteNombre: "Acme SA", curso: "Power BI", instructor: "Otra Persona", abierta: false, generadoEn: "2026-10-01T10:00:00.000Z", respuestas: 0 });

  console.log("enviarRespuesta → cola");
  let r = await enviarEnc(cuerpo());
  check("envío válido con link por grupo: 200 inmediato y 1 en la cola", r.status === 200 && r.body.ok === true && enCola() === 1);
  check("NUNCA toca SQL al enviar", sqlLog.tocado === 0);
  const fila = [...tablas.EncuestaPendientes.values()][0];
  const datos = JSON.parse(fila.datos);
  check("copia el snapshot del link (cliente, grupo, herramientas, horas…) y no lo que mande el navegador", datos.linkSnap.grupoId === "12" && datos.linkSnap.clienteId === 5 && datos.linkSnap.horas === 20 && datos.curso === "Excel Intermedio" && datos.instructor === "Alfredo Piña");
  check("valida contra el banco y congela texto/categoría/tipo de cada pregunta", datos.detalle.length === 3 && datos.detalle[0].texto === "Materiales claros" && datos.detalle[0].categoria === "Curso y Materiales" && datos.detalle[2].tipo === "texto" && datos.detalle[2].valor === "Muy buen curso");
  check("fija la fecha (día en México) al encolar; sin pedirlo, el permiso de testimonio queda en no", datos.fecha === fechaMexico(new Date()) && datos.autorizaTestimonio === false);
  check("la fila guarda quién es para la tarjeta", fila.nombre === "Ana" && fila.empresaTxt === "Acme SA" && fila.curso === "Excel Intermedio" && fila.token === "tok-abierto");
  check("contadores en vivo: +1 global y +1 del link (cuenta al ENCOLAR)", contador() === 1 && contadorLink("tok-abierto") === 1);

  r = await enviarEnc(cuerpo({ autorizaTestimonio: true }));
  check("mismo envioId reintentado: 200 duplicada, sin otra fila ni otro conteo", r.status === 200 && r.body.duplicada === true && enCola() === 1 && contador() === 1);

  r = await enviarEnc(cuerpo({ envioId: "env-bbbb-0002", autorizaTestimonio: true }));
  check("autorizaTestimonio se respeta solo con nombre + comentario + instructor Alfredo", r.status === 200 && JSON.parse([...tablas.EncuestaPendientes.values()].find((e) => e.rowKey === "env-bbbb-0002").datos).autorizaTestimonio === true);
  r = await enviarEnc(cuerpo({ envioId: "env-cccc-0003", nombre: "", autorizaTestimonio: true }));
  check("sin nombre, el permiso de testimonio se ignora", JSON.parse([...tablas.EncuestaPendientes.values()].find((e) => e.rowKey === "env-cccc-0003").datos).autorizaTestimonio === false);
  r = await enviarEnc(cuerpo({ envioId: "env-dddd-0004", nombre: "Ana", correo: "otro@x.com" }));
  check("la misma persona otra vez: se acepta (encuesta anónima, sin regla de una vez)", r.status === 200 && enCola() === 4);

  r = await enviarEnc(cuerpo({ envioId: "env-eeee-0005", token: "tok-cerrado" }));
  check("link cerrado: 403 y no se encola", r.status === 403 && enCola() === 4);
  r = await enviarEnc(cuerpo({ envioId: "env-ffff-0006", token: "no-existe" }));
  check("link inválido: 404", r.status === 404 && enCola() === 4);
  r = await enviarEnc(cuerpo({ envioId: "env-gggg-0007", respuestas: [{ preguntaId: "p1", valor: 5 }] }));
  check("falta calificar una pregunta: 400", r.status === 400 && enCola() === 4);
  r = await enviarEnc(cuerpo({ envioId: "env-hhhh-0008", respuestas: [{ preguntaId: "p1", valor: 9 }, { preguntaId: "p2", valor: 4 }] }));
  check("valor fuera de 1-5: 400", r.status === 400);
  r = await enviarEnc(cuerpo({ envioId: "env-iiii-0009", respuestas: [{ preguntaId: "fantasma", valor: 5 }] }));
  check("pregunta que no existe: 409 (la encuesta cambió)", r.status === 409);
  r = await enviarEnc(cuerpo({ envioId: "env-jjjj-0010", correo: "mal" }));
  check("correo mal escrito: 400", r.status === 400);

  // link genérico
  const gen = { respuestas: [{ preguntaId: "p1", valor: 3 }, { preguntaId: "p2", valor: 3 }], curso: "Excel", instructor: "Quien sea", empresa: { clienteId: 7, nombre: "Beta" } };
  r = await enviarEnc({ ...gen, envioId: "env-kkkk-0011" });
  check("link genérico con empresa elegida: se encola sin tocar SQL (la empresa se valida al importar)", r.status === 200 && enCola() === 5 && sqlLog.tocado === 0);
  r = await enviarEnc({ ...gen, envioId: "env-llll-0012", empresa: {} });
  check("link genérico sin empresa elegida: 400 con el mensaje de siempre", r.status === 400 && /Selecciona tu empresa/.test(r.body.error));
  r = await enviarEnc({ ...gen, envioId: "env-mmmm-0013", curso: "" });
  check("link genérico sin curso: 400", r.status === 400);
  r = await enviarEnc(cuerpo({ envioId: undefined }));
  check("sin envioId (navegador viejo): el servidor genera uno y encola", r.status === 200 && enCola() === 6);
  check("tras todo eso, SQL sigue sin tocarse", sqlLog.tocado === 0);

  // ── tarjeta ──
  console.log("tarjeta de pendientes");
  let rs = await cola.resumenPendientes(cola.getColaTable());
  check("cuenta los pendientes (ninguno con error todavía)", rs.total === 6 && rs.errores === 0 && rs.lista.length === 0);

  // ── importación ──
  console.log("importación a SQL");
  const insertados = [];
  const insertarOk = async (id, d, recibido) => { insertados.push({ id, d, recibido }); };
  let res = await cola.importarPendientes(cola.getColaTable(), insertarOk, ctx());
  check("importa todo y vacía la cola", res.importadas === 6 && res.restantes === 0 && enCola() === 0);
  check("importar NO vuelve a sumar los contadores", contador() === 6);

  // insertarEnSql con el SQL simulado
  sqlLog.consultas.length = 0; sqlLog.commits = 0; sqlLog.rollbacks = 0;
  const recibido = new Date("2026-10-10T15:30:00.000Z");
  let ins = await cola.insertarEnSql(fakePool, fakeSql, resolverClienteExistente, "env-sql-0001", datos, recibido);
  const cab = sqlLog.consultas.find((c) => c.texto.includes("INSERT INTO EncuestaRespuesta ("));
  const det = sqlLog.consultas.filter((c) => c.texto.includes("INSERT INTO EncuestaRespuestaDetalle"));
  check("link por grupo: inserta con cliente/grupo/fecha del snapshot y la llave envio_id", ins.duplicada === false && cab.params.clienteId === 5 && cab.params.grupoId === 12 && cab.params.envioId === "env-sql-0001" && cab.params.fecha instanceof Date && !isNaN(cab.params.fecha));
  check("una fila de detalle por pregunta y todo en una transacción", det.length === 3 && sqlLog.commits === 1 && sqlLog.rollbacks === 0);

  sqlLog.consultas.length = 0;
  const datosGen = { ...datos, token: null, linkSnap: null, empresa: { clienteId: 7, nombre: "Beta" }, curso: "Excel", instructor: "X" };
  ins = await cola.insertarEnSql(fakePool, fakeSql, resolverClienteExistente, "env-sql-0002", datosGen, recibido);
  const cab2 = sqlLog.consultas.find((c) => c.texto.includes("INSERT INTO EncuestaRespuesta ("));
  check("link genérico: valida la empresa al importar y guarda sin grupo", cab2.params.clienteId === 7 && cab2.params.grupoId === null && cab2.params.herramientas === null);
  let cayo = null;
  try { await cola.insertarEnSql(fakePool, fakeSql, resolverClienteExistente, "env-sql-0003", { ...datosGen, empresa: { clienteId: 404 } }, recibido); } catch (e) { cayo = e; }
  check("link genérico con empresa que ya no existe: error seguro (la fila queda atorada y visible)", cayo && cayo.safe === true && /ya no existe/.test(cayo.message));

  modo.dupEnvio = true; sqlLog.rollbacks = 0;
  ins = await cola.insertarEnSql(fakePool, fakeSql, resolverClienteExistente, "env-sql-0001", datos, recibido);
  check("si ese envío ya se había importado (índice único de envio_id): duplicada, sin error", ins.duplicada === true && sqlLog.rollbacks === 1);
  modo.dupEnvio = false;
  modo.falla = { en: "INSERT INTO EncuestaRespuestaDetalle", msg: "se cayó" };
  sqlLog.rollbacks = 0; cayo = null;
  try { await cola.insertarEnSql(fakePool, fakeSql, resolverClienteExistente, "env-sql-0004", datos, recibido); } catch (e) { cayo = e; }
  check("si falla el detalle: rollback y error (la fila se queda en la cola)", cayo && cayo.message === "se cayó" && sqlLog.rollbacks === 1);
  modo.falla = null;

  // errores visibles, las atoradas al final y tope
  await enviarEnc(cuerpo({ envioId: "env-1001-aaaa", token: undefined, ...gen, empresa: { clienteId: 404, nombre: "Fantasma" } }));
  await enviarEnc(cuerpo({ envioId: "env-1002-bbbb" }));
  const insertarMixto = async (id, d) => { if (d.empresa && d.empresa.clienteId === 404) { const e = new Error("El cliente seleccionado ya no existe."); e.safe = true; throw e; } insertados.push({ id }); };
  res = await cola.importarPendientes(cola.getColaTable(), insertarMixto, ctx());
  check("un error no frena a los demás: pasa 1, la atorada se queda con su motivo", res.importadas === 1 && res.errores === 1 && res.restantes === 1 && enCola() === 1);
  rs = await cola.resumenPendientes(cola.getColaTable());
  check("la tarjeta ve 1 con error, con empresa, curso y motivo", rs.total === 1 && rs.errores === 1 && rs.lista[0].empresa === "Fantasma" && rs.lista[0].curso === "Excel" && /ya no existe/.test(rs.lista[0].error));
  await enviarEnc(cuerpo({ envioId: "env-1003-cccc" }));
  const orden = [];
  await cola.importarPendientes(cola.getColaTable(), async (id) => { orden.push(id); }, ctx(), { max: 1 });
  check("con tope de 1, primero entra la NUEVA y no la atorada", orden.length === 1 && orden[0] === "env-1003-cccc");

  // la Function de importación (con la base simulada)
  await enviarEnc(cuerpo({ envioId: "env-2001-aaaa" }));
  await tablas.EncuestaPendientes.delete("pend|env-1001-aaaa"); // quita la atorada para que la Function importe limpio
  let f = await llamar(importarFn);
  check("importarEncuestasPendientes: 200 con importadas/restantes y la cola vacía", f.status === 200 && f.body.importadas === 1 && f.body.restantes === 0 && enCola() === 0);

  // ── descartar ──
  console.log("descartar");
  await enviarEnc(cuerpo({ envioId: "env-3001-aaaa" }));
  const antes = contador(), antesLink = contadorLink("tok-abierto");
  f = await llamar(descartarFn, { body: { id: "env-3001-aaaa" } });
  check("descarta: borra la fila y resta de los contadores (global y del link)", f.status === 200 && enCola() === 0 && contador() === antes - 1 && contadorLink("tok-abierto") === antesLink - 1);
  check("descartar algo que ya no está: 404", (await llamar(descartarFn, { body: { id: "env-3001-aaaa" } })).status === 404);
  check("descartar con id inválido: 400", (await llamar(descartarFn, { body: { id: "x" } })).status === 400);

  // ── contador del admin ──
  console.log("contador del admin");
  await enviarEnc(cuerpo({ envioId: "env-4001-aaaa" }));
  await enviarEnc(cuerpo({ envioId: "env-4002-bbbb" }));
  sqlLog.tocado = 0;
  f = await llamar(getContador, { query: {} });
  check("el contador devuelve total, hoy y los pendientes (para la tarjeta)", f.status === 200 && f.body.pendientes && f.body.pendientes.total === 2 && typeof f.body.total === "number" && typeof f.body.hoy === "number");
  check("consultar el contador NO toca SQL", sqlLog.tocado === 0);

  if (fallos) { console.log("\n" + fallos + " prueba(s) fallaron"); process.exit(1); }
  console.log("\ntest-encuesta-cola: ok");
})().catch((e) => { console.error(e); process.exit(1); });
