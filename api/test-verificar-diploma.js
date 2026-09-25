// test-verificar-diploma.js
// Prueba local, sin red: verificarDiploma con un Table Storage simulado en
// memoria — por código (nombre completo) y por folio (abreviado, sin código,
// con candado de intentos), y que no exista forma de ver calificación.
const Module = require("module");
const filas = new Map();
const key = (p, r) => p + "|" + r;
const fakeTable = {
  createTable: async () => {},
  getEntity: async (p, r) => { const e = filas.get(key(p, r)); if (!e) { const err = new Error("nf"); err.statusCode = 404; throw err; } return { ...e, etag: "x" }; },
  upsertEntity: async (e) => { filas.set(key(e.partitionKey, e.rowKey), { ...(filas.get(key(e.partitionKey, e.rowKey)) || {}), ...e }); },
  createEntity: async (e) => { filas.set(key(e.partitionKey, e.rowKey), { ...e }); },
  updateEntity: async (e) => { filas.set(key(e.partitionKey, e.rowKey), { ...(filas.get(key(e.partitionKey, e.rowKey)) || {}), ...e }); },
  deleteEntity: async (p, r) => { filas.delete(key(p, r)); },
  listEntities: function () { const it = [...filas.values()].filter((e) => e.partitionKey === "d"); return (async function* () { for (const e of it) yield e; })(); },
};
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "@azure/data-tables") return { TableClient: { fromConnectionString: () => fakeTable } };
  return origLoad.call(this, req, ...a);
};
process.env.RECURSOS_STORAGE_CONNECTION = "x";

const verificar = require("./verificarDiploma");
const evento = require("./registrarEventoDiploma");
const { guardarRegistros, getDiplomasVerifTable, abreviarNombre, listarEstadisticas } = require("./src/diplomas-verif");

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };
const ctx = () => ({ log: { error() {} }, res: null });
const llamar = async (query, ip = "1.1.1.1", extra = {}) => { const c = ctx(); await verificar(c, { query, headers: { "x-forwarded-for": ip, ...extra } }); return c.res; };
const clic = async (body, extra = {}) => { const c = ctx(); await evento(c, { body, headers: extra }); return c.res; };
const esperar = () => new Promise((r) => setTimeout(r, 30));
const adminHdr = { "x-ms-client-principal": Buffer.from(JSON.stringify({ userRoles: ["anonymous", "authenticated", "admin"] })).toString("base64") };

(async () => {
  check("abreviarNombre 4 palabras", abreviarNombre("Ana María Pérez García") === "Ana María P. G.");
  check("abreviarNombre 2 palabras se queda igual", abreviarNombre("Ana Pérez") === "Ana Pérez");
  check("abreviarNombre 3 palabras", abreviarNombre("Luis Ramírez Soto") === "Luis R. S.");

  await guardarRegistros(getDiplomasVerifTable(), [{ folio: "APKEME-2601", codigo: "ab12cd34", datos: { folio: "APKEME-2601", codigo: "ab12cd34", nombre: "Ana María Pérez García", curso: "Power BI", estatus: "vigente", resultado: "Aprobado", herramientas: ["powerbi"], aprendizaje: ["Modelar datos"] } }]);

  let r = await llamar({ c: "ab12cd34" });
  check("por código: 200 y nombre completo", r.status === 200 && r.body.nombre === "Ana María Pérez García" && r.body.porCodigo === true);
  check("por código: nunca trae calificación ni asistencia ni correo", !("calificacion" in r.body) && !("asistencia" in r.body) && !("correo" in r.body));
  r = await llamar({ f: "apkeme-2601" });
  check("por folio: 200, nombre abreviado y SIN código", r.status === 200 && r.body.nombre === "Ana María P. G." && !("codigo" in r.body) && r.body.porCodigo === false);
  r = await llamar({ f: "APKEME-9999" }, "2.2.2.2");
  check("folio inexistente: 404", r.status === 404);
  r = await llamar({ c: "zzzzzzzz" });
  check("código inexistente: 404", r.status === 404);
  r = await llamar({ f: "'; DROP" });
  check("formato inválido: 404 sin consultar", r.status === 404);
  r = await llamar({});
  check("sin parámetros: 404", r.status === 404);

  // candado: 10 búsquedas por folio desde la misma IP y la siguiente se bloquea
  let ultimo;
  for (let i = 0; i < 12; i++) ultimo = await llamar({ f: "APKEME-2601" }, "9.9.9.9");
  check("por folio: a partir de ~10 búsquedas seguidas de una IP responde 429", ultimo.status === 429);
  r = await llamar({ c: "ab12cd34" }, "9.9.9.9");
  check("por código NO se bloquea (no se puede adivinar)", r.status === 200);
  r = await llamar({ f: "APKEME-2601" }, "8.8.8.8");
  check("otra IP no se ve afectada", r.status === 200);

  // ── contadores de verificación ──
  await guardarRegistros(getDiplomasVerifTable(), [{ folio: "APCONT-2601", codigo: "cont0001", grupoId: 7, datos: { folio: "APCONT-2601", codigo: "cont0001", nombre: "Luis Ramírez Soto", estatus: "vigente" } },
    { folio: "APCONT-2602", codigo: "cont0002", grupoId: 7, datos: { folio: "APCONT-2602", codigo: "cont0002", nombre: "Eva Solís", estatus: "vigente" } }]);
  await llamar({ c: "cont0001" }); await llamar({ c: "cont0001", r: "li" }); await llamar({ f: "APCONT-2601" }, "5.5.5.5");
  await llamar({ c: "cont0001" }, "1.1.1.1", adminHdr);
  await llamar({ c: "cont0001" }, "1.1.1.1", { "user-agent": "WhatsApp/2.23 preview" });
  await esperar();
  let st = await listarEstadisticas(getDiplomasVerifTable());
  check("cuenta 3 vistas reales (2 QR + 1 folio)", st.porFolio["APCONT-2601"].vistas === 3 && st.porFolio["APCONT-2601"].qr === 2 && st.porFolio["APCONT-2601"].folio === 1);
  check("no cuenta al admin ni a robots de vista previa", st.porFolio["APCONT-2601"].vistas === 3);
  check("cuenta la visita que llegó desde LinkedIn", st.porFolio["APCONT-2601"].desdeLinkedin === 1);
  check("guarda la fecha de la última visita", typeof st.porFolio["APCONT-2601"].ultima === "string");
  await clic({ c: "cont0001", e: "linkedin" }); await clic({ f: "APCONT-2601", e: "linkedin" });
  await clic({ c: "cont0001", e: "linkedin" }, adminHdr); await clic({ c: "cont0001", e: "otro" }); await clic({ c: "noexiste", e: "linkedin" }); await clic({ c: "zzzzzzzz", e: "linkedin" });
  await esperar();
  st = await listarEstadisticas(getDiplomasVerifTable());
  check("clics de LinkedIn: por código y por folio, sin admin ni eventos inválidos", st.porFolio["APCONT-2601"].clicsLinkedin === 2);
  check("un clic a un diploma inexistente no crea filas", ![...filas.keys()].some((k) => k.includes("zzzzzzzz")));
  await llamar({ c: "cont0002" });
  await esperar();
  st = await listarEstadisticas(getDiplomasVerifTable());
  check("suma por grupo (2 diplomas del grupo 7)", st.porGrupo[7].vistas === 4 && st.porGrupo[7].clicsLinkedin === 2 && st.porGrupo[7].qr === 3);

  console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : "\nTodas las pruebas pasaron.");
  process.exit(fallos ? 1 : 0);
})();
