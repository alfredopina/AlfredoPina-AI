// test-cliente-actividad.js
// Prueba local, sin red (mismo patrón que test-rate-limit.js): verifica la
// cadena de prioridad de calcularDiasInactivo y la regla de calcularCompletado
// (api/src/cliente-actividad.js) con fechas fijas, sin depender del reloj real.
const { calcularDiasInactivo, calcularCompletado } = require("./src/cliente-actividad");

let failures = 0;
function check(nombre, condicion) {
  if (condicion) {
    console.log(`  OK ${nombre}`);
  } else {
    failures++;
    console.log(`  FALLÓ ${nombre}`);
  }
}

const AHORA = new Date("2026-09-12T12:00:00Z");
const hace = (dias) => new Date(AHORA.getTime() - dias * 86400000).toISOString();

// 1) Nada de nada → sin interacción registrada, rojo.
{
  const r = calcularDiasInactivo({}, AHORA);
  check("Sin ningún dato: dias=null", r.dias === null);
  check("Sin ningún dato: rojo (peor caso, no neutro)", r.semaforo === "rojo");
}

// 2) Solo diploma viejo (fallback final).
{
  const r = calcularDiasInactivo({ ultimoDiplomaFecha: hace(200) }, AHORA);
  check("Solo diploma: usa su fecha", r.dias === 200);
  check("Solo diploma a 200 días: rojo", r.semaforo === "rojo");
}

// 3) Cotización cerrada hace 45 días, sin nada activo → amarillo, gana sobre el diploma más viejo.
{
  const r = calcularDiasInactivo({ cotizacionCerradaFecha: hace(45), ultimoDiplomaFecha: hace(500) }, AHORA);
  check("Cerrada gana sobre diploma cuando no hay nada activo", r.dias === 45);
  check("45 días: amarillo", r.semaforo === "amarillo");
}

// 4) Grupo activo → siempre 0 días, sin importar qué tan vieja sea la cerrada.
{
  const r = calcularDiasInactivo({ grupoActivo: true, cotizacionCerradaFecha: hace(300) }, AHORA);
  check("Grupo activo: 0 días", r.dias === 0);
  check("Grupo activo: verde", r.semaforo === "verde");
}

// 5) Cotización activa pero fría (mandada hace 40 días, nunca respondida) — NO debe leerse como "hoy".
{
  const r = calcularDiasInactivo({ cotizacionActivaFecha: hace(40) }, AHORA);
  check("Cotización activa fría: usa su fecha real, no 0", r.dias === 40);
  check("Cotización activa fría a 40 días: amarillo, no verde", r.semaforo === "amarillo");
}

// 6) Solicitud pendiente reciente (3 días) — cuenta como interacción, aunque no haya cotización todavía.
{
  const r = calcularDiasInactivo({ solicitudPendienteFecha: hace(3) }, AHORA);
  check("Solicitud pendiente reciente: 3 días, verde", r.dias === 3 && r.semaforo === "verde");
}

// 7) Cotización activa Y grupo activo a la vez → se usa la fecha MÁS RECIENTE de ambas (grupo=hoy gana).
{
  const r = calcularDiasInactivo({ cotizacionActivaFecha: hace(20), grupoActivo: true }, AHORA);
  check("Activa+grupo: gana el más reciente (grupo=hoy)", r.dias === 0);
}

// 8) Cotización activa Y solicitud pendiente: la solicitud es más vieja, la cotización manda.
{
  const r = calcularDiasInactivo({ cotizacionActivaFecha: hace(5), solicitudPendienteFecha: hace(50) }, AHORA);
  check("Activa+solicitud: gana la más reciente de las dos (5 días)", r.dias === 5);
}

// 9) Umbral exacto: 30 días es amarillo (no verde), 90 es amarillo (no rojo todavía), 91 ya es rojo.
{
  check("29 días: verde", calcularDiasInactivo({ cotizacionCerradaFecha: hace(29) }, AHORA).semaforo === "verde");
  check("30 días: amarillo", calcularDiasInactivo({ cotizacionCerradaFecha: hace(30) }, AHORA).semaforo === "amarillo");
  check("90 días: amarillo", calcularDiasInactivo({ cotizacionCerradaFecha: hace(90) }, AHORA).semaforo === "amarillo");
  check("91 días: rojo", calcularDiasInactivo({ cotizacionCerradaFecha: hace(91) }, AHORA).semaforo === "rojo");
}

// ── calcularCompletado ──

check(
  "Completado: todo presente",
  calcularCompletado({ codigo: "ACME", clienteDesde: 2020, principalCorreo: "a@a.com", principalTelefono: "8110000000" }) === true
);
check(
  "Incompleto: sin contacto principal (correo/telefono null)",
  calcularCompletado({ codigo: "ACME", clienteDesde: 2020, principalCorreo: null, principalTelefono: null }) === false
);
check(
  "Incompleto: principal con correo pero sin teléfono",
  calcularCompletado({ codigo: "ACME", clienteDesde: 2020, principalCorreo: "a@a.com", principalTelefono: "" }) === false
);
check(
  "Incompleto: sin código",
  calcularCompletado({ codigo: "", clienteDesde: 2020, principalCorreo: "a@a.com", principalTelefono: "811" }) === false
);
check(
  "Incompleto: sin antigüedad",
  calcularCompletado({ codigo: "ACME", clienteDesde: null, principalCorreo: "a@a.com", principalTelefono: "811" }) === false
);

console.log("\n" + (failures === 0 ? "TODO OK" : `${failures} verificación(es) fallida(s)`));
process.exit(failures === 0 ? 0 : 1);
