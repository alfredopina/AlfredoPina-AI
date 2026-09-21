// tools/build-iconos.js
// Genera los SVG de los 6 íconos de herramienta en assets/img/brand/iconos/.
//
// Uso (desde la raíz del repo):   node tools/build-iconos.js
// Por herramienta salen 3 archivos:
//   {tool}.svg          → hereda el color (currentColor): para el sitio, donde el CSS lo pinta
//   {tool}-claro.svg    → con la TINTA de la herramienta: para papel claro (diplomas, documentos)
//   {tool}-oscuro.svg   → con el color PURO: para fondos oscuros
//
// Reglas de la familia (ver MANUAL_IDENTIDAD.md → Íconos de herramienta): cuadrícula de 24,
// trazo de 1.75, remates cuadrados y esquinas rectas, diagonales solo a 45°, y un cuadrito
// lleno (el cuadro de autorrelleno del logo) que en cada ícono significa algo distinto.
//
// Ofimática se dibuja con formas compuestas (fill-rule evenodd), NO con máscara: PowerPoint,
// Word y los clientes de correo soportan mal las máscaras SVG.
// Nunca se editan los SVG a mano: se cambia este archivo y se vuelve a correr.

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "assets", "img", "brand", "iconos");

const HERRAMIENTAS = {
  excel: {
    nombre: "Excel", puro: "#22c55e", tinta: "#15803d",
    // un rango seleccionado con su cuadro de autorrelleno
    d: '<g stroke-width="1.25" opacity=".55"><rect x="3" y="3" width="18" height="18"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></g><rect x="9" y="9" width="12" height="12" stroke-width="2" fill="currentColor" fill-opacity=".14"/><rect x="18.5" y="18.5" width="4.5" height="4.5" fill="currentColor" stroke="none"/>',
  },
  powerbi: {
    nombre: "Power BI", puro: "#f2c94c", tinta: "#8a6a00",
    // una gráfica armada con celdas: la de arriba de cada columna va llena
    d: '<g fill="currentColor" stroke="none"><g fill-opacity=".36"><rect x="9.5" y="16" width="5" height="5"/><rect x="16" y="16" width="5" height="5"/><rect x="16" y="9.5" width="5" height="5"/></g><rect x="3" y="16" width="5" height="5"/><rect x="9.5" y="9.5" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/></g>',
  },
  powerapps: {
    nombre: "Power Apps", puro: "#c026d3", tinta: "#a21caf",
    // el tablero: una pantalla con bloques; el bloque lleno sale del marco (arrastrar y soltar)
    d: '<rect x="2.5" y="6" width="17" height="14"/><path d="M2.5 10h17" stroke-width="1.5"/><rect x="5" y="12.5" width="5" height="5" stroke-width="1.5"/><rect x="12" y="12.5" width="5" height="5" stroke-width="1.5" stroke-dasharray="1.5 1.5"/><rect x="17" y="2" width="5" height="5" fill="currentColor" stroke="none"/>',
  },
  powerautomate: {
    nombre: "Power Automate", puro: "#06b6d4", tinta: "#0e7490",
    // la bifurcación: un paso que se abre en dos caminos; termina en el cuadrito lleno
    d: '<rect x="3" y="10" width="4" height="4"/><path d="M7 12h4M11 6.75v10.75M11 6.75h4M11 17.5h4"/><rect x="15" y="4.5" width="4.5" height="4.5"/><rect x="15" y="15.25" width="4.5" height="4.5" fill="currentColor"/>',
  },
  ia: {
    nombre: "IA Aplicada", puro: "#a78bfa", tinta: "#6d3fd8",
    // la chispa de cuatro puntas con puntas rectas, rellena; el cuadrito queda hueco
    d: '<path d="M11 3l2.3 7.2 7.2 2.3-7.2 2.3L11 22l-2.3-7.2L1.5 12.5l7.2-2.3z" fill="currentColor"/><rect x="18" y="3" width="3.5" height="3.5" stroke-width="1.5"/>',
  },
  ofimatica: {
    nombre: "Ofimática Básica", puro: "#f97316", tinta: "#b8500a",
    // mosaicos de la suite con el dibujo recortado (texto, diapositiva, correo) + el cuarto hueco con el cuadrito
    d: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="' +
      "M2.5 2.5h9.5v9.5h-9.5z M4.5 5h5.5v1.2h-5.5z M4.5 7.6h5.5v1.2h-5.5z M4.5 10.2h3.5v1.2h-3.5z " +
      "M12 2.5h9.5v9.5h-9.5z M14 5h6v4.4h-6z " +
      "M2.5 12h9.5v9.5h-9.5z M4.05 14h6.4v5.2h-6.4z M5.15 15.1h4.2v3h-4.2z M5.15 15.1l2.1 1.85 2.1-1.85v1l-2.1 1.85-2.1-1.85z" +
      '"/><rect x="13" y="13" width="7.5" height="7.5" stroke-width="1.5"/><rect x="15.5" y="15.5" width="2.5" height="2.5" fill="currentColor" stroke="none"/>',
  },
};

function svg(nombre, inner, color) {
  const pintado = color === "currentColor" ? inner : inner.split("currentColor").join(color);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linejoin="miter" stroke-linecap="square" role="img" aria-label="${nombre}"><title>${nombre}</title>${pintado}</svg>\n`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let n = 0;
for (const [clave, h] of Object.entries(HERRAMIENTAS)) {
  fs.writeFileSync(path.join(OUT_DIR, `${clave}.svg`), svg(h.nombre, h.d, "currentColor"));
  fs.writeFileSync(path.join(OUT_DIR, `${clave}-claro.svg`), svg(h.nombre, h.d, h.tinta));
  fs.writeFileSync(path.join(OUT_DIR, `${clave}-oscuro.svg`), svg(h.nombre, h.d, h.puro));
  n += 3;
}
console.log(`${n} archivos en ${path.relative(process.cwd(), OUT_DIR)}`);
