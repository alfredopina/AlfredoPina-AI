// test-cliente-resolver.js
// Prueba local, sin base de datos: un pool falso registra las consultas para
// verificar las reglas de api/src/cliente-resolver.js (mismas que tenían las 6
// copias): clienteId existente, código ya usado, empresa nueva como
// Prospecto/Directo, Encuesta que nunca crea, y errores "seguros".
const { resolverCliente, resolverClienteExistente, limpiarCodigo } = require("./src/cliente-resolver");

let failures = 0;
function check(nombre, condicion) {
  if (condicion) console.log(`  OK ${nombre}`);
  else { failures++; console.log(`  FALLÓ ${nombre}`); }
}

// respuestas: función (sqlText, params) => recordset
function fakePool(responder) {
  const llamadas = [];
  return {
    llamadas,
    request() {
      const params = {};
      const req = {
        input(nombre, _tipo, valor) { params[nombre] = valor; return req; },
        async query(texto) { llamadas.push({ texto, params: { ...params } }); return { recordset: responder(texto, params) }; },
      };
      return req;
    },
  };
}

async function rechaza(promesa) {
  try { await promesa; return null; } catch (e) { return e; }
}

(async () => {
  check("limpiarCodigo quita símbolos y sube a mayúsculas", limpiarCodigo(" ab-c 1! ") === "ABC1" && limpiarCodigo(null) === "");

  // 1) clienteId existente
  let pool = fakePool((t) => (t.includes("WHERE id") ? [{ id: 7, nombre: "Acme", codigo: "ACME" }] : []));
  let r = await resolverCliente(pool, { clienteId: "7" });
  check("clienteId existente lo regresa", r.id === 7 && pool.llamadas.length === 1);

  // 2) clienteId que ya no existe
  pool = fakePool(() => []);
  let e = await rechaza(resolverCliente(pool, { clienteId: 9 }));
  check("clienteId inexistente lanza error", e && /ya no existe/.test(e.message) && !e.safe);

  // 3) errores seguros
  const seguro = (m) => { const x = new Error(m); x.safe = true; return x; };
  e = await rechaza(resolverCliente(pool, { clienteId: 9 }, "Prospecto", { crearError: seguro }));
  check("crearError marca el error como seguro", e && e.safe === true);

  // 4) falta nombre o código
  e = await rechaza(resolverCliente(pool, { nombre: "Sin código" }));
  check("sin código lanza error", e && /Falta el nombre o el código/.test(e.message));

  // 5) código ya existente: reusa, no inserta
  pool = fakePool((t) => (t.startsWith("SELECT") ? [{ id: 3, nombre: "Beta", codigo: "BETA" }] : []));
  r = await resolverCliente(pool, { nombre: "Beta SA", codigo: "b-eta" });
  check("código existente se reusa sin INSERT", r.id === 3 && !pool.llamadas.some((c) => c.texto.startsWith("INSERT")));

  // 6) empresa nueva: Prospecto por default
  pool = fakePool((t) => (t.startsWith("INSERT") ? [{ id: 11, nombre: "Nueva", codigo: "NUEVA" }] : []));
  r = await resolverCliente(pool, { nombre: "Nueva", codigo: "nueva" });
  let ins = pool.llamadas.find((c) => c.texto.startsWith("INSERT"));
  check("empresa nueva nace Prospecto", r.id === 11 && ins.params.tipo === "Prospecto" && ins.params.codigo === "NUEVA");

  // 7) empresa nueva desde Grupo: Directo / Indirecto
  pool = fakePool((t) => (t.startsWith("INSERT") ? [{ id: 12, nombre: "G", codigo: "G" }] : []));
  await resolverCliente(pool, { nombre: "G", codigo: "g" }, "Directo");
  check("desde Grupo nace Directo", pool.llamadas.find((c) => c.texto.startsWith("INSERT")).params.tipo === "Directo");

  // 8) empresa null (cliente_final opcional)
  check("empresa null regresa null", (await resolverCliente(pool, null, "Indirecto")) === null);

  // 9) acepta una función que devuelve Request (transacción)
  pool = fakePool((t) => (t.includes("WHERE id") ? [{ id: 5, nombre: "T", codigo: "T" }] : []));
  r = await resolverCliente(() => pool.request(), { clienteId: 5 });
  check("acepta función de Request (transacción)", r.id === 5);

  // 10) Encuesta abierta
  pool = fakePool(() => []);
  e = await rechaza(resolverClienteExistente(pool, {}, seguro));
  check("Encuesta sin clienteId pide elegir empresa", e && e.safe === true && /Selecciona tu empresa/.test(e.message));
  e = await rechaza(resolverClienteExistente(pool, { clienteId: 4 }));
  check("Encuesta con Prospecto/inexistente lanza error", e && /ya no existe/.test(e.message));
  check("Encuesta filtra Prospectos en la consulta", pool.llamadas[0].texto.includes("<> 'Prospecto'") && !pool.llamadas.some((c) => c.texto.startsWith("INSERT")));
  pool = fakePool(() => [{ id: 4, nombre: "Ok", codigo: "OK" }]);
  r = await resolverClienteExistente(pool, { clienteId: 4 });
  check("Encuesta con cliente válido lo regresa", r.id === 4);

  if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
  console.log("\nTodo OK");
})();
