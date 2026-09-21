// test-calificaciones.js
// Prueba local, sin red (mismo patrón que test-cliente-actividad.js): verifica
// la validación pura de las filas del grid de Calificaciones
// (api/src/calificaciones-calc.js).
const { parsearPorcentaje, validarFilas, FASES_CALIFICABLES } = require("./src/calificaciones-calc");

let failures = 0;
function check(nombre, condicion) {
  if (condicion) {
    console.log(`  OK ${nombre}`);
  } else {
    failures++;
    console.log(`  FALLÓ ${nombre}`);
  }
}

// 1) Porcentajes
check("85 → 85", parsearPorcentaje("85").valor === 85);
check("85% → 85", parsearPorcentaje("85%").valor === 85);
check("87,6 → 88 (coma decimal, redondea)", parsearPorcentaje("87,6").valor === 88);
check("0 → 0 (cero es válido)", parsearPorcentaje("0").valor === 0);
check("100 → 100", parsearPorcentaje("100").valor === 100);
check("0.85 sin % se rechaza (fracción)", !!parsearPorcentaje("0.85").error);
check("0.85% → 1 (con % sí es un porcentaje)", parsearPorcentaje("0.85%").valor === 1);
check("101 se rechaza", !!parsearPorcentaje("101").error);
check("-5 se rechaza", !!parsearPorcentaje("-5").error);
check("vacío se rechaza", !!parsearPorcentaje("").error);
check("texto se rechaza", !!parsearPorcentaje("alto").error);

// 2) Filas
{
  const { filas, errores } = validarFilas([
    { nombreCompleto: "  José   Pérez ", participacion: "90", asistencia: "100%", proyecto: "85", resultado: "Aprobado" },
    { nombreCompleto: "", participacion: "", asistencia: "", proyecto: "", resultado: "" },
    { nombreCompleto: "Ana Ruiz", participacion: "70", asistencia: "80", proyecto: "0", resultado: "Participó" },
  ]);
  check("2 filas válidas, la vacía del grid se ignora", filas.length === 2 && errores.length === 0);
  check("nombre limpio (espacios colapsados)", filas[0].nombreCompleto === "José Pérez");
  check("porcentajes numéricos", filas[0].asistencia === 100 && filas[1].proyecto === 0);
}
{
  const { filas, errores } = validarFilas([
    { nombreCompleto: "José Pérez", participacion: "90", asistencia: "90", proyecto: "90", resultado: "Aprobado" },
    { nombreCompleto: "jose perez", participacion: "90", asistencia: "90", proyecto: "90", resultado: "Aprobado" },
  ]);
  check("mismo alumno sin acentos/mayúsculas = repetido", filas.length === 1 && errores.length === 1 && /repetida/.test(errores[0]));
}
{
  const { filas, errores } = validarFilas([
    { nombreCompleto: "Luis", participacion: "90", asistencia: "90", proyecto: "90", resultado: "aprobado" },
    { nombreCompleto: "Marta", participacion: "", asistencia: "90", proyecto: "90", resultado: "Aprobado" },
    { nombreCompleto: "", participacion: "90", asistencia: "90", proyecto: "90", resultado: "Aprobado" },
  ]);
  check("resultado con otra capitalización es inválido (exacto)", errores.some((e) => /Fila 1/.test(e) && /resultado/.test(e)));
  check("falta participación se señala en su fila", errores.some((e) => /Fila 2/.test(e) && /participación/.test(e)));
  check("falta nombre se señala", errores.some((e) => /Fila 3/.test(e) && /nombre/.test(e)));
  check("ninguna fila inválida pasa", filas.length === 0);
}
check("entrada que no es arreglo → sin filas", validarFilas(null).filas.length === 0);

// 3) Fases
check("Por iniciar y Cerrado no se califican", !FASES_CALIFICABLES.includes("Por iniciar") && !FASES_CALIFICABLES.includes("Cerrado"));
check("En curso a Diplomas sí", ["En curso", "Proyecto", "Calificaciones", "Diplomas"].every((f) => FASES_CALIFICABLES.includes(f)));

if (failures) {
  console.log(`\n${failures} prueba(s) fallaron.`);
  process.exit(1);
}
console.log("\nTodas las pruebas pasaron.");
