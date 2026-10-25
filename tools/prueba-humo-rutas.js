// tools/prueba-humo-rutas.js — prueba de humo de las reglas de rutas CONTRA UN SITIO REAL (vista previa de un PR o producción).
// Comprueba, sin iniciar sesión y SIN efectos secundarios, que:
//   · las páginas públicas abren (200) y /admin pide iniciar sesión (302 al login),
//   · TODAS las Functions de admin están cerradas (la plataforma responde 302 al login) y las 26 públicas NO lo están,
//   · una Function inventada que no existe también queda cerrada (es el comodín /api/*: lo que garantiza que una nueva nace cerrada),
//   · las lecturas públicas de catálogo responden 200 con datos,
//   · las cabeceras de seguridad llegan.
// Cómo no toca nada: a las Functions les manda el método DELETE, que ninguna declara; si la plataforma las deja pasar, el host de Functions
// responde 404/405 sin ejecutarlas. Solo hace GET reales a páginas estáticas y a 4 lecturas públicas de solo lectura.
// Uso:  node tools/prueba-humo-rutas.js https://www.alfredopina.ai
//       node tools/prueba-humo-rutas.js https://<vista-previa>.azurestaticapps.net
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const base = (process.argv[2] || "").replace(/\/+$/, "");
if (!/^https:\/\//.test(base)) { console.error("Uso: node tools/prueba-humo-rutas.js https://sitio"); process.exit(2); }

const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, "staticwebapp.config.json"), "utf8"));
const publicas = new Set(require("../api/rutas-publicas").map((p) => p.ruta));
const apiDir = path.join(RAIZ, "api");
const funciones = fs.readdirSync(apiDir).filter((d) => fs.existsSync(path.join(apiDir, d, "function.json"))).map((d) => {
  const j = JSON.parse(fs.readFileSync(path.join(apiDir, d, "function.json"), "utf8"));
  return j.bindings.find((b) => b.type === "httpTrigger").route;
});

const fallas = [];
let ok = 0;
function resultado(nombre, bien, detalle) {
  if (bien) ok++; else { fallas.push(nombre + (detalle ? "  → " + detalle : "")); console.log("  FALLA " + nombre + (detalle ? "  → " + detalle : "")); }
}

async function pedir(ruta, opciones = {}) {
  try {
    const res = await fetch(base + ruta, { redirect: "manual", ...opciones });
    return { status: res.status, location: res.headers.get("location") || "", tipo: res.headers.get("content-type") || "", headers: res.headers, res };
  } catch (e) {
    return { status: 0, location: "", tipo: "", error: e.message };
  }
}
// La plataforma cierra una ruta de admin respondiendo 401 → 302 al login de Entra (responseOverrides).
const bloqueadaPorPlataforma = (r) => (r.status === 302 && /\/\.auth\/login/.test(r.location)) || r.status === 401 || r.status === 403;

async function enLotes(items, tam, fn) {
  for (let i = 0; i < items.length; i += tam) await Promise.all(items.slice(i, i + tam).map(fn));
}

(async () => {
  console.log("Prueba de humo contra " + base + "\n");

  console.log("1) Páginas públicas");
  const paginas = ["/", "/robots.txt", "/sitemap.xml", ...cfg.routes.filter((r) => r.rewrite).map((r) => r.route.replace("/*", "/abc"))];
  await enLotes([...new Set(paginas)], 8, async (p) => {
    const r = await pedir(p);
    resultado("página pública " + p + " abre (200)", r.status === 200, "status " + r.status + (r.location ? " → " + r.location : r.error ? " " + r.error : ""));
  });

  // Redirecciones permanentes de la config (p. ej. /cursos → /in-company): deben responder 301 al destino, sin pasar por un 404
  for (const rd of cfg.routes.filter((r) => r.redirect)) {
    const r = await pedir(rd.route);
    resultado("redirección " + rd.route + " → " + rd.redirect + " (" + (rd.statusCode || 302) + ")", r.status === (rd.statusCode || 302) && r.location.replace(/^https?:\/\/[^/]+/, "") === rd.redirect, "status " + r.status + " → " + r.location);
  }

  console.log("2) /admin pide iniciar sesión");
  for (const p of ["/admin", "/admin/", "/admin/index.html"]) {
    const r = await pedir(p);
    resultado(p + " cerrada (302 al login)", bloqueadaPorPlataforma(r), "status " + r.status);
  }

  console.log("3) Functions de /api: " + funciones.length + " reales (" + publicas.size + " públicas esperadas, el resto cerradas)");
  await enLotes(funciones, 10, async (ruta) => {
    const r = await pedir("/api/" + ruta, { method: "DELETE" });
    if (publicas.has(ruta)) resultado("pública /api/" + ruta + " NO está bloqueada por la plataforma", !bloqueadaPorPlataforma(r) && r.status !== 0, "status " + r.status + (r.location ? " → " + r.location : ""));
    else resultado("cerrada /api/" + ruta + " (302 al login)", bloqueadaPorPlataforma(r), "status " + r.status + " (¡quedó abierta!)");
  });

  console.log("4) Una Function nueva nace cerrada");
  const inventada = await pedir("/api/zzFunctionQueNoExiste", { method: "DELETE" });
  resultado("/api/zzFunctionQueNoExiste (no existe) responde cerrada, no 404 abierto", bloqueadaPorPlataforma(inventada), "status " + inventada.status);

  console.log("5) Lecturas públicas reales (solo lectura)");
  for (const [ruta, minimo] of [["/api/getCatalogoCursos?herramienta=excel", 2], ["/api/getCatalogoRecursos", 2], ["/api/availability", 2], ["/api/getPreguntasDiagnostico?herramienta=excel", 2], ["/api/getPreguntasEncuesta", 2]]) {
    const r = await pedir(ruta);
    let cuerpo = "";
    try { cuerpo = r.res ? await r.res.text() : ""; } catch (e) { /* sin cuerpo */ }
    resultado(ruta + " responde 200 con datos", r.status === 200 && cuerpo.length >= minimo, "status " + r.status + ", " + cuerpo.length + " bytes");
  }
  const cerradaLectura = await pedir("/api/getInstructores");
  resultado("/api/getInstructores (cerrada a propósito) pide sesión", bloqueadaPorPlataforma(cerradaLectura), "status " + cerradaLectura.status);
  const buscar = await pedir("/api/buscarClientes?q=a");
  resultado("/api/buscarClientes?q=a (la que sacaba la cartera) pide sesión", bloqueadaPorPlataforma(buscar), "status " + buscar.status);

  console.log("6) Cabeceras de seguridad en la portada");
  const portada = await pedir("/");
  const h = portada.headers;
  resultado("X-Content-Type-Options: nosniff", h && h.get("x-content-type-options") === "nosniff");
  resultado("X-Frame-Options: SAMEORIGIN", h && h.get("x-frame-options") === "SAMEORIGIN");
  resultado("Referrer-Policy", h && /strict-origin-when-cross-origin/.test(h.get("referrer-policy") || ""));
  resultado("Strict-Transport-Security", h && /max-age=\d+/.test(h.get("strict-transport-security") || ""));

  const total = ok + fallas.length;
  console.log("\n" + ok + " de " + total + " comprobaciones en orden" + (fallas.length ? " · " + fallas.length + " FALLARON:" : ""));
  fallas.forEach((f) => console.log("  - " + f));
  process.exit(fallas.length ? 1 : 0);
})();
