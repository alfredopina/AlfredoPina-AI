// test-propuestas.js — propuesta de cotización (api/src/propuestas.js) y sus Functions públicas, sin red: Table Storage
// simulada en memoria. Cubre el snapshot, el contador de vistas (admin/robots no cuentan), la primera aceptación y el
// aviso de "reemplazada".
const Module = require("module");

const filas = new Map();
function fakeTable() {
  const k = (p, r) => p + "|" + r;
  const nf = () => { const e = new Error("nf"); e.statusCode = 404; return e; };
  return {
    createTable: async () => {},
    getEntity: async (p, r) => { const e = filas.get(k(p, r)); if (!e) throw nf(); return { ...e, etag: "v" + (e._v || 0) }; },
    createEntity: async (e) => { if (filas.has(k(e.partitionKey, e.rowKey))) { const x = new Error("dup"); x.statusCode = 409; throw x; } filas.set(k(e.partitionKey, e.rowKey), { ...e, _v: 0 }); },
    upsertEntity: async (e) => { filas.set(k(e.partitionKey, e.rowKey), { ...e, _v: 0 }); },
    updateEntity: async (e, modo, opts) => {
      const actual = filas.get(k(e.partitionKey, e.rowKey));
      if (!actual) throw nf();
      if (opts && opts.etag && opts.etag !== "v" + (actual._v || 0)) { const x = new Error("etag"); x.statusCode = 412; throw x; }
      filas.set(k(e.partitionKey, e.rowKey), { ...actual, ...e, _v: (actual._v || 0) + 1 });
    },
    listEntities: () => (async function* () { for (const e of [...filas.values()]) yield { ...e }; })(),
  };
}
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "@azure/data-tables") return { TableClient: { fromConnectionString: () => fakeTable() } };
  return origLoad.call(this, req, ...a);
};
process.env.RECURSOS_STORAGE_CONNECTION = "x";
const correos = [];
const notif = require("./src/notificaciones-correo");
notif.enviarCorreo = async (c) => { correos.push(c); return { enviado: true }; };

const P = require("./src/propuestas");
const getPublica = require("./getPropuestaPublica");
const responder = require("./responderPropuesta");

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };
const principal = (roles) => ({ "x-ms-client-principal": Buffer.from(JSON.stringify({ userRoles: roles })).toString("base64") });

(async () => {
  const snap = P.armarSnapshot({
    folio: "AP26-KEME-POWERBI-01", cliente: "KEMET", contacto: "Anwar", herramienta: "powerbi", programa: "Power BI + Copilot",
    temas: [{ nombre: "Modelo", nivel: 1, descripcion: "d1", horas: 4 }, { nombre: "DAX", nivel: 3, descripcion: "d2", horas: 4 }, { nombre: "  ", nivel: 2 }],
    horas: 24, modalidad: "Presencial", participantes: "5 a 10", ciudadSede: "Monterrey", fechaTentativa: null, objetivo: "o", dirigidoA: "d",
    proyectos: [{ nombre: "Tablero", resumen: "r", imagenUrl: "https://x/y.jpg" }], tarifaHora: 1500, precioSugerido: 36000, precioFinal: 32400,
    emitida: new Date("2026-10-07T18:00:00Z"), vigencia: new Date("2026-10-22T00:00:00Z"),
  });
  check("snapshot: temas sin nombre se descartan y no llevan horas por tema", snap.temas.length === 2 && snap.temas.every((t) => !("horas" in t)));
  check("snapshot: nivel de básico a avanzado", snap.nivelTxt === "Básico a Avanzado");
  check("snapshot: descuento efectivo 10 % (36 000 a 32 400)", snap.descuentoPct === 10 && snap.sugerido === 36000 && snap.total === 32400);
  check("snapshot: vigencia es solo la fecha (sin zona horaria)", snap.vigencia === "2026-10-22");
  check("snapshot: lleva los términos congelados", snap.terminos.length === P.TERMINOS.length && snap.terminos[0] === P.TERMINOS[0]);
  check("snapshot: precio editado hacia ARRIBA no inventa descuento", P.armarSnapshot({ temas: [], tarifaHora: 1, precioSugerido: 100, precioFinal: 120, emitida: new Date(), vigencia: new Date() }).descuentoPct === 0);

  check("código desde blob_path nuevo", P.codigoDePropuesta("propuesta/ab12cd34") === "ab12cd34");
  check("blob_path viejo (PDF) no es propuesta", P.codigoDePropuesta("AP_EXCEL_KEM_26-3.pdf") === null && P.codigoDePropuesta(null) === null);

  const tabla = P.getPropuestasTable();
  await P.guardarPropuesta(tabla, { codigo: "ab12cd34", snapshot: snap });

  const llamar = async (fn, req) => { const c = { log: { error() {}, warn() {} }, res: null }; await fn(c, req); await new Promise((r) => setTimeout(r, 20)); return c.res; };
  const get = (codigo, headers = {}) => llamar(getPublica, { query: { codigo }, headers });

  let r = await get("no-valido");
  check("código con formato inválido: 400", r.status === 400);
  r = await get("zz99zz99");
  check("código válido pero inexistente: 404", r.status === 404);

  r = await get("ab12cd34", { "user-agent": "Mozilla/5.0" });
  check("cliente real: 200 con la propuesta y SIN bloque admin", r.status === 200 && r.body.propuesta.folio === snap.folio && !r.body.admin && r.body.aceptada === false);
  r = await get("ab12cd34", { "user-agent": "WhatsApp/2.23" });
  check("robot de WhatsApp: abre pero no cuenta", r.status === 200);
  r = await get("ab12cd34", { ...principal(["admin"]), "user-agent": "Mozilla/5.0" });
  check("admin: ve las estadísticas, y su visita no cuenta (1 vista real)", r.status === 200 && r.body.admin && r.body.admin.vistas === 1);
  r = await get("ab12cd34", { "user-agent": "Mozilla/5.0" });
  r = await get("ab12cd34", { ...principal(["admin"]) });
  check("segundo cliente real suma: 2 vistas", r.body.admin.vistas === 2 && r.body.admin.ultimaVista && r.body.admin.primeraVista);

  r = await llamar(responder, { body: { codigo: "ab12cd34", nombre: "A" }, headers: {} });
  check("aceptar sin nombre válido: 400", r.status === 400);
  r = await llamar(responder, { body: { codigo: "ab12cd34", nombre: "Ana Pérez", web: "spam" }, headers: {} });
  check("honeypot lleno: 200 silencioso, sin correo ni registro", r.status === 200 && correos.length === 0);
  r = await llamar(responder, { body: { codigo: "ab12cd34", nombre: "Admin Probando" }, headers: principal(["admin"]) });
  check("admin probando Aceptar: simulado, no guarda ni avisa", r.status === 200 && r.body.simulado === true && correos.length === 0);
  r = await llamar(responder, { body: { codigo: "zz99zz99", nombre: "Ana Pérez" }, headers: {} });
  check("aceptar una propuesta inexistente: 404", r.status === 404);

  r = await llamar(responder, { body: { codigo: "ab12cd34", nombre: "Ana Pérez", comentario: "Va, arrancamos en noviembre" }, headers: {} });
  check("primera aceptación: 200 y UN correo a Alfredo con el folio y el nombre", r.status === 200 && correos.length === 1 && /AP26-KEME-POWERBI-01/.test(correos[0].asunto) && /Ana Pérez/.test(correos[0].texto));
  r = await llamar(responder, { body: { codigo: "ab12cd34", nombre: "Otra Persona" }, headers: {} });
  check("segunda aceptación: 200 pero no repite el correo ni pisa el nombre", r.status === 200 && correos.length === 1);
  r = await get("ab12cd34", principal(["admin"]));
  check("el admin ve quién aceptó y su comentario", r.body.aceptada === true && r.body.admin.aceptadaPor === "Ana Pérez" && /noviembre/.test(r.body.admin.aceptadaComentario));

  await P.marcarReemplazada(tabla, "ab12cd34", "nuevo0001", "AP26-KEME-POWERBI-02");
  r = await get("ab12cd34", {});
  check("reemplazada: la versión vieja abre y apunta a la nueva", r.status === 200 && r.body.reemplazadaPor.codigo === "nuevo0001" && r.body.reemplazadaPor.folio === "AP26-KEME-POWERBI-02");
  await P.marcarReemplazada(tabla, "inexistent", "x", "y");
  check("marcarReemplazada sobre una propuesta inexistente no lanza", true);

  const est = await P.listarEstadisticas(tabla);
  check("estadísticas para el admin: vistas y aceptación por código", est.ab12cd34 && est.ab12cd34.vistas >= 2 && est.ab12cd34.aceptadaPor === "Ana Pérez");

  // extender vigencia: cambia solo la fecha del snapshot, conserva vistas y aceptación
  const antes = await tabla.getEntity("propuesta", "ab12cd34");
  check("extender vigencia: true y la fecha nueva queda en el snapshot", (await P.actualizarVigenciaPropuesta(tabla, "ab12cd34", "2027-01-15")) === true && (await P.leerPropuesta(tabla, "ab12cd34")).snapshot.vigencia === "2027-01-15");
  const despues = await P.leerPropuesta(tabla, "ab12cd34");
  check("extender vigencia: conserva vistas y aceptación", despues.vivo.vistas === (antes.vistas || 0) && despues.vivo.aceptadaPor === "Ana Pérez");
  check("extender vigencia en una propuesta inexistente: false", (await P.actualizarVigenciaPropuesta(tabla, "nada0000", "2027-01-15")) === false);
  check("el snapshot lleva el alcance", P.armarSnapshot({ folio: "F", cliente: "C", herramienta: "excel", programa: "P", temas: [], alcance: "Alcance X", precioSugerido: 1, precioFinal: 1, emitida: new Date(), vigencia: new Date() }).alcance === "Alcance X");

  console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : "\nTodas las pruebas pasaron.");
  process.exit(fallos ? 1 : 0);
})();
