// test-rutas-cerradas.js — auditoría A01-001 (2026-10-13/14): /api/* es SOLO ADMIN por defecto; lo público es una lista explícita.
// Sin red. Garantiza que "una Function nueva nace cerrada" y que `staticwebapp.config.json` no se desvía de la lista (api/rutas-publicas.js).
const fs = require("fs");
const path = require("path");
const publicas = require("./rutas-publicas");
const { generar, ARCHIVO } = require("../tools/generar-rutas");

let fallos = 0;
const check = (n, ok, detalle) => { console.log((ok ? "  OK " : "  FALLA ") + n + (ok || !detalle ? "" : " → " + detalle)); if (!ok) fallos++; };

const textoActual = fs.readFileSync(ARCHIVO, "utf8").replace(/\r\n/g, "\n");
const cfg = JSON.parse(textoActual);
const rutas = cfg.routes;

// ── clasificación exacta de Static Web Apps: gana la PRIMERA regla que coincide ──
function coincide(regla, ruta) {
  if (regla === ruta) return true;
  if (regla.endsWith("/*")) return ruta === regla.slice(0, -2) || ruta.startsWith(regla.slice(0, -1));
  return false;
}
function clasificar(ruta) {
  for (const r of rutas) if (coincide(r.route, ruta)) return r.allowedRoles && r.allowedRoles.length ? "admin" : "publica";
  return "publica"; // sin regla: Static Web Apps la deja abierta
}

// Functions reales (route de function.json)
const funciones = fs.readdirSync(__dirname).filter((d) => fs.existsSync(path.join(__dirname, d, "function.json"))).map((d) => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, d, "function.json"), "utf8"));
  const b = j.bindings.find((x) => x.type === "httpTrigger");
  return { carpeta: d, route: b.route };
});

check("el archivo de configuración es EXACTAMENTE lo que genera api/rutas-publicas.js (nada editado a mano)", generar(cfg, publicas) === textoActual, "corre `node tools/generar-rutas.js`");
check("hay Functions que revisar", funciones.length > 100, String(funciones.length));

const rutasPublicas = publicas.map((p) => p.ruta);
check("sin rutas repetidas en la lista pública", new Set(rutasPublicas).size === rutasPublicas.length);
check("cada ruta pública tiene su motivo escrito", publicas.every((p) => typeof p.motivo === "string" && p.motivo.length > 10));
const reales = new Set(funciones.map((f) => f.route));
const huerfanas = rutasPublicas.filter((r) => !reales.has(r));
check("cada ruta pública corresponde a una Function que existe (sin huérfanas)", huerfanas.length === 0, huerfanas.join(", "));

// el comodín cierra todo lo demás
const apiRutas = rutas.filter((r) => r.route.startsWith("/api/"));
const iComodin = apiRutas.findIndex((r) => r.route === "/api/*");
check("existe la regla /api/* solo admin", iComodin >= 0 && apiRutas[iComodin].allowedRoles.length === 1 && apiRutas[iComodin].allowedRoles[0] === "admin");
check("el comodín /api/* es la ÚLTIMA regla de /api (si no, se comería a las públicas o quedaría sin efecto)", iComodin === apiRutas.length - 1);
check("las reglas de /api antes del comodín son solo las públicas, sin rol", apiRutas.slice(0, iComodin).every((r) => !r.allowedRoles) && apiRutas.slice(0, iComodin).length === publicas.length);
check("/admin y /admin/* siguen siendo solo admin", ["/admin", "/admin/*"].every((p) => { const r = rutas.find((x) => x.route === p); return r && r.allowedRoles && r.allowedRoles.includes("admin"); }));

// resultado real por Function: públicas abiertas, todo lo demás cerrado
const abiertas = funciones.filter((f) => clasificar("/api/" + f.route) === "publica").map((f) => f.route).sort();
check("las ÚNICAS Functions abiertas son exactamente las de la lista pública", JSON.stringify(abiertas) === JSON.stringify([...rutasPublicas].sort()), "abiertas de más/menos: " + JSON.stringify(abiertas.filter((r) => !rutasPublicas.includes(r)).concat(rutasPublicas.filter((r) => !abiertas.includes(r)))));
check("TODAS las demás Functions quedan cerradas (solo admin)", funciones.filter((f) => !rutasPublicas.includes(f.route)).every((f) => clasificar("/api/" + f.route) === "admin"));

// la propiedad clave: una Function que se agregue mañana y nadie liste NO queda pública
check("una Function inventada ('/api/nuevaFunctionDeAdmin') nace CERRADA", clasificar("/api/nuevaFunctionDeAdmin") === "admin");
check("incluso con subruta ('/api/x/y') nace cerrada", clasificar("/api/x/y") === "admin");
check("una pública sí es pública ('/api/crearSolicitudPublica')", clasificar("/api/crearSolicitudPublica") === "publica");
check("una de admin de siempre está cerrada ('/api/listClientesAdmin')", clasificar("/api/listClientesAdmin") === "admin");
check("buscarClientes (la que sacaba la cartera) está cerrada", clasificar("/api/buscarClientes") === "admin");
check("getInstructores ya no es pública (ninguna página pública la usa)", clasificar("/api/getInstructores") === "admin");
check("las páginas públicas siguen sin rol (reescrituras)", ["/in-company", "/cursos", "/encuesta", "/diagnostico", "/propuesta/abc", "/verificar/abc", "/reporte/abc"].every((p) => clasificar(p) === "publica"));
check("/admin está cerrado", clasificar("/admin") === "admin" && clasificar("/admin/index.html") === "admin");

// tamaño: ya no se acerca al tope de 20 KB
check("el archivo de rutas pesa mucho menos del tope de 20 KB de Azure (< 6 KB)", Buffer.byteLength(textoActual) < 6 * 1024, String(Buffer.byteLength(textoActual)));

// las cabeceras de seguridad y el redirect de login siguen
check("siguen las cabeceras de seguridad", cfg.globalHeaders && cfg.globalHeaders["X-Content-Type-Options"] === "nosniff" && cfg.globalHeaders["X-Frame-Options"] === "SAMEORIGIN");
check("sigue la redirección al login cuando falta sesión (401 → /.auth/login/aad)", cfg.responseOverrides && cfg.responseOverrides["401"] && /\/\.auth\/login\/aad/.test(cfg.responseOverrides["401"].redirect));

// los workflows de cron llaman a Functions que SÍ están abiertas
const wfDir = path.join(__dirname, "..", ".github", "workflows");
const llamadas = new Set();
for (const f of fs.readdirSync(wfDir)) {
  const t = fs.readFileSync(path.join(wfDir, f), "utf8");
  for (const m of t.matchAll(/\/api\/([A-Za-z]+)/g)) llamadas.add(m[1]);
}
const cerradasLlamadasPorCron = [...llamadas].filter((r) => clasificar("/api/" + r) !== "publica");
check("las Functions que llaman los cron de GitHub Actions están abiertas (si no, los cron fallarían con 401)", llamadas.size > 0 && cerradasLlamadasPorCron.length === 0, cerradasLlamadasPorCron.join(", "));

// las páginas públicas solo llaman a Functions abiertas (si no, se romperían para un visitante)
const raiz = path.join(__dirname, "..");
const paginas = fs.readdirSync(raiz).filter((f) => f.endsWith(".html"));
const rotas = [];
for (const p of paginas) {
  const t = fs.readFileSync(path.join(raiz, p), "utf8");
  for (const m of t.matchAll(/\/api\/([A-Za-z]+)/g)) if (reales.has(m[1]) && clasificar("/api/" + m[1]) !== "publica") rotas.push(p + " → " + m[1]);
}
check("ninguna página pública llama a una Function cerrada (se rompería para el visitante)", rotas.length === 0, rotas.join("; "));

if (fallos) { console.log("\n" + fallos + " prueba(s) fallaron"); process.exit(1); }
console.log("\ntest-rutas-cerradas: ok (" + publicas.length + " públicas, " + (funciones.length - publicas.length) + " cerradas por defecto)");
