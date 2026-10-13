// test-seguridad-lote.js — lote chico de la auditoría 01 (2026-10-13), sin red:
//   A01-002 buscarClientes cerrada a admin · A01-003 cabeceras de seguridad · A01-006 el error interno no sale en una respuesta pública ·
//   A01-007 secreto de cron en tiempo constante · A01-008 códigos cortos sin sesgo · A01-009 freno a las escrituras públicas.
const Module = require("module");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };

// Table Storage que falla con un mensaje "interno" (para A01-006)
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "@azure/data-tables") {
    return { TableClient: { fromConnectionString: () => ({ createTable: async () => {}, getEntity: async () => { const e = new Error("DETALLE-INTERNO tabla=Reportes cadena=xyz"); e.statusCode = 500; throw e; } }) } };
  }
  return origLoad.call(this, req, ...a);
};
process.env.RECURSOS_STORAGE_CONNECTION = "x";

const { autorizado } = require("./src/cron-secreto");
const { generarCodigoCorto, CODIGO_CORTO_RE } = require("./src/codigo-corto");
const { permitirEscritura } = require("./src/rate-limit");
const reportePublico = require("./getReporteDiagnosticoPublico");
const respaldo = require("./respaldoAutomatico");

(async () => {
  console.log("A01-007 · secreto de cron");
  process.env.BACKUP_CRON_SECRET = "s3creto-largo-de-prueba";
  const req = (v) => ({ headers: v === undefined ? {} : { "x-backup-secret": v } });
  check("el secreto correcto autoriza", autorizado(req("s3creto-largo-de-prueba")) === true);
  check("uno distinto, aunque casi igual, no", autorizado(req("s3creto-largo-de-pruebA")) === false);
  check("de otra longitud no autoriza (y no lanza)", autorizado(req("corto")) === false && autorizado(req("s3creto-largo-de-prueba-y-mas")) === false);
  check("sin cabecera, vacío o no-texto no autoriza", autorizado(req()) === false && autorizado(req("")) === false && autorizado({ headers: { "x-backup-secret": ["x"] } }) === false && autorizado({}) === false && autorizado(null) === false);
  const sinSecreto = process.env.BACKUP_CRON_SECRET; delete process.env.BACKUP_CRON_SECRET;
  check("si la Application Setting no existe, NADIE autoriza (ni con cabecera vacía)", autorizado(req("")) === false && autorizado(req("x")) === false);
  process.env.BACKUP_CRON_SECRET = sinSecreto;
  const ctx = { log: { error() {} }, res: null };
  await respaldo(ctx, { headers: { "x-backup-secret": "incorrecto" } });
  check("respaldoAutomatico usa la misma comparación: secreto incorrecto → 401", ctx.res.status === 401);

  console.log("A01-008 · códigos cortos");
  const muchos = Array.from({ length: 500 }, () => generarCodigoCorto());
  check("formato: 8 caracteres a-z0-9", muchos.every((c) => CODIGO_CORTO_RE.test(c)));
  check("no se repiten (500 códigos)", new Set(muchos).size === 500);
  // determinista: bytes >= 252 se DESCARTAN (con módulo saldrían de los primeros símbolos), 251 sí vale y da el último símbolo ('9')
  const orig = crypto.randomBytes;
  const respuestas = [Buffer.from([255, 254, 253, 252, 252, 255, 253, 254, 255, 255, 255, 255, 255, 255, 255, 255]), Buffer.from([0, 1, 2, 3, 4, 5, 6, 251, 9, 9, 9, 9, 9, 9, 9, 9])];
  crypto.randomBytes = () => respuestas.shift() || orig(16);
  const dec = generarCodigoCorto();
  crypto.randomBytes = orig;
  check("descarta los bytes >= 252 y pide más (sin sesgo modular): 'abcdefg' + el 251 → '9'", dec === "abcdefg9");

  console.log("A01-009 · freno a escrituras públicas");
  const filas = new Map();
  const tabla = {
    getEntity: async (p, r) => { const e = filas.get(p + "|" + r); if (!e) { const er = new Error("nf"); er.statusCode = 404; throw er; } return { ...e }; },
    upsertEntity: async (e) => { filas.set(e.partitionKey + "|" + e.rowKey, { ...e }); },
    deleteEntity: async () => {},
  };
  const c2 = { log: { error() {} } };
  const resultados = [];
  for (let i = 0; i < 12; i++) resultados.push(await permitirEscritura(tabla, "evt_abcd1234", c2));
  check("deja escribir las primeras 10 y luego frena", resultados.slice(0, 10).every(Boolean) && resultados[10] === false && resultados[11] === false);
  check("el freno de un código no afecta a otro", (await permitirEscritura(tabla, "evt_otro0000", c2)) === true);
  const rota = { getEntity: async () => { throw new Error("storage caído"); }, upsertEntity: async () => { throw new Error("storage caído"); } };
  check("si Table Storage falla, el freno falla ABIERTO (no bloquea a nadie)", (await permitirEscritura(rota, "evt_x", c2)) === true);

  console.log("A01-006 · error público sin detalles internos");
  const c3 = { log: { error() {} }, res: null };
  await reportePublico(c3, { query: { token: "abcd1234" }, params: {}, headers: {} });
  const cuerpo = JSON.stringify(c3.res && c3.res.body);
  check("getReporteDiagnosticoPublico: 500 con texto fijo, sin el mensaje interno", c3.res && c3.res.status === 500 && !/DETALLE-INTERNO|xyz|Reportes/.test(cuerpo));

  console.log("A01-003 / A01-002 · configuración");
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "staticwebapp.config.json"), "utf8"));
  const h = cfg.globalHeaders || {};
  check("cabeceras: nosniff, Referrer-Policy, X-Frame-Options y HSTS", h["X-Content-Type-Options"] === "nosniff" && h["Referrer-Policy"] === "strict-origin-when-cross-origin" && h["X-Frame-Options"] === "SAMEORIGIN" && /max-age=\d+/.test(h["Strict-Transport-Security"] || ""));
  const ruta = (r) => cfg.routes.find((x) => x.route === r);
  check("/api/buscarClientes ya es solo admin", ruta("/api/buscarClientes") && ruta("/api/buscarClientes").allowedRoles.includes("admin"));
  // ninguna página pública vuelve a llamar a buscarClientes (la cartera no se puede sacar sin sesión)
  const raiz = path.join(__dirname, "..");
  const publicas = fs.readdirSync(raiz).filter((f) => f.endsWith(".html"));
  check("ninguna página pública llama a /api/buscarClientes", publicas.every((f) => !/\/api\/buscarClientes(?!Admin)/.test(fs.readFileSync(path.join(raiz, f), "utf8"))));
  check("el archivo de configuración sigue dentro del tope de 20 KB de Azure", fs.statSync(path.join(raiz, "staticwebapp.config.json")).size < 19000);

  if (fallos) { console.log("\n" + fallos + " prueba(s) fallaron"); process.exit(1); }
  console.log("\ntest-seguridad-lote: ok");
})().catch((e) => { console.error(e); process.exit(1); });
