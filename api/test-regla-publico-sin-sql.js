// test-regla-publico-sin-sql.js — REGLA (Alfredo, 2026-10-13): nada del sitio PÚBLICO despierta la base SQL; solo el admin.
// Cada Function que no está listada como solo-admin en staticwebapp.config.json es pública: no puede llamar a getPool() (ni ella ni los
// módulos que importa). Por qué: la base serverless está en la oferta gratuita (100 000 vCore-s al mes) y cada despertar sin uso real
// cuesta hasta 1 800 vCore-s (pausa tras 60 min sin uso); los visitantes (alumnos, clientes, bots) no deben gastar esa cuota.
// Lo público escribe en Table Storage (colas: crearSolicitudPublica, enviarDiagnostico, enviarRespuesta) y el admin las pasa a SQL.
//
// Excepción explícita y documentada (lista de abajo): tareas PROGRAMADAS con secreto, que no las dispara ningún visitante.
// OJO: al invertir las reglas de rutas (auditoría A01-001, comodín /api/* admin al final) "pública" pasa a ser la ruta listada SIN rol admin:
// adaptar el cálculo de `publicas` aquí abajo en ese cambio.
// Análisis estático de código (sin ejecutar nada): sigue los require() locales y busca llamadas a getPool().
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const API = __dirname;

// Públicas (sin sesión, protegidas por secreto de cron) que SÍ pueden tocar SQL, a propósito. Agregar una aquí es una decisión de Alfredo.
const EXCEPCIONES = {
  enviarResumenSemanal: "resumen semanal por correo: 1 despertar los lunes 7:00 (≈ 1 800 vCore-s por semana); lo dispara un cron, no un visitante",
};

const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, "staticwebapp.config.json"), "utf8"));
const listadasAdmin = new Set(cfg.routes.filter((r) => r.route.startsWith("/api/") && (r.allowedRoles || []).includes("admin")).map((r) => r.route.replace("/api/", "")));
const funciones = fs.readdirSync(API).filter((d) => fs.existsSync(path.join(API, d, "function.json")));
const publicas = funciones.filter((f) => !listadasAdmin.has(f)).sort();

function sinComentarios(src) { return src.split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join("\n"); }

// módulos (transitivos) donde aparece una llamada a getPool()
function llamadasAGetPool(archivo, vistos = new Set()) {
  if (vistos.has(archivo) || !fs.existsSync(archivo)) return [];
  vistos.add(archivo);
  const src = sinComentarios(fs.readFileSync(archivo, "utf8"));
  const r = [];
  if (!archivo.endsWith("backoffice-db.js") && /(^|[^A-Za-z_.])getPool\s*\(\s*\)/.test(src)) r.push(path.relative(API, archivo).replace(/\\/g, "/"));
  const re = /require\(["'](\.\.?\/[^"']+)["']\)/g;
  let m;
  while ((m = re.exec(src))) {
    let ruta = path.resolve(path.dirname(archivo), m[1]);
    if (fs.existsSync(ruta + ".js")) ruta += ".js"; else if (fs.existsSync(path.join(ruta, "index.js"))) ruta = path.join(ruta, "index.js");
    r.push(...llamadasAGetPool(ruta, vistos));
  }
  return r;
}

let fallos = 0;
const check = (n, ok, detalle) => { console.log((ok ? "  OK " : "  FALLA ") + n + (ok || !detalle ? "" : " → " + detalle)); if (!ok) fallos++; };

const tocanSql = {};
for (const f of publicas) {
  const h = [...new Set(llamadasAGetPool(path.join(API, f, "index.js")))];
  if (h.length) tocanSql[f] = h;
}

check("hay Functions públicas que revisar (el análisis no quedó vacío)", publicas.length >= 15, "públicas: " + publicas.length);
const infractoras = Object.keys(tocanSql).filter((f) => !EXCEPCIONES[f]);
check("ninguna Function pública llama a getPool() (solo el admin toca la base)", infractoras.length === 0, infractoras.map((f) => f + " (" + tocanSql[f].join(", ") + ")").join("; "));
for (const f of Object.keys(EXCEPCIONES)) {
  check("la excepción '" + f + "' sigue existiendo y sigue siendo necesaria (si ya no toca SQL, quítala de la lista)", publicas.includes(f) && Boolean(tocanSql[f]));
}
// las colas públicas de verdad no tocan SQL
for (const f of ["crearSolicitudPublica", "enviarDiagnostico", "enviarRespuesta", "notificarSolicitudesAtoradas", "verificarDiploma", "getPropuestaPublica"]) {
  check(f + " es pública y no toca la base", publicas.includes(f) && !tocanSql[f]);
}

if (fallos) { console.log("\n" + fallos + " prueba(s) fallaron"); process.exit(1); }
console.log("\ntest-regla-publico-sin-sql: ok (" + publicas.length + " Functions públicas revisadas)");
