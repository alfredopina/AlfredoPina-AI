// test-backup.js
// Prueba local, sin red (mismo patrón que test-availability.js): verifica que
// nombreArchivo/partesHoraMexico calculen bien la hora de México fija (offset
// -6, sin horario de verano). No prueba generarRespaldo completo — esa parte
// lee/escribe Table Storage y Blob Storage reales, no se puede probar sin red.
const { nombreArchivo, TABLAS } = require("./src/backup-tables");

let failures = 0;
function check(nombre, condicion) {
  if (condicion) {
    console.log(`  OK ${nombre}`);
  } else {
    failures++;
    console.log(`  FALLÓ ${nombre}`);
  }
}

// 2026-09-08T06:00:00Z (lunes 06:00 UTC, justo cuando corre el timer semanal) = 2026-09-08 00:00 hora de México (offset -6)
check(
  "Lunes 06:00 UTC -> 2026-09-08_0000_auto.json",
  nombreArchivo(new Date("2026-09-08T06:00:00Z"), "auto") === "2026-09-08_0000_auto.json"
);

// 2026-09-08T23:30:00Z = 2026-09-08 17:30 hora de México (mismo día calendario)
check(
  "Mismo día calendario en México (23:30 UTC -> 17:30 local)",
  nombreArchivo(new Date("2026-09-08T23:30:00Z"), "manual") === "2026-09-08_1730_manual.json"
);

// 2026-09-08T02:00:00Z = 2026-09-07 20:00 hora de México (cruza al día calendario anterior)
check(
  "Cruce de día calendario (02:00 UTC -> 20:00 local del día anterior)",
  nombreArchivo(new Date("2026-09-08T02:00:00Z"), "auto") === "2026-09-07_2000_auto.json"
);

check(
  "TABLAS incluye las 5 tablas esperadas",
  TABLAS.length === 5 && ["Cursos", "Recursos", "Temas", "TemariosEstandar", "Proyectos"].every((t) => TABLAS.includes(t))
);

console.log("\n" + (failures === 0 ? "TODO OK" : `${failures} verificación(es) fallida(s)`));
process.exit(failures === 0 ? 0 : 1);
