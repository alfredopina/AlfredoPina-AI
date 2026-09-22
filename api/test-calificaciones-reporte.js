// test-calificaciones-reporte.js
// Prueba local, sin red (mismo patrón que test-encuesta-reporte.js): verifica
// el cálculo puro del snapshot del Reporte de Resultados
// (api/src/calificaciones-reporte-calc.js) con filas fijas, sin depender de SQL.
const { calcularSnapshot, semaforoDe } = require("./src/calificaciones-reporte-calc");

let failures = 0;
function check(nombre, condicion) {
  if (condicion) {
    console.log(`  OK ${nombre}`);
  } else {
    failures++;
    console.log(`  FALLÓ ${nombre}`);
  }
}

// fila cruda tal como la devuelve leerCalificacionesFiltradas
function fila(over) {
  return {
    id: 1, grupo_id: 1, puntos: 0, asistencias: 5, frecuencias: 5, proyecto: 90, calificacion: 90, resultado: "Aprobado",
    notas: null, nota_general: null, fecha_carga: "2026-09-21T15:00:00Z",
    alumno: "José Pérez", correo: "jose@acme.com",
    nombre_curso: "Excel Intermedio", herramientas: '["excel"]', instructor: "Alfredo Piña", modalidad: "Online",
    fecha_inicio: "2026-08-10T00:00:00Z", fecha_fin: "2026-09-07T00:00:00Z",
    cliente: "Capacitanet", cliente_codigo: "CAPA", cliente_final: "Follatti Casinos", cliente_final_codigo: "KEME",
    ...over,
  };
}

// semáforo
check("semáforo verde en 80", semaforoDe(80) === "verde");
check("semáforo ámbar en 79.9", semaforoDe(79.9) === "ambar");
check("semáforo rojo en 0 exacto", semaforoDe(0) === "rojo");
check("semáforo ámbar en un valor bajo pero no cero (no confundir con rojo)", semaforoDe(15) === "ambar");

// un solo grupo, 3 alumnos
{
  const filas = [
    fila({ id: 1, alumno: "José Pérez", calificacion: 90, resultado: "Aprobado", asistencias: 5, frecuencias: 5 }),
    fila({ id: 2, alumno: "Ana Ruiz", calificacion: 60, resultado: "Participó", asistencias: 4, frecuencias: 5, correo: null }),
    fila({ id: 3, alumno: "Luis Mora", calificacion: 0, resultado: "No Aprobado", asistencias: 0, frecuencias: 5 }),
  ];
  const s = calcularSnapshot({ filas, filtros: {}, etiqueta: "Prueba", ahora: new Date("2026-09-22T10:00:00Z") });
  check("n = 3", s.n === 3);
  check("nGrupos = 1", s.nGrupos === 1);
  check("conteos por resultado", s.aprobados === 1 && s.participaron === 1 && s.noAprobados === 1);
  check("promedio de calificación = 50", s.promedioCalificacion === 50);
  check("asistencia global = 9/15 = 60%", s.asistenciaPct === 60);
  check("porGrupo trae 1 fila con el resumen del grupo", s.porGrupo.length === 1 && s.porGrupo[0].alumnos === 3 && s.porGrupo[0].cliente === "Follatti Casinos");
  check("porGrupo.clienteVia = cliente que contrató", s.porGrupo[0].clienteVia === "Capacitanet");
  check("mejores trae a José primero", s.mejores[0].nombre === "José Pérez");
  check("bajoOchenta incluye a Ana y Luis, no a José", s.bajoOchenta.length === 2 && !s.bajoOchenta.some(p => p.nombre === "José Pérez"));
  check("cada participante trae su semáforo", s.participantes.find(p => p.nombre === "Luis Mora").semaforo === "rojo");
  check("correo se conserva cuando existe y es null cuando no", s.participantes.find(p => p.nombre === "José Pérez").correo === "jose@acme.com" && s.participantes.find(p => p.nombre === "Ana Ruiz").correo === null);
  check("etiqueta y filtros se guardan tal cual", s.etiqueta === "Prueba" && JSON.stringify(s.filtros) === "{}");
}

// dos grupos, calificación >100 con puntos extra (se topa a 100 en el promedio, no en el detalle)
{
  const filas = [
    fila({ id: 1, grupo_id: 1, alumno: "Pedro Sol", calificacion: 105, resultado: "Aprobado", cliente_final: null, cliente: "Acme SA" }),
    fila({ id: 2, grupo_id: 2, alumno: "Marta Díaz", calificacion: 40, resultado: "No Aprobado", asistencias: 2, frecuencias: 5, cliente_final: null, cliente: "Delta", nombre_curso: "Power BI Total", herramientas: '["powerbi"]' }),
  ];
  const s = calcularSnapshot({ filas, filtros: { empresa: "a" }, ahora: new Date() });
  check("nGrupos = 2", s.nGrupos === 2);
  check("promedio topa el 105 a 100 antes de promediar: (100+40)/2=70", s.promedioCalificacion === 70);
  check("el detalle del participante conserva 105 sin topar", s.participantes.find(p => p.nombre === "Pedro Sol").calificacion === 105);
  check("excede100 marcado solo en quien lo excede", s.participantes.find(p => p.nombre === "Pedro Sol").excede100 === true && s.participantes.find(p => p.nombre === "Marta Díaz").excede100 === false);
  check("porGrupo trae 2 filas, una por grupo", s.porGrupo.length === 2);
}

if (failures) {
  console.log(`\n${failures} prueba(s) fallaron.`);
  process.exit(1);
}
console.log("\nTodas las pruebas pasaron.");
