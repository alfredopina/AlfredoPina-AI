// test-solicitud-cola.js
// Prueba local, sin red: el formulario público ahora escribe en una COLA (Table
// Storage) y no en SQL. Verifica la Function crearSolicitudPublica con una tabla
// en memoria (valida, encola, idempotente, honeypot) y el drenado hacia SQL
// (orden, borrado, fallos aislados, una sola corrida a la vez, nunca lanza).
const Module = require("module");

const tablas = {}; // nombre -> Map(pk|rk -> entidad)
function fakeTable(nombre) {
  const m = tablas[nombre] || (tablas[nombre] = new Map());
  const k = (p, r) => p + "|" + r;
  return {
    createTable: async () => {},
    getEntity: async (p, r) => { const e = m.get(k(p, r)); if (!e) { const er = new Error("nf"); er.statusCode = 404; throw er; } return { ...e }; },
    createEntity: async (e) => { if (m.has(k(e.partitionKey, e.rowKey))) { const er = new Error("dup"); er.statusCode = 409; throw er; } m.set(k(e.partitionKey, e.rowKey), { ...e }); },
    upsertEntity: async (e) => { m.set(k(e.partitionKey, e.rowKey), { ...(m.get(k(e.partitionKey, e.rowKey)) || {}), ...e }); },
    deleteEntity: async (p, r) => { if (!m.delete(k(p, r))) { const er = new Error("nf"); er.statusCode = 404; throw er; } },
    listEntities: () => (async function* () { for (const e of [...m.values()]) yield { ...e }; })(),
  };
}
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "@azure/data-tables") return { TableClient: { fromConnectionString: (_c, nombre) => fakeTable(nombre) } };
  return origLoad.call(this, req, ...a);
};
process.env.RECURSOS_STORAGE_CONNECTION = "x";

const crear = require("./crearSolicitudPublica");
const cola = require("./src/solicitud-publica-cola");

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };
const ctx = () => ({ log: { error() {}, warn() {} }, res: null });
const cuerpo = (extra = {}) => ({
  nombre: "Jesus", correo: "jesus@qae.com", whatsapp: "8117255937", empresa: "QAE", herramienta: "excel",
  temario_nombre: "Excel Básico intermedio", temas: ["a", "b"], horas_totales: 20, participantes: "1", modalidad: "Presencial",
  comentarios: "que onda", web: "", tf: 6000, ...extra,
});
const enviar = async (body, ip = "5.5.5.5") => { const c = ctx(); await crear(c, { body, headers: { "x-forwarded-for": ip } }); return c.res; };
const enCola = () => (tablas.SolicitudesPendientes ? tablas.SolicitudesPendientes.size : 0);

(async () => {
  // ── la Function ──
  let r = await enviar(cuerpo());
  check("envío válido: 200 inmediato y queda 1 en la cola (sin tocar SQL)", r.status === 200 && r.body.ok === true && enCola() === 1);

  r = await enviar(cuerpo());
  check("mismo envío otra vez (reintento del navegador): 200 duplicada y NO crea otra fila", r.status === 200 && r.body.duplicada === true && enCola() === 1);

  r = await enviar(cuerpo({ nombre: "Otra Persona", correo: "otra@x.com" }), "6.6.6.6");
  check("otro contacto: otra fila en la cola", r.status === 200 && enCola() === 2);

  r = await enviar(cuerpo({ web: "http://spam.com" }), "7.7.7.7");
  check("honeypot lleno: 200 silencioso y NO se encola", r.status === 200 && enCola() === 2);

  r = await enviar(cuerpo({ nombre: "" }), "8.8.8.8");
  check("sin nombre: 400 definitivo", r.status === 400 && enCola() === 2);
  r = await enviar(cuerpo({ correo: "", whatsapp: "" }), "8.8.8.8");
  check("sin correo ni WhatsApp: 400", r.status === 400);
  r = await enviar(cuerpo({ tf: 300 }), "8.8.8.8");
  check("llenado demasiado rápido: 400 (antispam)", r.status === 400 && enCola() === 2);

  // ── el drenado ──
  const insertados = [];
  const insertarOk = async (llave, datos, recibidoEn) => { insertados.push({ llave, nombre: datos.nombreContacto, recibidoEn }); };
  const tabla = cola.getColaTable();
  const n = await cola.drenarPendientes(tabla, insertarOk, ctx());
  check("drenado: pasa las 2 a SQL y las borra de la cola", n === 2 && insertados.length === 2 && enCola() === 0);
  check("drenado: conserva la fecha en que la envió el visitante", insertados.every((x) => x.recibidoEn instanceof Date && !isNaN(x.recibidoEn)));
  check("drenado: el insert recibe los datos completos (nombre, etc.)", insertados.some((x) => x.nombre === "Jesus"));

  // un fallo no se lleva a los demás ni se pierde
  await enviar(cuerpo({ nombre: "Falla", correo: "f@x.com" }), "1.1.1.1");
  await enviar(cuerpo({ nombre: "Bien", correo: "b@x.com" }), "2.2.2.2");
  const insertarMixto = async (llave, datos) => { if (datos.nombreContacto === "Falla") throw new Error("base dormida"); };
  const n2 = await cola.drenarPendientes(tabla, insertarMixto, ctx());
  check("un fallo no frena a los demás: pasa 1, la que falló se queda en la cola", n2 === 1 && enCola() === 1);

  // varias lecturas del admin a la vez = una sola corrida
  await enviar(cuerpo({ nombre: "Conc", correo: "c@x.com" }), "3.3.3.3");
  let llamadas = 0;
  const insertarLento = async () => { llamadas++; await new Promise((res) => setTimeout(res, 40)); };
  const [a, b, c] = await Promise.all([cola.drenarPendientes(tabla, insertarLento, ctx()), cola.drenarPendientes(tabla, insertarLento, ctx()), cola.drenarPendientes(tabla, insertarLento, ctx())]);
  check("3 drenados simultáneos comparten una sola corrida (no insertan doble)", a === b && b === c && llamadas === 2 && enCola() === 0);

  // nunca lanza
  const tablaRota = { createTable: async () => {}, listEntities: () => { throw new Error("storage caído"); } };
  let lanzo = false;
  try { await cola.drenarPendientes(tablaRota, insertarOk, ctx()); } catch (e) { lanzo = true; }
  check("si Table Storage falla, drenarPendientes NO lanza (no tumba el admin)", !lanzo);

  // ── insertarEnSql con una base simulada: el flujo (candado → buscar duplicada → cliente → contacto → solicitud → commit) ──
  function baseFalsa({ duplicada }) {
    const log = { consultas: [], commit: 0, rollback: 0 };
    class Request {
      constructor() { this.params = {}; }
      input(n, t, v) { this.params[n] = v; return this; }
      async query(q) {
        log.consultas.push({ q, params: this.params });
        if (/sp_getapplock/.test(q)) return { recordset: [{ r: 0 }] };
        if (/SELECT TOP 1 s.id/.test(q)) return { recordset: duplicada ? [{ id: 55 }] : [] };
        if (/INSERT INTO Contacto/.test(q)) return { recordset: [{ id: 7 }] };
        if (/INSERT INTO Solicitud/.test(q)) return { recordset: [{ id: 99 }] };
        return { recordset: [] };
      }
    }
    class Transaction { async begin() {} async commit() { log.commit++; } async rollback() { log.rollback++; } }
    const tipos = { NVarChar: "nv", Int: "i", Bit: "b", DateTime2: "dt", Decimal: () => "dec" };
    return { sql: { Request, Transaction, ...tipos }, log };
  }
  const datosSql = { nombreContacto: "Jesus", empresaNombre: "QAE", correo: "j@q.com", telefono: null, herramienta: "excel", temarioNombre: "X", temas: ["a"], horasTotales: 20, participantes: "Solo yo", modalidad: "Online", notas: null };
  const recibido = new Date("2026-10-07T15:00:00Z");
  let bd = baseFalsa({ duplicada: false });
  const res1 = await cola.insertarEnSql({}, bd.sql, async () => ({ id: 3, creado: true }), "llave1", datosSql, recibido);
  check("insertarEnSql: crea la solicitud (id 99), con commit y sin rollback", res1.id === 99 && res1.duplicada === false && bd.log.commit === 1 && bd.log.rollback === 0);
  const insSol = bd.log.consultas.find((c) => /INSERT INTO Solicitud/.test(c.q));
  check("insertarEnSql: fecha_creacion y fecha_estatus usan la fecha en que la envió el visitante", /@recibido, @recibido/.test(insSol.q) && insSol.params.recibido === recibido);
  bd = baseFalsa({ duplicada: true });
  const res2 = await cola.insertarEnSql({}, bd.sql, async () => { throw new Error("no debe crear cliente"); }, "llave1", datosSql, recibido);
  check("insertarEnSql: si ya existía (drenado interrumpido) devuelve esa y no crea nada", res2.id === 55 && res2.duplicada === true && bd.log.commit === 1);
  bd = baseFalsa({ duplicada: false });
  let fallo = false;
  try { await cola.insertarEnSql({}, bd.sql, async () => { throw new Error("sql caído"); }, "llave1", datosSql, recibido); } catch (e) { fallo = true; }
  check("insertarEnSql: si algo falla hace rollback y lanza (la fila se queda en la cola)", fallo && bd.log.rollback === 1 && bd.log.commit === 0);

  check("la llave no distingue mayúsculas", cola.llaveDeEnvio({ nombreContacto: "ANA" }) === cola.llaveDeEnvio({ nombreContacto: "ana" }));

  console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : "\nTodas las pruebas pasaron.");
  process.exit(fallos ? 1 : 0);
})();
