// tools/publicar-calendario.js
// Publica A MANO la foto del calendario de Cursos Abiertos (mientras el botón «Publicar calendario» del admin no exista).
// Lee un archivo JSON con la forma de assets/data/cursos-abiertos-ejemplo.json, lo valida con la MISMA lista blanca que usa el sitio
// (api/src/calendario-abiertos.js) y lo escribe en Table Storage (tabla CalendarioAbiertos) junto con el contador de lugares de cada grupo.
//
// Uso (desde la raíz del repo):
//   node tools/publicar-calendario.js mi-calendario.json --dry     solo valida y muestra qué publicaría (no escribe nada)
//   node tools/publicar-calendario.js mi-calendario.json           publica
// Necesita la cadena de conexión del Storage en la variable RECURSOS_STORAGE_CONNECTION (la misma que usan las Functions); se pega en la
// terminal, nunca en un archivo del repo:
//   PowerShell:  $env:RECURSOS_STORAGE_CONNECTION = "<cadena>"
// Publicar no despierta la base SQL. Republicar NO pisa los lugares ya reservados por el público (el contador se conserva).
const fs = require("fs");
const path = require("path");
const cal = require("../api/src/calendario-abiertos");

const archivo = process.argv[2];
const dry = process.argv.includes("--dry");
if (!archivo) { console.error("Falta el archivo JSON. Ejemplo: node tools/publicar-calendario.js mi-calendario.json --dry"); process.exit(1); }

(async () => {
  const crudo = JSON.parse(fs.readFileSync(path.resolve(archivo), "utf8"));
  const { foto, errores } = cal.limpiarFoto(crudo);
  console.log("Grupos que se publicarían: " + foto.grupos.length + (foto.ejemplo ? "  (marcados como EJEMPLO en la página)" : ""));
  foto.grupos.forEach((g) => console.log("  · " + g.codigo + " — " + g.programa_nombre + " — " + (g.sesiones.length ? new Intl.DateTimeFormat("es-MX", { timeZone: "America/Monterrey", dateStyle: "medium" }).format(new Date(g.sesiones[0].inicio)) : g.mes_estimado || "sin fecha") + " — cupo " + g.cupo_total));
  if (errores.length) { console.error("\nERRORES (nada se publica hasta corregirlos):\n  - " + errores.join("\n  - ")); process.exit(1); }
  if (dry) { console.log("\n--dry: no se escribió nada."); return; }
  if (!process.env.RECURSOS_STORAGE_CONNECTION) { console.error("\nFalta RECURSOS_STORAGE_CONNECTION (ver el encabezado de este archivo)."); process.exit(1); }
  const r = await cal.guardarFoto(cal.getTable(), crudo);
  console.log("\nPublicado: " + r.grupos + " grupo(s) a las " + r.publicadoEn + ". La página /cursos-abiertos ya los muestra (el caché dura hasta 30 s).");
})().catch((e) => { console.error(e.safe ? e.message : e); process.exit(1); });
