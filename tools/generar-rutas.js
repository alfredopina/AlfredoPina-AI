// tools/generar-rutas.js
// Genera la sección de rutas de /api en staticwebapp.config.json a partir de la ÚNICA lista de Functions públicas (api/rutas-publicas.js).
// Orden de las reglas (Static Web Apps aplica la PRIMERA que coincide):
//   1) reescrituras de páginas públicas (/cursos, /propuesta/*, …)      → se conservan tal cual del archivo actual
//   2) las Functions públicas, una por una, sin rol                      → lo único abierto de /api
//   3) /api/*  solo admin  (comodín, SIEMPRE al final de las de /api)    → todo lo demás nace cerrado
//   4) /admin y /admin/*  solo admin
// Uso:  node tools/generar-rutas.js          (reescribe staticwebapp.config.json)
//       node tools/generar-rutas.js --check  (no escribe; sale con error si el archivo no coincide con la lista)
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const ARCHIVO = path.join(RAIZ, "staticwebapp.config.json");

function generar(cfg, publicas) {
  const reescrituras = cfg.routes.filter((r) => !r.route.startsWith("/api/") && !r.route.startsWith("/admin"));
  const rutas = [
    ...reescrituras,
    ...publicas.map((p) => ({ route: "/api/" + p.ruta })),
    { route: "/api/*", allowedRoles: ["admin"] },
    { route: "/admin", allowedRoles: ["admin"] },
    { route: "/admin/*", allowedRoles: ["admin"] },
  ];
  const salida = {};
  for (const [k, v] of Object.entries(cfg)) salida[k] = k === "routes" ? rutas : v;
  // el arreglo de roles en una línea, como estaba el archivo
  return JSON.stringify(salida, null, 2).replace(/\[\n\s+("admin")\n\s+\]/g, "[$1]") + "\n";
}

function leer() {
  return JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
}

module.exports = { generar, ARCHIVO };

if (require.main === module) {
  const publicas = require("../api/rutas-publicas");
  const texto = generar(leer(), publicas);
  if (process.argv.includes("--check")) {
    const actual = fs.readFileSync(ARCHIVO, "utf8").replace(/\r\n/g, "\n");
    if (actual !== texto) { console.error("staticwebapp.config.json NO coincide con api/rutas-publicas.js: corre `node tools/generar-rutas.js`."); process.exit(1); }
    console.log("staticwebapp.config.json coincide con api/rutas-publicas.js");
  } else {
    fs.writeFileSync(ARCHIVO, texto);
    console.log("staticwebapp.config.json regenerado: " + publicas.length + " Functions públicas, el resto de /api cerrado (" + Math.round(texto.length / 102.4) / 10 + " KB).");
  }
}
