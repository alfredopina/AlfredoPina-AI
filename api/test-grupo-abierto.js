// test-grupo-abierto.js — Cursos Abiertos, lado ADMIN (2026-11-02): alta/edición del Grupo abierto, listado y «Publicar calendario».
// Sin red: SQL simulado (registra cada consulta y responde según su texto) y Table Storage en memoria con ETag.
// Cubre: validación de lo que captura Alfredo, el alta en UNA transacción (Grupo + sesiones + historial; sin cuenta por cobrar), duplicados y rollback,
// reglas de edición (cupo, cancelado), y publicar: foto desde SQL, todo-o-nada, contador conciliado con SQL + lo que sigue en la cola, nada de SQL en lo público.
const Module = require("module");
const assert = require("assert");
const fs = require("fs");

// ── Table Storage en memoria (ETag/412 como el real) ──
const tablas = {};
let etag = 0;
function fakeTable(nombre) {
  const m = tablas[nombre] || (tablas[nombre] = new Map());
  const k = (p, r) => p + "|" + r;
  const err = (c) => { const e = new Error("estado " + c); e.statusCode = c; return e; };
  return {
    createTable: async () => {},
    getEntity: async (p, r) => { const e = m.get(k(p, r)); if (!e) throw err(404); return { ...e }; },
    createEntity: async (e) => { if (m.has(k(e.partitionKey, e.rowKey))) throw err(409); m.set(k(e.partitionKey, e.rowKey), { ...e, etag: String(++etag) }); },
    updateEntity: async (e, modo, opts) => { const cur = m.get(k(e.partitionKey, e.rowKey)); if (!cur) throw err(404); if (opts && opts.etag && opts.etag !== cur.etag) throw err(412); m.set(k(e.partitionKey, e.rowKey), { ...cur, ...e, etag: String(++etag) }); },
    upsertEntity: async (e, modo) => { const cur = m.get(k(e.partitionKey, e.rowKey)); m.set(k(e.partitionKey, e.rowKey), { ...(modo === "Merge" ? cur : {}), ...e, etag: String(++etag) }); },
    deleteEntity: async (p, r) => { if (!m.delete(k(p, r))) throw err(404); },
    listEntities: (o) => {
      const f = o && o.queryOptions && o.queryOptions.filter; const mm = f && /PartitionKey eq '([^']+)'/.exec(f);
      return (async function* () { for (const e of [...m.values()]) if (!mm || e.partitionKey === mm[1]) yield { ...e }; })();
    },
  };
}

// ── SQL simulado ──
const log = { consultas: [], commits: 0, rollbacks: 0 };
const modo = { sinCliente: false, duplicado: false, fallaSesion: false, actual: { publicacion: "borrador", ocupados: 0 }, noExiste: false, grupos: [], sesiones: [] };
class FakeRequest {
  constructor() { this.params = {}; }
  input(n, t, v) { this.params[n] = v === undefined ? t : v; return this; }
  async query(texto) {
    log.consultas.push({ texto, params: { ...this.params } });
    if (texto.includes("FROM Cliente WHERE codigo = 'ABIERTOS'")) return { recordset: modo.sinCliente ? [] : [{ id: 77 }] };
    if (texto.includes("INSERT INTO GrupoSesion") && modo.fallaSesion) throw new Error("fallo sesión");
    if (/^INSERT INTO Grupo\s/.test(texto)) { if (modo.duplicado) { const e = new Error("dup"); e.number = 2601; throw e; } return { recordset: [{ id: 501 }] }; }
    if (texto.includes("FROM Grupo g WHERE g.id = @id AND g.estrategia = 'abiertos'")) return { recordset: modo.noExiste ? [] : [modo.actual] };
    if (texto.startsWith("UPDATE Grupo SET modalidad")) return { recordset: [], rowsAffected: [1] };
    if (texto.includes("FROM Grupo g WHERE g.estrategia = 'abiertos' AND g.publicacion = 'publicado'")) return { recordset: modo.grupos };
    if (texto.includes("FROM GrupoSesion s JOIN Grupo g")) return { recordset: modo.sesiones };
    if (texto.includes("FROM ListaEspera")) return { recordset: [{ interes: "ia", n: 2 }] };
    return { recordset: [], rowsAffected: [1] };
  }
}
class FakeTransaction { async begin() {} async commit() { log.commits++; } async rollback() { log.rollbacks++; } }
const fakeSql = { Request: FakeRequest, Transaction: FakeTransaction, NVarChar: "nv", Int: "i", Date: "d", DateTime2: "dt2", DateTimeOffset: "dto", Decimal: () => "dec" };
const fakePool = { request: () => new FakeRequest() };

const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "@azure/data-tables") return { TableClient: { fromConnectionString: (_c, nombre) => fakeTable(nombre) } };
  if (/backoffice-db$/.test(req)) return { getPool: async () => fakePool, sql: fakeSql };
  return origLoad.call(this, req, ...a);
};
process.env.RECURSOS_STORAGE_CONNECTION = "x";

const ga = require("./src/grupo-abierto");
const cal = require("./src/calendario-abiertos");
const colas = require("./src/cursos-abiertos-cola");
const crear = require("./crearGrupoAbierto");
const editar = require("./editarGrupoAbierto");
const listar = require("./getGruposAbiertosAdmin");
const publicar = require("./publicarCalendarioAbiertos");

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };
const ctx = () => ({ log: { error() {}, warn() {} }, res: null });
const llamar = async (fn, req) => { const c = ctx(); await fn(c, req || {}); return c.res; };
const reiniciar = () => { log.consultas.length = 0; log.commits = 0; log.rollbacks = 0; Object.assign(modo, { sinCliente: false, duplicado: false, fallaSesion: false, noExiste: false, actual: { publicacion: "borrador", ocupados: 0 } }); };
const hubo = (re) => log.consultas.some((c) => re.test(c.texto));

const DIA = 86400000;
const ses = (dias) => { const i = Date.now() + dias * DIA; return { inicio: new Date(i).toISOString(), fin: new Date(i + 3 * 3600000).toISOString() }; };
const cuerpo = (extra = {}) => ({
  codigo: "ia-1207", herramienta: "ia", nivel: 1, programa_nombre: "IA aplicada", programa_id: "p-ia-b", modalidad: "en_linea", horas: 12,
  sesiones: [ses(42), ses(40)], cupo_total: 14, minimo_para_abrir: 6, precio_persona: 3000, precio_preventa: 2500, preventa_hasta: new Date(Date.now() + 20 * DIA).toISOString().slice(0, 10),
  publicacion: "borrador", resumen: "r", temario_corto: ["a", "b"], ...extra,
});
const lanza = (body) => { try { ga.validarGrupoAbierto(body); return null; } catch (e) { return e; } };

(async () => {
  console.log("validarGrupoAbierto");
  const d = ga.validarGrupoAbierto(cuerpo());
  check("normaliza el código a mayúsculas y ordena las sesiones por fecha", d.codigo === "IA-1207" && d.sesiones[0].inicio < d.sesiones[1].inicio);
  check("un grupo en línea no lleva sede", d.sede === null && d.modalidad === "en_linea");
  const casos = [
    ["código inválido", { codigo: "a" }], ["herramienta inválida", { herramienta: "word" }], ["nivel inválido", { nivel: 9 }], ["sin nombre de programa", { programa_nombre: "" }],
    ["modalidad inválida", { modalidad: "mixta" }], ["presencial sin sede", { modalidad: "presencial", sede: "" }], ["horas inválidas", { horas: 0 }],
    ["sesión con fin antes del inicio", { sesiones: [{ inicio: ses(5).fin, fin: ses(5).inicio }] }], ["cupo 0", { cupo_total: 0 }], ["mínimo mayor al cupo", { minimo_para_abrir: 20 }],
    ["precio negativo", { precio_persona: -1 }], ["preventa mayor al precio", { precio_preventa: 4000 }], ["preventa sin fecha límite", { preventa_hasta: "" }],
    ["publicación inválida", { publicacion: "oculto" }], ["publicar sin sesiones ni mes", { sesiones: [], publicacion: "publicado" }], ["mes estimado inválido", { sesiones: [], mes_estimado: "feb" }],
  ];
  for (const [nombre, extra] of casos) { const e = lanza(cuerpo(extra)); check(nombre + " → error con mensaje para mostrar", e && e.safe === true && e.message.length > 5); }
  check("sin sesiones pero con mes estimado: se puede publicar (saldrá «Próximamente»)", !lanza(cuerpo({ sesiones: [], mes_estimado: "2027-02", publicacion: "publicado" })));
  check("presencial con sede: ok y guarda la sede", ga.validarGrupoAbierto(cuerpo({ modalidad: "presencial", sede: "Monterrey" })).sede === "Monterrey");
  check("fecha del grupo = día LOCAL de Monterrey (una sesión a las 23:30 locales no cae en el día siguiente)", ga.diaLocal("2027-01-17T05:30:00Z") === "2027-01-16");

  console.log("crearGrupoAbierto");
  reiniciar();
  let r = await llamar(crear, { body: cuerpo({ publicacion: "publicado" }) });
  check("alta válida: 200 con id y código", r.status === 200 && r.body.id === 501 && r.body.codigo === "IA-1207");
  const ins = log.consultas.find((c) => /INSERT INTO Grupo\b/.test(c.texto));
  check("el Grupo nace con estrategia 'abiertos', del cliente reservado y 'Por iniciar'", /'abiertos'/.test(ins.texto) && ins.params.clienteId === 77 && /'Por iniciar'/.test(ins.texto));
  check("guarda herramienta/nivel como JSON y la modalidad en el formato de Grupos (Online)", ins.params.herramientas === '["ia"]' && ins.params.niveles === "[1]" && ins.params.modalidad === "Online");
  check("guarda las 2 sesiones y siembra el historial de fase", log.consultas.filter((c) => /INSERT INTO GrupoSesion/.test(c.texto)).length === 2 && hubo(/GrupoFaseHistorial/));
  check("una sola transacción confirmada, sin rollback", log.commits === 1 && log.rollbacks === 0);
  check("NO crea cuenta por cobrar (cada inscripción tendrá la suya)", !hubo(/CuentaPorCobrar/));
  reiniciar(); modo.duplicado = true;
  r = await llamar(crear, { body: cuerpo() });
  check("código repetido → 409 y rollback", r.status === 409 && log.rollbacks === 1 && log.commits === 0);
  reiniciar(); modo.fallaSesion = true;
  r = await llamar(crear, { body: cuerpo() });
  check("si falla guardar una sesión: 500, rollback y nada confirmado", r.status === 500 && log.rollbacks === 1 && log.commits === 0);
  reiniciar(); modo.sinCliente = true;
  r = await llamar(crear, { body: cuerpo() });
  check("sin el cliente reservado (no se corrió el SQL 048): 400 que dice qué hacer", r.status === 400 && /048/.test(r.body.error) && log.commits === 0);
  reiniciar();
  r = await llamar(crear, { body: cuerpo({ cupo_total: 0 }) });
  check("datos inválidos: 400 sin tocar SQL", r.status === 400 && log.consultas.length === 0);

  console.log("editarGrupoAbierto");
  reiniciar();
  r = await llamar(editar, { body: cuerpo({ id: 501 }) });
  check("edición válida: 200, UPDATE solo de abiertos y sesiones reemplazadas", r.status === 200 && hubo(/UPDATE Grupo SET modalidad[\s\S]*estrategia = 'abiertos'/) && hubo(/DELETE FROM GrupoSesion/) && log.commits === 1);
  check("al guardar un grupo publicado vuelve a «cambios sin publicar» (publicado_en = NULL); uno que deja de estar publicado conserva su fecha", hubo(/publicado_en = CASE WHEN @publicacion = .publicado. THEN NULL ELSE publicado_en END/));
  r = await llamar(editar, { body: cuerpo() });
  check("sin id → 400", r.status === 400);
  reiniciar(); modo.noExiste = true;
  r = await llamar(editar, { body: cuerpo({ id: 9 }) });
  check("grupo inexistente o de In Company → 404", r.status === 404 && log.commits === 0);
  reiniciar(); modo.actual = { publicacion: "borrador", ocupados: 8 };
  r = await llamar(editar, { body: cuerpo({ id: 501, cupo_total: 7, minimo_para_abrir: 3 }) });
  check("el cupo no puede quedar debajo de los ya inscritos → 409", r.status === 409 && /8/.test(r.body.error) && log.commits === 0);
  reiniciar(); modo.actual = { publicacion: "cancelado", ocupados: 0 };
  r = await llamar(editar, { body: cuerpo({ id: 501, publicacion: "publicado" }) });
  check("un grupo cancelado no se reabre → 409", r.status === 409 && log.commits === 0);

  console.log("armarFoto (de SQL a la foto pública)");
  const fila = (extra = {}) => ({ id: 1, grupo_codigo: "IA-1207", programa_id: "p", nombre_curso: "IA aplicada", herramientas: '["ia"]', niveles: "[2]", modalidad: "Online", sede: null, horas: 12, cupo_total: 14, minimo_para_abrir: 6, precio_persona: 3000, precio_preventa: null, preventa_hasta: null, mes_estimado: null, resumen_publico: "r", temario_corto: '["a","b"]', confirmadas: 7, apartadas: 2, ...extra });
  const f = ga.armarFoto([fila(), fila({ id: 2, grupo_codigo: "XL-1", herramientas: '["excel"]', modalidad: "Presencial", sede: "MTY", mes_estimado: "2027-02" }), fila({ id: 3, grupo_codigo: "OLD-1" })],
    [{ grupo_id: 1, inicio: ses(42).inicio, fin: ses(42).fin }, { grupo_id: 1, inicio: ses(40).inicio, fin: ses(40).fin }, { grupo_id: 3, inicio: ses(-2).inicio, fin: ses(-2).fin }], null, { ejemplo: true });
  check("deja fuera el grupo que ya empezó y conserva el que no tiene sesiones (próximamente)", f.grupos.map((x) => x.codigo).join() === "IA-1207,XL-1");
  check("traduce nivel y modalidad al formato público y ordena sesiones", f.grupos[0].nivel === "Intermedio" && f.grupos[1].modalidad === "presencial" && f.grupos[0].sesiones[0].inicio < f.grupos[0].sesiones[1].inicio);
  check("la foto armada pasa la lista blanca sin errores", cal.limpiarFoto(f).errores.length === 0 && cal.limpiarFoto(f).foto.grupos.length === 2);
  check("lugaresEnCola suma por grupo", JSON.stringify(ga.lugaresEnCola([{ grupo: "A", lugares: 2 }, { grupo: "A", lugares: 1 }, { grupo: "B", lugares: 3 }, {}])) === '{"A":3,"B":3}');

  console.log("publicarCalendarioAbiertos");
  reiniciar();
  modo.grupos = [fila()];
  modo.sesiones = [{ grupo_id: 1, inicio: ses(42).inicio, fin: ses(42).fin }];
  const colaT = colas.inscripciones.getTable();
  await colas.inscripciones.encolar(colaT, "envio-0001-aaaa", { datos: "{}", grupo: "IA-1207", nombre: "X", lugares: 2 });
  await colas.inscripciones.encolar(colaT, "envio-0002-bbbb", { datos: "{}", grupo: "IA-1207", nombre: "Y", lugares: 1 });
  r = await llamar(publicar, { body: { ejemplo: false } });
  check("publica: 200 con el número de grupos", r.status === 200 && r.body.grupos === 1);
  const cupoE = tablas.CalendarioAbiertos.get("cupo|IA-1207");
  check("el contador queda en confirmadas 7 + apartadas 2 + 3 lugares que siguen en la cola = 12", cupoE.reservados === 12 && cupoE.cupoTotal === 14);
  const publicada = await cal.leerFoto(cal.getTable());
  check("la foto publicada no lleva datos de personas y refleja ejemplo:false", publicada.foto.ejemplo === false && !/@/.test(JSON.stringify(publicada.foto)) && publicada.foto.grupos[0].reservados === 12);
  check("marca publicado_en del grupo", hubo(/UPDATE Grupo SET publicado_en/));
  check("los que ya no están publicados (borrador/cancelado) quedan sin nada pendiente", hubo(/SET publicado_en = NULL WHERE estrategia = .abiertos. AND publicacion <> .publicado./));
  const conservaAjustes = await llamar(publicar, { body: { ajustes: { descuento_equipo: { desde_personas: 2, porcentaje: 10 } } } });
  const pub2 = await cal.leerFoto(cal.getTable());
  check("los ajustes enviados se guardan (descuento de equipo) y el contador no se duplica al republicar", conservaAjustes.status === 200 && pub2.foto.ajustes.descuento_equipo.porcentaje === 10 && tablas.CalendarioAbiertos.get("cupo|IA-1207").reservados === 12);
  const conserva = await llamar(publicar, { body: {} });
  const pub3 = await cal.leerFoto(cal.getTable());
  check("sin ajustes en el cuerpo se conservan los de la foto anterior", conserva.status === 200 && pub3.foto.ajustes.descuento_equipo && pub3.foto.ajustes.descuento_equipo.porcentaje === 10);
  modo.grupos = [fila(), fila({ id: 9, grupo_codigo: "mal codigo" })];
  modo.sesiones = [{ grupo_id: 1, inicio: ses(42).inicio, fin: ses(42).fin }, { grupo_id: 9, inicio: ses(30).inicio, fin: ses(30).fin }];
  const antes = tablas.CalendarioAbiertos.get("calendario|actual").publicadoEn;
  r = await llamar(publicar, { body: {} });
  check("todo o nada: un grupo inválido → 400 con el motivo y la foto anterior queda intacta", r.status === 400 && /MAL CODIGO|código/i.test(JSON.stringify(r.body)) && tablas.CalendarioAbiertos.get("calendario|actual").publicadoEn === antes);

  console.log("getGruposAbiertosAdmin");
  reiniciar();
  modo.grupos = []; // el listado usa su propia consulta (sin filtro de publicación): se prueba la forma, no el contenido
  r = await llamar(listar);
  check("responde 200 con grupos, espera por interés y el conteo de la cola", r.status === 200 && Array.isArray(r.body.grupos) && r.body.espera_por_interes[0].n === 2 && r.body.cola.inscripciones === 2);

  console.log("regla del proyecto: lo público no importa SQL");
  const rutasPublicas = require("./rutas-publicas").map((p) => p.ruta);
  const admin = ["crearGrupoAbierto", "editarGrupoAbierto", "getGruposAbiertosAdmin", "publicarCalendarioAbiertos"];
  check("las 4 Functions del admin NO están en rutas públicas (nacen cerradas)", admin.every((n) => !rutasPublicas.includes(n)));
  const publico = ["./getCalendarioAbiertos", "./reservarCursoAbierto", "./avisarCursoAbierto", "./src/calendario-abiertos", "./src/cursos-abiertos-cola"]
    .map((f) => fs.readFileSync(require.resolve(f), "utf8")).join("\n");
  check("el código público no importa grupo-abierto ni backoffice-db", !/grupo-abierto|backoffice-db/.test(publico.split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join("\n")));

  console.log(fallos ? "\n" + fallos + " FALLA(S)" : "\nTodo OK");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
