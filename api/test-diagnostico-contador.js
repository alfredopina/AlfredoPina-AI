// Pruebas locales sin red del contador en vivo de Diagnósticos en Table Storage
// (diagnostico-contador.js), contra una tabla de memoria con la semántica
// mínima del SDK (getEntity/createEntity/updateEntity con etag → 412/upsertEntity).
const assert = require("assert");
const { ajustarContadorDiagnostico, leerContadorDiagnostico, sembrarContadorDiagnostico } = require("./src/diagnostico-contador");

let fallos = 0;
async function prueba(nombre, fn) {
  try {
    await fn();
    console.log("  OK " + nombre);
  } catch (err) {
    fallos++;
    console.log("  FALLO " + nombre + " → " + err.message);
  }
}

function errorEstado(code) {
  const e = new Error("estado " + code);
  e.statusCode = code;
  return e;
}

function tablaFalsa() {
  const filas = new Map();
  let etag = 0;
  const k = (pk, rk) => pk + "|" + rk;
  return {
    async createTable() {},
    async getEntity(pk, rk) {
      const f = filas.get(k(pk, rk));
      if (!f) throw errorEstado(404);
      await new Promise((r) => setTimeout(r, Math.random() * 3)); // deja intercalar lecturas concurrentes
      return { ...f };
    },
    async createEntity(e) {
      if (filas.has(k(e.partitionKey, e.rowKey))) throw errorEstado(409);
      filas.set(k(e.partitionKey, e.rowKey), { ...e, etag: String(++etag) });
    },
    async updateEntity(e, modo, opts) {
      const cur = filas.get(k(e.partitionKey, e.rowKey));
      if (!cur) throw errorEstado(404);
      if (opts && opts.etag && opts.etag !== cur.etag) throw errorEstado(412);
      filas.set(k(e.partitionKey, e.rowKey), { ...cur, ...e, etag: String(++etag) });
    },
    async upsertEntity(e, modo) {
      const cur = filas.get(k(e.partitionKey, e.rowKey));
      filas.set(k(e.partitionKey, e.rowKey), { ...(modo === "Merge" ? cur : {}), ...e, etag: String(++etag) });
    },
  };
}

(async () => {
  console.log("contador de Diagnósticos (Table Storage)");

  await prueba("sin contador → null (hay que sembrar desde SQL)", async () => {
    assert.strictEqual(await leerContadorDiagnostico(tablaFalsa()), null);
  });

  await prueba("un envío antes de sembrar NO cuenta como contador válido (evita 'total: 1' en vez de los N históricos)", async () => {
    const t = tablaFalsa();
    await ajustarContadorDiagnostico(t, "excel", 1);
    assert.strictEqual(await leerContadorDiagnostico(t), null);
  });

  await prueba("sembrar reemplaza lo acumulado antes y ya se puede leer", async () => {
    const t = tablaFalsa();
    await ajustarContadorDiagnostico(t, "excel", 1);
    await sembrarContadorDiagnostico(t, { total: 40, excel: 25, powerbi: 15 });
    assert.deepStrictEqual(await leerContadorDiagnostico(t), { total: 40, excel: 25, powerbi: 15 });
  });

  await prueba("sumar y restar por herramienta, conservando el 'sembrado'", async () => {
    const t = tablaFalsa();
    await sembrarContadorDiagnostico(t, { total: 10, excel: 6, powerbi: 4 });
    await ajustarContadorDiagnostico(t, "excel", 1);
    await ajustarContadorDiagnostico(t, "powerbi", 1);
    await ajustarContadorDiagnostico(t, "powerbi", 1);
    assert.deepStrictEqual(await leerContadorDiagnostico(t), { total: 13, excel: 7, powerbi: 6 });
    await ajustarContadorDiagnostico(t, "excel", -1);
    assert.deepStrictEqual(await leerContadorDiagnostico(t), { total: 12, excel: 6, powerbi: 6 });
  });

  await prueba("nunca baja de 0 (borrar con el contador ya en cero)", async () => {
    const t = tablaFalsa();
    await sembrarContadorDiagnostico(t, { total: 0, excel: 0, powerbi: 0 });
    await ajustarContadorDiagnostico(t, "excel", -1);
    assert.deepStrictEqual(await leerContadorDiagnostico(t), { total: 0, excel: 0, powerbi: 0 });
  });

  await prueba("herramienta desconocida o nula (respuesta ya inexistente) no toca nada", async () => {
    const t = tablaFalsa();
    await sembrarContadorDiagnostico(t, { total: 5, excel: 3, powerbi: 2 });
    await ajustarContadorDiagnostico(t, null, -1);
    await ajustarContadorDiagnostico(t, "otra", 1);
    assert.deepStrictEqual(await leerContadorDiagnostico(t), { total: 5, excel: 3, powerbi: 2 });
  });

  await prueba("20 envíos simultáneos no se pisan el conteo (ETag + reintento)", async () => {
    const t = tablaFalsa();
    await sembrarContadorDiagnostico(t, { total: 0, excel: 0, powerbi: 0 });
    await Promise.all(Array.from({ length: 20 }, (_, i) => ajustarContadorDiagnostico(t, i % 2 ? "excel" : "powerbi", 1)));
    assert.deepStrictEqual(await leerContadorDiagnostico(t), { total: 20, excel: 10, powerbi: 10 });
  });

  console.log(fallos ? "\n" + fallos + " FALLO(S)" : "\nTODO OK");
  process.exit(fallos ? 1 : 0);
})();
