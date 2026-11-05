// tools/build-herramientas.js
// Genera assets/js/herramientas.js: UN solo catálogo de las 6 herramientas (nombre, color de marca, ícono SVG
// de línea con currentColor y slug de su página en /in-company) a partir de tools/herramientas-datos.js y de
// assets/img/brand/iconos/*.svg. Lo usan el admin y Recursos (antes había ~12 copias de los íconos viejos
// pegadas dentro de admin/index.html). Correr:
//   node tools/build-herramientas.js
const fs = require("fs");
const path = require("path");
const { HERRAMIENTAS, iconoHerramienta } = require("./herramientas-datos");
const ROOT = path.join(__dirname, "..");
const out = {};
for (const h of HERRAMIENTAS) out[h.id] = { nombre: h.nombre, color: h.color, slug: h.slug, icon: iconoHerramienta(h.id) };
const js = "// GENERADO por tools/build-herramientas.js — no editar a mano.\n// Catálogo único de herramientas (nombre, color de marca, ícono, slug de su página /in-company/<slug>). Uso: window.HERRAMIENTAS_UI.excel.icon\nwindow.HERRAMIENTAS_UI = " + JSON.stringify(out, null, 2) + ";\n";
fs.writeFileSync(path.join(ROOT, "assets/js/herramientas.js"), js);
console.log("herramientas.js generado (" + HERRAMIENTAS.length + " herramientas)");
