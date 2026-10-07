// test-cotizacion-folio.js — folio de cotización (api/src/cotizacion-folio.js), sin red ni SQL.
const { folioNuevo, maxConsecutivo } = require("./src/cotizacion-folio");

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };

check("formato nuevo: AP26-KEME-POWERBI-01", folioNuevo({ yy: "26", codigoCliente: "KEME", herramienta: "powerbi", consecutivo: 1 }) === "AP26-KEME-POWERBI-01");
check("el número pasa de 2 dígitos sin cortarse", folioNuevo({ yy: "26", codigoCliente: "KEME", herramienta: "excel", consecutivo: 112 }) === "AP26-KEME-EXCEL-112");
check("código y herramienta se limpian y suben a mayúsculas", folioNuevo({ yy: "26", codigoCliente: "ke-me", herramienta: "power automate", consecutivo: 3 }) === "AP26-KEME-POWERAUTOMATE-03");
check("el folio más largo posible cabe en NVARCHAR(40)", folioNuevo({ yy: "26", codigoCliente: "EMPRESA999", herramienta: "powerautomate", consecutivo: 12 }).length <= 40);

check("sin folios previos arranca en 0 (el primero será el 1)", maxConsecutivo([], "26") === 0);
check("lee el formato viejo (_26-3)", maxConsecutivo(["AP_EXCEL_KEM_26-3"], "26") === 3);
check("lee el formato nuevo (…-07)", maxConsecutivo(["AP26-KEME-EXCEL-07"], "26") === 7);
check("mezcla viejo y nuevo: toma el mayor", maxConsecutivo(["AP_EXCEL_KEM_26-2", "AP26-KEM-POWERBI-05", "AP_POWERBI_KEM_26-4"], "26") === 5);
check("otro año no cuenta", maxConsecutivo(["AP_EXCEL_KEM_25-9", "AP25-KEM-EXCEL-08"], "26") === 0);
check("folios vacíos o nulos no truenan", maxConsecutivo([null, "", undefined], "26") === 0);

console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : "\nTodas las pruebas pasaron.");
process.exit(fallos ? 1 : 0);
