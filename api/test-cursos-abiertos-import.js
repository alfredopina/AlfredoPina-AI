// test-cursos-abiertos-import.js — Cursos Abiertos: IMPORTACIÓN de las colas del sitio a SQL (2026-11-03). Sin red: SQL simulado en memoria (con rollback real: se
// restaura una foto de las tablas) y Table Storage en memoria. Cubre: inscripción de una persona que paga ella, de varias que paga una empresa (Cliente nuevo
// Prospecto o el que ya existe por RFC), idempotencia, grupo inexistente, falla a la mitad (todo o nada), lista de espera, la cola completa (un envío malo no
// bloquea a los demás y se queda con su motivo) y las acciones del admin (confirmar, cancelar devolviendo el lugar, descartar un envío atorado).
const Module = require("module");
const fs = require("fs");

// ── Table Storage en memoria ──
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
const nuevoDb = () => ({
  grupos: [{ id: 5, grupo_codigo: "IA-1", nombre_curso: "IA aplicada" }], clientes: [{ id: 77, codigo: "ABIERTOS", nombre: "Cursos Abiertos (público)", rfc: null, razon_social: null, tipo_cliente: "Prospecto" }],
  alumnos: [], inscripciones: [], cuentas: [], espera: [], sig: { cliente: 100, alumno: 200, insc: 300, cuenta: 400 },
});
let db = nuevoDb();
let snapshot = null;
const modo = { fallaCuenta: false };
class FakeRequest {
  constructor() { this.p = {}; }
  input(n, t, v) { this.p[n] = v === undefined ? t : v; return this; }
  async query(t) {
    const p = this.p;
    if (/FROM Grupo WHERE grupo_codigo = @c AND estrategia = 'abiertos'/.test(t)) return { recordset: db.grupos.filter((g) => g.grupo_codigo === p.c) };
    if (/FROM Inscripcion WHERE envio_id = @e/.test(t)) return { recordset: db.inscripciones.filter((i) => i.envio_id === p.e).slice(0, 1).map((i) => ({ id: i.id })) };
    if (/FROM Cliente WHERE codigo = 'ABIERTOS'/.test(t)) return { recordset: [{ id: 77 }] };
    if (/FROM Cliente WHERE rfc = @rfc/.test(t)) return { recordset: db.clientes.filter((c) => c.rfc === p.rfc).slice(0, 1) };
    if (/LOWER\(razon_social\) = LOWER\(@n\)/.test(t)) return { recordset: db.clientes.filter((c) => (c.razon_social || "").toLowerCase() === p.n.toLowerCase() || c.nombre.toLowerCase() === p.n.toLowerCase()).slice(0, 1) };
    if (/FROM Cliente WHERE codigo = @c/.test(t)) return { recordset: db.clientes.filter((c) => c.codigo === p.c) };
    if (/^INSERT INTO Cliente/.test(t)) { const c = { id: ++db.sig.cliente, nombre: p.nombre, codigo: p.codigo, rfc: p.rfc, razon_social: p.nombre, tipo_cliente: "Prospecto" }; db.clientes.push(c); return { recordset: [{ id: c.id }] }; }
    if (/FROM Alumno WHERE cliente_id = @c AND LOWER\(correo\)/.test(t)) return { recordset: db.alumnos.filter((a) => a.cliente_id === p.c && a.correo.toLowerCase() === p.m.toLowerCase()).slice(0, 1).map((a) => ({ id: a.id })) };
    if (/^UPDATE Alumno SET whatsapp/.test(t)) { db.alumnos.find((a) => a.id === p.id).whatsapp = p.w; return { recordset: [] }; }
    if (/^INSERT INTO Alumno/.test(t)) { const a = { id: ++db.sig.alumno, nombre_completo: p.n, cliente_id: p.c, correo: p.m, whatsapp: p.w }; db.alumnos.push(a); return { recordset: [{ id: a.id }] }; }
    if (/^INSERT INTO Inscripcion/.test(t)) { const i = { id: ++db.sig.insc, grupo_id: p.g, alumno_id: p.a, paga: p.paga, requiere_factura: p.rf, rfc: p.rfc, razon_social: p.rz, monto: p.monto, envio_id: p.e, persona_ix: p.ix, utm_source: p.us, estado: "apartada", cuenta_cobrar_id: null }; db.inscripciones.push(i); return { recordset: [{ id: i.id }] }; }
    if (/SELECT tipo_cliente FROM Cliente WHERE id = @id/.test(t)) return { recordset: [{ tipo_cliente: (db.clientes.find((c) => c.id === p.id) || {}).tipo_cliente }] };
    if (/^INSERT INTO CuentaPorCobrar/.test(t)) { if (modo.fallaCuenta) throw new Error("fallo al crear la cuenta"); const c = { id: ++db.sig.cuenta, ...p }; db.cuentas.push(c); return { recordset: [{ id: c.id }] }; }
    if (/^UPDATE Inscripcion SET cuenta_cobrar_id/.test(t)) { db.inscripciones.filter((i) => i.envio_id === p.e).forEach((i) => { i.cuenta_cobrar_id = p.c; }); return { recordset: [] }; }
    if (/FROM ListaEspera WHERE envio_id = @e/.test(t)) return { recordset: db.espera.filter((e) => e.envio_id === p.e).slice(0, 1).map((e) => ({ id: 1 })) };
    if (/^INSERT INTO ListaEspera/.test(t)) { db.espera.push({ nombre: p.n, correo: p.m, interes: p.i, paga: p.p, contexto: p.ctx, grupo_referencia: p.gr, envio_id: p.e, utm_source: p.us }); return { recordset: [] }; }
    if (/FROM Inscripcion i JOIN Grupo g/.test(t)) { const i = db.inscripciones.find((x) => x.id === p.id); return { recordset: i ? [{ estado: i.estado, grupo_codigo: "IA-1" }] : [] }; }
    if (/^UPDATE Inscripcion SET estado = 'confirmada'/.test(t)) { const i = db.inscripciones.find((x) => x.id === p.id); i.estado = "confirmada"; i.estado_pago = "pagado"; return { recordset: [] }; }
    if (/^UPDATE Inscripcion SET estado = 'cancelada'/.test(t)) { db.inscripciones.find((x) => x.id === p.id).estado = "cancelada"; return { recordset: [] }; }
    return { recordset: [], rowsAffected: [1] };
  }
}
class FakeTransaction {
  async begin() { snapshot = JSON.stringify(db); }
  async commit() { snapshot = null; }
  async rollback() { if (snapshot) db = JSON.parse(snapshot); snapshot = null; }
}
const fakeSql = { Request: FakeRequest, Transaction: FakeTransaction, NVarChar: "nv", Int: "i", Bit: "b", Date: "d", DateTime2: "dt2", DateTimeOffset: "dto", TinyInt: "t", Decimal: () => "dec" };
const pool = { request: () => new FakeRequest() };

const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "@azure/data-tables") return { TableClient: { fromConnectionString: (_c, nombre) => fakeTable(nombre) } };
  if (/backoffice-db$/.test(req)) return { getPool: async () => pool, sql: fakeSql };
  return origLoad.call(this, req, ...a);
};
process.env.RECURSOS_STORAGE_CONNECTION = "x";

const imp = require("./src/cursos-abiertos-import");
const colas = require("./src/cursos-abiertos-cola");
const cal = require("./src/calendario-abiertos");
const actualizarInsc = require("./actualizarInscripcionAbierta");
const descartar = require("./descartarCursoAbiertoPendiente");

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };
const ctx = () => ({ log: { error() {}, warn() {} }, res: null });
const llamar = async (fn, req) => { const c = ctx(); await fn(c, req || {}); return c.res; };
const envio = (extra = {}) => ({
  tipo: "inscripcion_abierta", grupo: "IA-1", programa_id: "p", personas: [{ nombre: "Ana Uno", correo: "ana@ejemplo.test", whatsapp: "8100000000" }], num_personas: 1, paga: "yo", factura: { requiere: false, rfc: null, razon_social: null },
  monto_estimado: { precio_unitario: 2500, descuento_pct: 0, total: 2500, moneda: "MXN" }, estado_pago: "pendiente", apartado_hasta: new Date(Date.now() + 48 * 3600000).toISOString(),
  origen: { utm_source: "linkedin", utm_medium: "post", utm_campaign: "ia" }, ...extra,
});

(async () => {
  console.log("importarInscripcion — la persona paga");
  let r = await imp.importarInscripcion(pool, "envio-0001-aaaa", envio());
  check("crea 1 alumno ligado al cliente reservado, 1 inscripción apartada y 1 cuenta", db.alumnos.length === 1 && db.alumnos[0].cliente_id === 77 && db.inscripciones.length === 1 && db.inscripciones[0].estado === "apartada" && db.cuentas.length === 1);
  const c = db.cuentas[0];
  check("la cuenta nace Por facturar, estrategia 'abiertos', del grupo y del cliente reservado", c.estatus === "Por facturar" && c.estrategia === "abiertos" && c.grupo_id === 5 && c.cliente_id === 77 && c.origen === "Manual");
  check("el precio del sitio es sin IVA: subtotal 2500, IVA 400, total 2900", Number(c.subtotal) === 2500 && Number(c.iva) === 400 && Number(c.total) === 2900);
  check("la inscripción queda ligada a su cuenta y guarda el origen de la visita", db.inscripciones[0].cuenta_cobrar_id === c.id && db.inscripciones[0].utm_source === "linkedin");
  r = await imp.importarInscripcion(pool, "envio-0001-aaaa", envio());
  check("importar el MISMO envío otra vez no duplica nada", r.duplicada === true && db.inscripciones.length === 1 && db.cuentas.length === 1 && db.alumnos.length === 1);
  await imp.importarInscripcion(pool, "envio-0002-bbbb", envio());
  check("la misma persona (mismo correo) en otro envío reutiliza su alumno", db.alumnos.length === 1 && db.inscripciones.length === 2);

  console.log("importarInscripcion — paga una empresa");
  const emp = envio({ personas: [{ nombre: "Beto", correo: "b@e.test", whatsapp: "81" }, { nombre: "Cris", correo: "c@e.test", whatsapp: null }], num_personas: 2, paga: "empresa",
    factura: { requiere: true, rfc: "XAXX010101000", razon_social: "Empresa Ejemplo SA" }, monto_estimado: { total: 4500, descuento_pct: 10 } });
  await imp.importarInscripcion(pool, "envio-0003-cccc", emp);
  const nueva = db.clientes.find((x) => x.rfc === "XAXX010101000");
  check("la empresa nueva nace como Prospecto (con su RFC), no como cliente de verdad", !!nueva && nueva.tipo_cliente === "Prospecto" && db.clientes.length === 2);
  const ins = db.inscripciones.filter((i) => i.envio_id === "envio-0003-cccc");
  check("2 alumnos de esa empresa, 2 inscripciones con la mitad del monto cada una y UNA sola cuenta a nombre de la empresa", ins.length === 2 && ins.every((i) => i.monto === 2250) && db.alumnos.filter((a) => a.cliente_id === nueva.id).length === 2
    && db.cuentas[db.cuentas.length - 1].cliente_id === nueva.id && ins.every((i) => i.cuenta_cobrar_id === db.cuentas[db.cuentas.length - 1].id));
  check("la cuenta lleva la razón social y el RFC para facturar", db.cuentas[db.cuentas.length - 1].razon_social === "Empresa Ejemplo SA" && db.cuentas[db.cuentas.length - 1].rfc_receptor === "XAXX010101000");
  await imp.importarInscripcion(pool, "envio-0004-dddd", { ...emp, personas: [{ nombre: "Dani", correo: "d@e.test", whatsapp: "81" }], num_personas: 1 });
  check("otra inscripción de la misma empresa (mismo RFC) reutiliza su Cliente", db.clientes.length === 2);
  const sinRazon = envio({ personas: [{ nombre: "Eva", correo: "e@x.test", whatsapp: "81" }], paga: "empresa", factura: { requiere: false } });
  await imp.importarInscripcion(pool, "envio-0005-eeee", sinRazon);
  check("si paga «mi empresa» pero no dio razón social, queda en el cliente reservado (Alfredo la completa)", db.alumnos.find((a) => a.correo === "e@x.test").cliente_id === 77);

  console.log("importarInscripcion — fallas");
  const antes = JSON.stringify({ a: db.alumnos.length, i: db.inscripciones.length, c: db.cuentas.length });
  let e1; try { await imp.importarInscripcion(pool, "envio-0006-ffff", envio({ grupo: "NOPE-9" })); } catch (e) { e1 = e; }
  check("grupo inexistente: error con mensaje para mostrar y no se guarda nada", e1 && e1.safe && /NOPE-9/.test(e1.message) && JSON.stringify({ a: db.alumnos.length, i: db.inscripciones.length, c: db.cuentas.length }) === antes);
  modo.fallaCuenta = true;
  let e2; try { await imp.importarInscripcion(pool, "envio-0007-gggg", envio({ personas: [{ nombre: "Fer", correo: "f@x.test", whatsapp: "81" }] })); } catch (e) { e2 = e; }
  modo.fallaCuenta = false;
  check("si falla a la mitad (la cuenta): todo o nada, ni alumno ni inscripción quedan", !!e2 && JSON.stringify({ a: db.alumnos.length, i: db.inscripciones.length, c: db.cuentas.length }) === antes);

  console.log("importarEspera");
  const esp = { tipo: "lista_espera", nombre: "Gus", correo: "g@x.test", interes: "ia", paga: "yo", contexto: "modal_avisame", grupo_referencia: "IA-1", origen: { utm_source: "correo" } };
  await imp.importarEspera(pool, "espera-001-aaaa", esp);
  check("crea la fila de lista de espera con su origen", db.espera.length === 1 && db.espera[0].interes === "ia" && db.espera[0].utm_source === "correo");
  check("el mismo envío no se duplica", (await imp.importarEspera(pool, "espera-001-aaaa", esp)).duplicada === true && db.espera.length === 1);

  console.log("importarConSql — las colas completas");
  db = nuevoDb();
  const ci = colas.inscripciones.getTable(), ce = colas.espera.getTable();
  await colas.inscripciones.encolar(ci, "cola-ins-0001-a", { datos: JSON.stringify(envio()), grupo: "IA-1", nombre: "Ana Uno", lugares: 1 });
  await colas.inscripciones.encolar(ci, "cola-ins-0002-b", { datos: JSON.stringify(envio({ grupo: "NOPE-9", personas: [{ nombre: "Mal", correo: "m@x.test", whatsapp: "81" }] })), grupo: "NOPE-9", nombre: "Mal", lugares: 1 });
  await colas.espera.encolar(ce, "cola-esp-0001-a", { datos: JSON.stringify(esp), nombre: "Gus", interes: "ia" });
  const out = await imp.importarConSql(pool, ctx());
  check("importa lo bueno (1 inscripción y 1 lista de espera) y deja visible lo malo", out.inscripciones.importadas === 1 && out.inscripciones.errores === 1 && out.espera.importadas === 1 && db.inscripciones.length === 1 && db.espera.length === 1);
  const resumen = await imp.resumenColas();
  check("el envío con error se queda en la cola con su motivo (no bloquea a los demás)", resumen.inscripciones === 1 && resumen.errores.length === 1 && /NOPE-9/.test(resumen.errores[0].error) && resumen.errores[0].tipo === "inscripcion");
  check("lo importado ya no está en la cola", !(await colas.inscripciones.leer(ci, "cola-ins-0001-a")) && !(await colas.espera.leer(ce, "cola-esp-0001-a")));

  console.log("acciones del admin");
  await cal.guardarFoto(cal.getTable(), { ajustes: {}, grupos: [{ codigo: "IA-1", programa_id: "p", programa_nombre: "IA", herramienta: "ia", nivel: "Básico", modalidad: "en_linea", horas_totales: 12, sesiones: [{ inicio: new Date(Date.now() + 40 * 86400000).toISOString(), fin: new Date(Date.now() + 40 * 86400000 + 3600000).toISOString() }],
    precio_persona: 3000, cupo_total: 10, inscritos_confirmados: 0, apartados_sin_pago: 0, minimo_para_abrir: 3, publicacion: "publicado" }] }, { reconciliar: { "IA-1": 4 } });
  const id = db.inscripciones[0].id;
  let a = await llamar(actualizarInsc, { body: { id, accion: "confirmar" } });
  check("confirmar: apartada pasa a confirmada y pagada", a.status === 200 && db.inscripciones[0].estado === "confirmada" && db.inscripciones[0].estado_pago === "pagado");
  a = await llamar(actualizarInsc, { body: { id, accion: "confirmar" } });
  check("confirmar una que ya no está apartada → 409", a.status === 409);
  a = await llamar(actualizarInsc, { body: { id, accion: "cancelar" } });
  check("cancelar: queda cancelada y el lugar se devuelve al contador del sitio (4 → 3)", a.status === 200 && a.body.lugar_devuelto === true && db.inscripciones[0].estado === "cancelada" && tablas.CalendarioAbiertos.get("cupo|IA-1").reservados === 3);
  check("una cancelada no se cancela dos veces → 409; acción inválida → 400; sin id → 400",
    (await llamar(actualizarInsc, { body: { id, accion: "cancelar" } })).status === 409 && (await llamar(actualizarInsc, { body: { id, accion: "borrar" } })).status === 400 && (await llamar(actualizarInsc, { body: {} })).status === 400);
  const d = await llamar(descartar, { body: { tipo: "inscripcion", envioId: "cola-ins-0002-b" } });
  check("descartar un envío atorado: sale de la cola y devuelve sus lugares", d.status === 200 && d.body.lugares_devueltos === 1 && !(await colas.inscripciones.leer(ci, "cola-ins-0002-b")));
  check("descartar uno que ya no está → 404; sin datos → 400", (await llamar(descartar, { body: { tipo: "inscripcion", envioId: "cola-ins-0002-b" } })).status === 404 && (await llamar(descartar, { body: {} })).status === 400);

  console.log("regla del proyecto");
  const rutasPublicas = require("./rutas-publicas").map((x) => x.ruta);
  const nuevas = ["importarCursosAbiertosPendientes", "getInscripcionesAbiertasAdmin", "getListaEsperaAbiertaAdmin", "actualizarInscripcionAbierta", "actualizarListaEsperaAbierta", "descartarCursoAbiertoPendiente"];
  check("las 6 Functions nuevas son solo admin (no están en rutas públicas)", nuevas.every((n) => !rutasPublicas.includes(n)));
  const publico = ["./getCalendarioAbiertos", "./reservarCursoAbierto", "./avisarCursoAbierto"].map((f) => fs.readFileSync(require.resolve(f), "utf8")).join("\n");
  check("lo público no importa el módulo de importación", !/cursos-abiertos-import|backoffice-db/.test(publico.split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join("\n")));

  console.log(fallos ? "\n" + fallos + " FALLA(S)" : "\nTodo OK");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
