// tools/build-herramientas.js
// Genera assets/js/herramientas.js: UN solo catálogo de las 6 herramientas (nombre, color de marca e
// ícono SVG de línea con currentColor) a partir de assets/img/brand/iconos/*.svg. Lo usa el admin
// (antes había ~12 copias de los íconos viejos pegadas dentro de admin/index.html). Correr:
//   node tools/build-herramientas.js
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const HERRAMIENTAS = [
  ["excel", "Excel", "#22c55e"],
  ["powerbi", "Power BI", "#f2c94c"],
  ["powerapps", "Power Apps", "#c026d3"],
  ["powerautomate", "Power Automate", "#06b6d4"],
  ["ia", "IA Aplicada", "#a78bfa"],
  ["ofimatica", "Ofimática Básica", "#f97316"],
];
function icono(id) {
  const svg = fs.readFileSync(path.join(ROOT, "assets/img/brand/iconos", id + ".svg"), "utf8").trim();
  return svg.replace(/ xmlns="[^"]*"/, "").replace(/ width="24" height="24"/, "").replace(/ role="img" aria-label="[^"]*"/, "").replace(/<title>[^<]*<\/title>/, "");
}
const out = {};
for (const [id, nombre, color] of HERRAMIENTAS) out[id] = { nombre, color, icon: icono(id) };
const js = "// GENERADO por tools/build-herramientas.js — no editar a mano.\n// Catálogo único de herramientas (nombre, color de marca, ícono). Uso: window.HERRAMIENTAS_UI.excel.icon\nwindow.HERRAMIENTAS_UI = " + JSON.stringify(out, null, 2) + ";\n";
fs.writeFileSync(path.join(ROOT, "assets/js/herramientas.js"), js);
console.log("herramientas.js generado (" + HERRAMIENTAS.length + " herramientas)");
