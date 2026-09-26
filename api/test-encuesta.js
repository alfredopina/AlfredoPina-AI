// Pruebas locales sin red de la lógica de Encuestas (Fase 1, 2026-09-19):
// validación de respuestas contra el banco, tope por categoría, hora de
// México, links por grupo y contadores con ETag (contra una tabla de memoria
// que imita lo que usa el SDK: getEntity/createEntity/updateEntity con etag
// → 412/upsertEntity/listEntities). Mismo patrón que test-backup.js.
const assert = require("assert");
const { validarRespuestas, cabeOtraEscala, fechaMexico, promediosDeRespuesta, medianaMs, fueraDeSesion, esInstructorMarca } = require("./src/encuesta-logic");
const { leerEscala, guardarEscala, ESCALA_DEFAULT } = require("./src/encuesta-tables");
const { guardarLinkDeGrupo, buscarLinkPorGrupo, cambiarEstadoLink, leerLink, ajustarContadores, leerContadores } = require("./src/encuesta-links");

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

// Tabla en memoria con la semántica mínima de @azure/data-tables que usamos.
function tablaFalsa() {
  const filas = new Map();
  let etag = 0;
  const k = (pk, rk) => pk + "|" + rk;
  function cumple(fila, filtro) {
    if (!filtro) return true;
    return filtro.split(" and ").every((parte) => {
      const m = parte.trim().match(/^(\w+) eq '(.*)'$/);
      if (!m) return true;
      // OData usa PartitionKey/RowKey; el SDK devuelve partitionKey/rowKey
      const campo = m[1] === "PartitionKey" ? "partitionKey" : m[1] === "RowKey" ? "rowKey" : m[1];
      return String(fila[campo]) === m[2].replace(/''/g, "'");
    });
  }
  return {
    async createTable() {},
    async getEntity(pk, rk) {
      const f = filas.get(k(pk, rk));
      if (!f) throw errorEstado(404);
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
    listEntities(opts) {
      const filtro = opts && opts.queryOptions && opts.queryOptions.filter;
      const coinciden = Array.from(filas.values()).filter((f) => cumple(f, filtro));
      return (async function* () { for (const f of coinciden) yield { ...f }; })();
    },
  };
}

// banco de prueba: 12 de escala en 3 categorías + 2 de Globales + comentario
function bancoCompleto() {
  const banco = [];
  for (const cat of ["Curso y Materiales", "Instructor", "Aprendizaje y Aplicación"]) {
    for (let i = 1; i <= 4; i++) banco.push({ partitionKey: cat, rowKey: `${cat}-${i}`, texto: `Pregunta ${cat} ${i}`, tipo: "escala", orden: i * 10, activa: true });
  }
  banco.push({ partitionKey: "Globales", rowKey: "g1", texto: "Global 1", tipo: "escala", orden: 0, activa: true });
  banco.push({ partitionKey: "Globales", rowKey: "g2", texto: "Global 2", tipo: "escala", orden: 10, activa: true });
  banco.push({ partitionKey: "Globales", rowKey: "comentarios", texto: "¿Algo más?", tipo: "texto", orden: 1000, activa: true });
  return banco;
}
function respuestasCompletas(banco, valor) {
  return banco.filter((e) => e.tipo === "escala").map((e) => ({ preguntaId: e.rowKey, valor }));
}

(async () => {
  console.log("\nfechaMexico");
  await prueba("04:00 UTC sigue siendo el día anterior en México", () => assert.strictEqual(fechaMexico(new Date("2026-09-19T04:00:00Z")), "2026-09-18"));
  await prueba("06:00 UTC ya es el día nuevo en México", () => assert.strictEqual(fechaMexico(new Date("2026-09-19T06:00:00Z")), "2026-09-19"));

  console.log("\nvalidarRespuestas");
  const banco = bancoCompleto();
  await prueba("respuestas completas → 14 renglones de escala con copia congelada", () => {
    const d = validarRespuestas(banco, respuestasCompletas(banco, 4));
    assert.strictEqual(d.length, 14);
    assert.strictEqual(d[0].tipo, "escala");
    assert.ok(d[0].texto && d[0].categoria);
    assert.strictEqual(d[0].valor, "4");
  });
  await prueba("valor como texto \"3\" se acepta", () => assert.strictEqual(validarRespuestas(banco, respuestasCompletas(banco, "3")).length, 14));
  await prueba("con comentario → 15 renglones, el último tipo texto", () => {
    const r = respuestasCompletas(banco, 5).concat([{ preguntaId: "comentarios", valor: "  Muy bien  " }]);
    const d = validarRespuestas(banco, r);
    assert.strictEqual(d.length, 15);
    assert.strictEqual(d[14].tipo, "texto");
    assert.strictEqual(d[14].valor, "Muy bien");
  });
  await prueba("comentario vacío o en blanco no genera renglón", () => {
    const r = respuestasCompletas(banco, 5).concat([{ preguntaId: "comentarios", valor: "   " }]);
    assert.strictEqual(validarRespuestas(banco, r).length, 14);
  });
  await prueba("comentario se recorta a 500 (límite de la columna)", () => {
    const r = respuestasCompletas(banco, 5).concat([{ preguntaId: "comentarios", valor: "x".repeat(900) }]);
    assert.strictEqual(validarRespuestas(banco, r)[14].valor.length, 500);
  });
  await prueba("falta una pregunta de escala → error", () => {
    assert.throws(() => validarRespuestas(banco, respuestasCompletas(banco, 3).slice(1)), /Falta calificar/);
  });
  await prueba("valor 6 → error", () => {
    const r = respuestasCompletas(banco, 3); r[0].valor = 6;
    assert.throws(() => validarRespuestas(banco, r), /Falta calificar/);
  });
  await prueba("valor 0, decimal o texto libre en una escala → error", () => {
    for (const malo of [0, 2.5, "excelente", "", null]) {
      const r = respuestasCompletas(banco, 3); r[0].valor = malo;
      assert.throws(() => validarRespuestas(banco, r), /Falta calificar/, "valor " + malo);
    }
  });
  await prueba("id de pregunta que no existe en el banco → error de \"cambió\"", () => {
    const r = respuestasCompletas(banco, 3).concat([{ preguntaId: "inventada", valor: 5 }]);
    assert.throws(() => validarRespuestas(banco, r), /cambió/);
  });
  await prueba("banco sin preguntas de escala → 409", () => {
    try { validarRespuestas([], []); assert.fail("debió lanzar"); } catch (e) { assert.strictEqual(e.status, 409); }
  });

  console.log("\ncabeOtraEscala (tope por categoría)");
  await prueba("Instructor con 4 → ya no cabe otra", () => assert.strictEqual(cabeOtraEscala("Instructor", banco, null), false));
  await prueba("Instructor con 3 → cabe", () => assert.strictEqual(cabeOtraEscala("Instructor", banco.filter((e) => e.rowKey !== "Instructor-4"), null), true));
  await prueba("editar una de las 4 no cuenta contra sí misma", () => assert.strictEqual(cabeOtraEscala("Instructor", banco, "Instructor-4"), true));
  await prueba("Globales con 2 de escala + comentario → ya no cabe (el comentario no cuenta)", () => assert.strictEqual(cabeOtraEscala("Globales", banco, null), false));
  await prueba("Globales con 1 de escala + comentario → cabe una", () => assert.strictEqual(cabeOtraEscala("Globales", banco.filter((e) => e.rowKey !== "g2"), null), true));
  await prueba("categoría inexistente → no cabe", () => assert.strictEqual(cabeOtraEscala("Otra", banco, null), false));

  console.log("\nescala (textos 1-5)");
  await prueba("sin config guardada → defaults", async () => assert.deepStrictEqual(await leerEscala(tablaFalsa()), ESCALA_DEFAULT));
  await prueba("guarda y lee los 5 textos", async () => {
    const t = tablaFalsa();
    await guardarEscala(t, ["Pésimo", "Flojo", "Regular", "Bien", "Genial"]);
    assert.deepStrictEqual(await leerEscala(t), ["Pésimo", "Flojo", "Regular", "Bien", "Genial"]);
  });

  console.log("\nlinks por grupo");
  const snapshot = (extra) => ({ grupoId: 42, clienteId: 7, clienteNombre: "ACME", curso: "Excel Core", instructor: "Alfredo", herramientas: '["excel"]', horas: 16, modalidad: "Online", fechaInicio: "2026-09-01", fechaFin: "2026-09-19", ...extra });
  await prueba("generar dos veces el mismo grupo → mismo token (el QR impreso no cambia)", async () => {
    const t = tablaFalsa();
    const a = await guardarLinkDeGrupo(t, snapshot());
    const b = await guardarLinkDeGrupo(t, snapshot({ instructor: "Otro" }));
    assert.strictEqual(a.token, b.token);
    assert.strictEqual(b.instructor, "Otro"); // el snapshot sí se refresca
  });
  await prueba("regenerar conserva abierta=false, conteo y fecha de generación", async () => {
    const t = tablaFalsa();
    const a = await guardarLinkDeGrupo(t, snapshot());
    await cambiarEstadoLink(t, a.token, false);
    await ajustarContadores(t, { token: a.token, delta: 1 });
    const b = await guardarLinkDeGrupo(t, snapshot());
    assert.strictEqual(b.abierta, false);
    assert.strictEqual(b.respuestas, 1);
    assert.strictEqual(b.generadoEn, a.generadoEn);
  });
  await prueba("grupos distintos → tokens distintos; buscarLinkPorGrupo los distingue", async () => {
    const t = tablaFalsa();
    const a = await guardarLinkDeGrupo(t, snapshot({ grupoId: 1 }));
    const b = await guardarLinkDeGrupo(t, snapshot({ grupoId: 2 }));
    assert.notStrictEqual(a.token, b.token);
    assert.strictEqual((await buscarLinkPorGrupo(t, 2)).token, b.token);
    assert.strictEqual(await buscarLinkPorGrupo(t, 99), null);
  });
  await prueba("horas ausentes (null) no rompen el guardado", async () => {
    const l = await guardarLinkDeGrupo(tablaFalsa(), snapshot({ horas: null, modalidad: null }));
    assert.strictEqual(l.horas, null);
    assert.strictEqual(l.modalidad, null);
  });
  await prueba("token inexistente → null", async () => assert.strictEqual(await leerLink(tablaFalsa(), "nada"), null));

  console.log("\ncontadores");
  await prueba("suma al global y al link", async () => {
    const t = tablaFalsa();
    const l = await guardarLinkDeGrupo(t, snapshot());
    await ajustarContadores(t, { token: l.token, delta: 1 });
    await ajustarContadores(t, { token: null, delta: 1 }); // link genérico: solo global
    const c = await leerContadores(t);
    assert.strictEqual(c.total, 2);
    assert.strictEqual(c.hoy, 2);
    assert.strictEqual(c.links.find((x) => x.token === l.token).respuestas, 1);
  });
  await prueba("15 envíos simultáneos (todo un grupo) → ningún conteo se pierde (ETag + reintento)", async () => {
    const t = tablaFalsa();
    const l = await guardarLinkDeGrupo(t, snapshot());
    await Promise.all(Array.from({ length: 15 }, () => ajustarContadores(t, { token: l.token, delta: 1 })));
    const c = await leerContadores(t);
    assert.strictEqual(c.total, 15);
    assert.strictEqual(c.links[0].respuestas, 15);
  });
  await prueba("'hoy' se reinicia al cambiar el día, el total no", async () => {
    const t = tablaFalsa();
    await ajustarContadores(t, { token: null, delta: 1 });
    await t.updateEntity({ partitionKey: "contador", rowKey: "global", hoyFecha: "2020-01-01", hoy: 9 }, "Merge");
    assert.strictEqual((await leerContadores(t)).hoy, 0); // lectura con día viejo
    await ajustarContadores(t, { token: null, delta: 1 });
    const c = await leerContadores(t);
    assert.strictEqual(c.total, 2);
    assert.strictEqual(c.hoy, 1);
  });
  await prueba("restar (borrar una respuesta) nunca baja de 0", async () => {
    const t = tablaFalsa();
    await ajustarContadores(t, { token: null, delta: -1 });
    assert.strictEqual((await leerContadores(t)).total, 0);
  });
  await prueba("sin ningún envío todavía → contadores en 0 (la tabla ni existe)", async () => {
    const c = await leerContadores(tablaFalsa());
    assert.deepStrictEqual(c, { total: 0, hoy: 0, links: [] });
  });

  console.log("\ncontador al borrar (Fase 2)");
  await prueba("borrar una respuesta de hoy resta del total Y del hoy", async () => {
    const t = tablaFalsa();
    await ajustarContadores(t, { token: null, delta: 1 });
    await ajustarContadores(t, { token: null, delta: 1 });
    await ajustarContadores(t, { token: null, delta: -1, descontarHoy: true });
    const c = await leerContadores(t);
    assert.strictEqual(c.total, 1);
    assert.strictEqual(c.hoy, 1);
  });
  await prueba("borrar una respuesta de hace días resta del total pero NO del hoy", async () => {
    const t = tablaFalsa();
    await ajustarContadores(t, { token: null, delta: 1 });
    await ajustarContadores(t, { token: null, delta: 1 });
    await ajustarContadores(t, { token: null, delta: -1, descontarHoy: false });
    const c = await leerContadores(t);
    assert.strictEqual(c.total, 1);
    assert.strictEqual(c.hoy, 2);
  });
  await prueba("al borrar también baja el conteo del link de su grupo", async () => {
    const t = tablaFalsa();
    const l = await guardarLinkDeGrupo(t, snapshot());
    await ajustarContadores(t, { token: l.token, delta: 1 });
    await ajustarContadores(t, { token: l.token, delta: 1 });
    await ajustarContadores(t, { token: l.token, delta: -1, descontarHoy: false });
    assert.strictEqual((await leerLink(t, l.token)).respuestas, 1);
  });

  console.log("\npromedios por respuesta (Resultados)");
  const filasDe = (cat, vals, tipo = "escala") => vals.map((v) => ({ categoria: cat, tipo, valor: String(v) }));
  const respuestaTipo = [
    ...filasDe("Curso y Materiales", [5, 4, 4, 5]), ...filasDe("Instructor", [3, 3, 4, 2]),
    ...filasDe("Aprendizaje y Aplicación", [4, 4, 4, 4]), ...filasDe("Globales", [5, 3]),
    { categoria: "Globales", tipo: "texto", valor: "Buen curso" },
  ];
  await prueba("promedio por dimensión y general (14 de escala; el comentario no entra)", () => {
    const p = promediosDeRespuesta(respuestaTipo);
    assert.strictEqual(p.curso, 4.5);
    assert.strictEqual(p.instructor, 3);
    assert.strictEqual(p.aprendizaje, 4);
    assert.strictEqual(p.general, 3.86); // 54 / 14
  });
  await prueba("Globales cuentan en el general pero no tienen promedio propio", () => {
    const p = promediosDeRespuesta(filasDe("Globales", [5, 1]));
    assert.strictEqual(p.general, 3);
    assert.strictEqual(p.curso, null);
  });
  await prueba("sin filas → todo null (sin dividir entre 0)", () => assert.deepStrictEqual(promediosDeRespuesta([]), { curso: null, instructor: null, aprendizaje: null, general: null }));
  await prueba("valores no numéricos se ignoran", () => assert.strictEqual(promediosDeRespuesta([{ categoria: "Instructor", tipo: "escala", valor: "x" }, { categoria: "Instructor", tipo: "escala", valor: "4" }]).instructor, 4));

  console.log("\nfuera de sesión (mediana del grupo)");
  const H = 3600 * 1000;
  await prueba("mediana de cantidad impar y par", () => {
    assert.strictEqual(medianaMs([5, 1, 3]), 3);
    assert.strictEqual(medianaMs([1, 2, 3, 4]), 3); // (2+3)/2 = 2.5 → redondea a 3
    assert.strictEqual(medianaMs([]), null);
  });
  const clase = [0, 1 * H, 2 * H, 3 * H, 4 * H]; // todo el grupo en una mañana
  const med = medianaMs(clase);
  await prueba("quien contesta dentro de 12 h de la mediana NO se marca", () => assert.strictEqual(fueraDeSesion(4 * H, med, 5), null));
  await prueba("quien contesta 3 días después SÍ se marca, con la diferencia", () => {
    const f = fueraDeSesion(med + 72 * H, med, 5);
    assert.ok(f && f.difMs === 72 * H);
  });
  await prueba("también se marca quien contestó mucho ANTES de la sesión", () => assert.ok(fueraDeSesion(med - 30 * H, med, 5)));
  await prueba("con menos de 3 respuestas en el grupo no hay referencia → sin marca", () => assert.strictEqual(fueraDeSesion(med + 72 * H, med, 2), null));
  await prueba("sin mediana (link genérico, sin grupo) → sin marca", () => assert.strictEqual(fueraDeSesion(0, null, 0), null));
  await prueba("link generado con días de anticipación NO marca a todo el grupo (la mediana es la de las respuestas)", () => {
    const generadoHaceDias = -96 * H; // el link se creó 4 días antes; no interviene en el cálculo
    const m = medianaMs([0, H, 2 * H]);
    assert.strictEqual(fueraDeSesion(H, m, 3), null);
    void generadoHaceDias;
  });

  console.log("\ninstructor de la marca (invitación a LinkedIn / testimonio)");
  await prueba("reconoce a Alfredo con o sin acento, mayúsculas o apellido completo", () => {
    for (const n of ["Alfredo Piña", "alfredo pina", "ALFREDO PIÑA CORTEZ", "  Alfredo Piña  "]) assert.ok(esInstructorMarca(n), n);
  });
  await prueba("otros instructores, vacíos y nulos no cuentan", () => {
    for (const n of ["María López", "Alfredo Gómez", "Piña", "", null, undefined]) assert.ok(!esInstructorMarca(n), String(n));
  });

  console.log(fallos ? `\n${fallos} PRUEBA(S) FALLARON` : "\nTODO OK");
  process.exit(fallos ? 1 : 0);
})();
