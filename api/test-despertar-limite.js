// test-despertar-limite.js
// Prueba local, sin red ni base: verifica el candado de api/src/despertar-limite.js
// con un reloj falso.
const { crearLimitador } = require("./src/despertar-limite");

let failures = 0;
function check(nombre, condicion) {
  if (condicion) console.log(`  OK ${nombre}`);
  else { failures++; console.log(`  FALLÓ ${nombre}`); }
}

(async () => {
  const VENTANA = 10 * 60 * 1000;
  const limitar = crearLimitador(VENTANA);
  let ejecuciones = 0;
  const contar = async () => { ejecuciones++; };

  let r = await limitar(contar, 1_000_000);
  check("la primera llamada sí ejecuta", r.omitido === false && ejecuciones === 1);

  r = await limitar(contar, 1_000_000 + 1000);
  check("una llamada 1 segundo después se omite", r.omitido === true && ejecuciones === 1);

  for (let i = 0; i < 50; i++) await limitar(contar, 1_000_000 + 5000 + i);
  check("una ráfaga de 50 llamadas no ejecuta nada más", ejecuciones === 1);

  r = await limitar(contar, 1_000_000 + VENTANA - 1);
  check("justo antes de cumplirse la ventana se omite", r.omitido === true && ejecuciones === 1);

  r = await limitar(contar, 1_000_000 + VENTANA);
  check("al cumplirse la ventana vuelve a ejecutar", r.omitido === false && ejecuciones === 2);

  // simultáneas: solo una entra
  const limitar2 = crearLimitador(VENTANA);
  let n = 0;
  const lenta = () => new Promise((res) => setTimeout(() => { n++; res(); }, 20));
  const resultados = await Promise.all([1, 2, 3, 4, 5].map(() => limitar2(lenta, 5_000_000)));
  check("5 llamadas simultáneas ejecutan una sola vez", n === 1 && resultados.filter((x) => !x.omitido).length === 1);

  // si falla, el siguiente intento reintenta y el error se propaga
  const limitar3 = crearLimitador(VENTANA);
  let err = null;
  try { await limitar3(async () => { throw new Error("base caída"); }, 9_000_000); } catch (e) { err = e; }
  check("si la ejecución falla, el error se propaga", err && err.message === "base caída");
  let ok = 0;
  r = await limitar3(async () => { ok++; }, 9_000_000 + 1000);
  check("tras un fallo el siguiente intento sí reintenta", r.omitido === false && ok === 1);

  if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
  console.log("\nTodo OK");
})();
