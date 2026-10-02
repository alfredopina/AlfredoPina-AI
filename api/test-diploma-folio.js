// test-diploma-folio.js
// Prueba local, sin red: nivelTexto (api/src/diploma-folio.js) — con varios
// niveles seleccionados debe nombrarlos TODOS, no solo el más alto (bug real:
// un grupo [1,3] salía "Avanzado" en el diploma, como si nunca hubiera tenido
// nivel Básico).
const { nivelTexto } = require("./src/diploma-folio");

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };

check("un solo nivel", nivelTexto("[2]") === "Intermedio");
check("dos niveles no consecutivos: nombra los dos, con 'y'", nivelTexto("[1,3]") === "Básico y Avanzado");
check("Básico + Intermedio usa 'e' (gramática: 'y' ante palabra con 'i')", nivelTexto("[1,2]") === "Básico e Intermedio");
check("Intermedio + Avanzado sigue con 'y'", nivelTexto("[2,3]") === "Intermedio y Avanzado");
check("los 3 niveles: lista completa con comas y 'y' final", nivelTexto("[1,2,3]") === "Básico, Intermedio y Avanzado");
check("el orden de entrada no importa, siempre sale de menor a mayor", nivelTexto("[3,1,2]") === "Básico, Intermedio y Avanzado");
check("sin niveles: Básico por default", nivelTexto("[]") === "Básico");
check("JSON inválido o nulo: Básico por default, no truena", nivelTexto(null) === "Básico" && nivelTexto("no-es-json") === "Básico");
check("niveles repetidos no se duplican en el texto", nivelTexto("[1,1,3]") === "Básico y Avanzado");

console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : "\nTodas las pruebas pasaron.");
process.exit(fallos ? 1 : 0);
