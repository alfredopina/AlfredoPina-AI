// test-cotizacion-grupos.js — reglas de precio por número de grupos (api/src/cotizacion-grupos.js), sin red.
const G = require("./src/cotizacion-grupos");
let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };

check("1 grupo: sin descuento por volumen", G.descuentoPorGrupos(1) === 0);
check("2 grupos: 5 %", G.descuentoPorGrupos(2) === 5);
check("3 grupos o más: 10 %", G.descuentoPorGrupos(3) === 10 && G.descuentoPorGrupos(4) === 10 && G.descuentoPorGrupos(12) === 10);
check("no se acumula con grupos chicos: gana el mayor", G.descuentoSugerido({ participantes: "5 a 10", grupos: 2 }) === 10 && G.descuentoSugerido({ participantes: "5 a 10", grupos: 1 }) === 10 && G.descuentoSugerido({ participantes: "10 a 15", grupos: 2 }) === 5 && G.descuentoSugerido({ participantes: "Más de 15", grupos: 1 }) === 0);
check("normalizarGrupos: entero 1-20 y por default 1", G.normalizarGrupos(undefined) === 1 && G.normalizarGrupos("0") === 1 && G.normalizarGrupos("3") === 3 && G.normalizarGrupos(2.6) === 3 && G.normalizarGrupos(99) === 20);
check("participantes exactos: entero 1-500 o null", G.normalizarParticipantesNum("") === null && G.normalizarParticipantesNum(12) === 12 && G.normalizarParticipantesNum(0) === null && G.normalizarParticipantesNum(900) === null);

console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : "\nTodas las pruebas pasaron.");
process.exit(fallos ? 1 : 0);
