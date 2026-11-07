// test-calificaciones.js
// Prueba local, sin red (mismo patrón que test-cliente-actividad.js): verifica
// las reglas de evaluación y la validación pura de las filas del grid de
// Calificaciones (api/src/calificaciones-calc.js).
const { parsearNumero, calcularEvaluacion, validarFilas, validarNotaGeneral, MAX_NOTA_GENERAL, FASES_CALIFICABLES } = require("./src/calificaciones-calc");

let failures = 0;
function check(nombre, condicion) {
  if (condicion) {
    console.log(`  OK ${nombre}`);
  } else {
    failures++;
    console.log(`  FALLÓ ${nombre}`);
  }
}
const ev = (proyecto, asistencias, frecuencias, puntos = 0) => calcularEvaluacion({ proyecto, asistencias, frecuencias, puntos });

// 1) Reglas de calificación y resultado
{
  const r = ev(90, 5, 5, 6);
  check("ejemplo de Alfredo: proyecto 90, 5/5, 6 puntos = 98", r.calificacion === 98 && r.resultado === "Aprobado" && !r.excede100);
}
{
  const r = ev(75, 5, 5);
  check("proyecto 75 + asistencia completa = calificación 80.0, pero el proyecto no llega a 80 → Participó (regla 2026-11-07)", r.calificacion === 80 && r.resultado === "Participó" && !r.cumpleProyecto && r.cumpleAsistencia);
}
{
  const r = ev(80, 4, 5);
  check("proyecto exactamente 80 y asistencia exactamente 80% → Aprobado (umbrales inclusivos)", r.resultado === "Aprobado" && r.cumpleProyecto && r.cumpleAsistencia);
}
{
  const r = ev(100, 2, 7);
  check("el caso real: proyecto 100 con ~29% de asistencia (faltó a casi todo) → Participó, no Aprobado", r.calificacion === 85.7 && r.resultado === "Participó" && r.cumpleProyecto && !r.cumpleAsistencia);
}
{
  const r = ev(100, 3, 10);
  check("proyecto 100 con 30% de asistencia → Participó (el proyecto solo ya no aprueba)", r.resultado === "Participó");
}
{
  const r = ev(76, 5, 5, 4);
  check("opción B: proyecto 76 + 4 puntos = 80 cumple el proyecto → Aprobado con asistencia completa", r.resultado === "Aprobado" && r.cumpleProyecto);
}
{
  const r = ev(76, 5, 5, 3.9);
  check("proyecto 76 + 3.9 puntos = 79.9 NO cumple el proyecto → Participó", r.resultado === "Participó" && !r.cumpleProyecto);
}
{
  const r = ev(79.9, 5, 5, 0.1);
  check("79.9 + 0.1 puntos = 80.0 exacto (sin error de coma flotante) → Aprobado", r.resultado === "Aprobado");
}
{
  const r = ev(100, 3, 10, 50);
  check("los puntos extra NUNCA compensan la asistencia: 100 + 50 puntos con 30% → Participó", r.resultado === "Participó" && !r.cumpleAsistencia);
}
{
  const r = ev(0, 5, 5);
  check("asistió todo pero no entregó proyecto (capturado como 0) → Participó", r.resultado === "Participó" && r.cumpleAsistencia && !r.cumpleProyecto);
}
{
  const r = ev(70, 2, 5);
  check("ni asistencia (40%) ni proyecto (70) → No Aprobado", r.resultado === "No Aprobado");
}
{
  const r = ev(74, 5, 5);
  check("proyecto 74 + 5/5 = 79.2 → no aprueba; asistencia 100% → Participó", r.calificacion === 79.2 && r.resultado === "Participó");
}
{
  const r = ev(60, 4, 5);
  check("asistencia exactamente 80% (4/5) sin aprobar → Participó (umbral inclusivo)", r.asistenciaPct === 80 && r.resultado === "Participó");
}
{
  const r = ev(60, 3, 5);
  check("asistencia 60% sin aprobar → No Aprobado", r.asistenciaPct === 60 && r.resultado === "No Aprobado");
}
{
  const r = ev(95, 3, 5);
  check("ya NO se aprueba solo con el proyecto: 95 con 60% de asistencia = calificación 88 → Participó", r.calificacion === 88 && r.resultado === "Participó" && !r.cumpleAsistencia);
}
{
  const r = ev(100, 5, 5, 5);
  check("puntos extra: 105 sin topar y marca excede100", r.calificacion === 105 && r.excede100 === true);
}
{
  const r = ev(100, 5, 5, 0);
  check("exactamente 100 NO marca excede100", r.calificacion === 100 && r.excede100 === false);
}
{
  const r = ev(85.5, 7, 9, 2.5);
  check("decimales y asistencia no entera: 85.5, 7/9, 2.5 pts = 68.4 + 15.6 + 2.5 = 86.5", r.calificacion === 86.5 && r.asistenciaPct === 77.8);
}
{
  const r = ev(0, 0, 5);
  check("todo en cero → No Aprobado, calificación 0", r.calificacion === 0 && r.resultado === "No Aprobado");
}

// 2) Números
check("proyecto '85%' → 85", parsearNumero("85%", { min: 0, max: 100, pct: true }).valor === 85);
check("proyecto '87,6' → 87.6 (coma decimal)", parsearNumero("87,6", { min: 0, max: 100, pct: true }).valor === 87.6);
check("proyecto 0.85 sin % se rechaza (fracción)", !!parsearNumero("0.85", { min: 0, max: 100, pct: true }).error);
check("proyecto 101 se rechaza", !!parsearNumero("101", { min: 0, max: 100, pct: true }).error);
check("asistencias decimal se rechaza (entero)", !!parsearNumero("3.5", { entero: true, min: 0 }).error);
check("frecuencias 0 se rechaza (mínimo 1)", !!parsearNumero("0", { entero: true, min: 1 }).error);
check("vacío se rechaza", !!parsearNumero("", { entero: true }).error);
check("texto se rechaza", !!parsearNumero("alto", { entero: true }).error);

// 3) Filas
const base = { puntos: "", asistencias: "5", frecuencias: "5", proyecto: "90" };
{
  const { filas, errores } = validarFilas([
    { ...base, nombreCompleto: "  José   Pérez ", correo: "jose@acme.com", puntos: "6", notas: "Muy buen proyecto" },
    { nombreCompleto: "", correo: "", puntos: "", asistencias: "", frecuencias: "", proyecto: "", notas: "" },
    { ...base, nombreCompleto: "Ana Ruiz", proyecto: "70", asistencias: "4" },
  ]);
  check("2 filas válidas, la vacía del grid se ignora", filas.length === 2 && errores.length === 0);
  check("nombre limpio, en MAYÚSCULAS con acentos, y correo conservado", filas[0].nombreCompleto === "JOSÉ PÉREZ" && filas[0].correo === "jose@acme.com");
  check("la ñ también sube a mayúscula", validarFilas([{ ...base, nombreCompleto: "luis muñoz" }]).filas[0].nombreCompleto === "LUIS MUÑOZ");
  check("evaluación calculada en la fila (98 Aprobado)", filas[0].calificacion === 98 && filas[0].resultado === "Aprobado");
  check("puntos vacío = 0; correo vacío = null", filas[1].puntos === 0 && filas[1].correo === null);
  check("notas conservadas", filas[0].notas === "Muy buen proyecto" && filas[1].notas === null);
  check("Ana: 56 + 16 = 72, asistencia 80% → Participó", filas[1].calificacion === 72 && filas[1].resultado === "Participó");
}
{
  const { filas, errores } = validarFilas([
    { ...base, nombreCompleto: "José Pérez" },
    { ...base, nombreCompleto: "jose perez" },
  ]);
  check("mismo alumno sin acentos/mayúsculas = repetido", filas.length === 1 && errores.length === 1 && /repetida/.test(errores[0]));
}
{
  const { filas, errores } = validarFilas([
    { ...base, nombreCompleto: "Luis", correo: "sin-arroba" },
    { ...base, nombreCompleto: "Marta", asistencias: "6" },
    { ...base, nombreCompleto: "", proyecto: "50" },
    { ...base, nombreCompleto: "Pedro", proyecto: "" },
    { ...base, nombreCompleto: "Rosa", frecuencias: "0" },
  ]);
  check("correo sin formato se señala", errores.some((e) => /Fila 1/.test(e) && /correo/.test(e)));
  check("asistencias > frecuencias se señala", errores.some((e) => /Fila 2/.test(e) && /mayor que frecuencias/.test(e)));
  check("falta nombre se señala", errores.some((e) => /Fila 3/.test(e) && /nombre/.test(e)));
  check("falta proyecto se señala", errores.some((e) => /Fila 4/.test(e) && /proyecto/.test(e)));
  check("frecuencias 0 se señala", errores.some((e) => /Fila 5/.test(e) && /frecuencias/.test(e)));
  check("ninguna fila inválida pasa", filas.length === 0);
}
{
  const { errores } = validarFilas([
    { ...base, nombreCompleto: "Uno", frecuencias: "5" },
    { ...base, nombreCompleto: "Dos", frecuencias: "6" },
  ]);
  check("frecuencias distintas entre filas es error de grupo", errores.some((e) => /Frecuencias distintas/.test(e)));
}
{
  const { errores } = validarFilas([{ ...base, nombreCompleto: "Largo", notas: "x".repeat(501) }]);
  check("notas de más de 500 caracteres se rechazan", errores.some((e) => /notas/.test(e)));
}
check("entrada que no es arreglo → sin filas", validarFilas(null).filas.length === 0);

// 4) Nota general (del grupo, no del alumno)
check("nota general vacía → null", validarNotaGeneral("").valor === null);
check("nota general solo espacios → null", validarNotaGeneral("   ").valor === null);
check("nota general normal → recortada y conservada", validarNotaGeneral("  Buen grupo, muy participativo.  ").valor === "Buen grupo, muy participativo.");
check("nota general al límite exacto pasa", !validarNotaGeneral("x".repeat(MAX_NOTA_GENERAL)).error);
check("nota general de más del límite se rechaza", !!validarNotaGeneral("x".repeat(MAX_NOTA_GENERAL + 1)).error);

// 5) Fases
check("Por iniciar y Cerrado no se califican", !FASES_CALIFICABLES.includes("Por iniciar") && !FASES_CALIFICABLES.includes("Cerrado"));
check("En curso a Diplomas sí", ["En curso", "Proyecto", "Calificaciones", "Diplomas"].every((f) => FASES_CALIFICABLES.includes(f)));

if (failures) {
  console.log(`\n${failures} prueba(s) fallaron.`);
  process.exit(1);
}
console.log("\nTodas las pruebas pasaron.");
