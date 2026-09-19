// Pruebas locales sin red del Reporte de Encuestas (Fase 3, 2026-09-19): el
// cálculo del snapshot (encuesta-reporte-calc.js) y su guardado en Table
// Storage partido en trozos (encuesta-reportes.js), contra una tabla de memoria.
const assert = require("assert");
const { calcularSnapshot } = require("./src/encuesta-reporte-calc");
const { guardarReporteEncuesta, leerReporteEncuesta, listarReportesEncuesta, eliminarReporteEncuesta, partirEnTrozos, TROZO } = require("./src/encuesta-reportes");

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

function tablaFalsa() {
  const filas = new Map();
  const k = (pk, rk) => pk + "|" + rk;
  const e404 = () => { const e = new Error("404"); e.statusCode = 404; return e; };
  return {
    async createTable() {},
    async getEntity(pk, rk) { const f = filas.get(k(pk, rk)); if (!f) throw e404(); return { ...f }; },
    async upsertEntity(e) { filas.set(k(e.partitionKey, e.rowKey), { ...e }); },
    async deleteEntity(pk, rk) { if (!filas.delete(k(pk, rk))) throw e404(); },
    listEntities() { const todas = Array.from(filas.values()); return (async function* () { for (const f of todas) yield { ...f }; })(); },
  };
}

// banco: 2 preguntas por dimensión + 2 Globales (con nombre corto) + comentario
const BANCO = [
  ["c1", "Curso y Materiales", "Objetivos claros", 1], ["c2", "Curso y Materiales", "Material útil", 2],
  ["i1", "Instructor", "Domina el tema", 1], ["i2", "Instructor", "Explica con claridad", 2],
  ["a1", "Aprendizaje y Aplicación", "Puedo aplicarlo", 1], ["a2", "Aprendizaje y Aplicación", "Me siento más seguro", 2],
  ["g1", "Globales", "Satisfacción general", 1], ["g2", "Globales", "Recomendaría el curso", 2],
];
const GLOBALES = [{ id: "g1", texto: "Satisfacción general", nombreCorto: "Satisfacción" }, { id: "g2", texto: "Recomendaría el curso", nombreCorto: "Recomendación" }];

// una respuesta con valores por id de pregunta
function resp(id, valores, comentario, opts = {}) {
  const filas = BANCO.map(([pid, cat, texto, orden]) => ({ pregunta_id: pid, texto, categoria: cat, tipo: "escala", orden, valor: String(valores[pid]) }));
  if (comentario !== undefined) filas.push({ pregunta_id: "comentarios", texto: "Comentarios", categoria: "Globales", tipo: "texto", orden: 99, valor: comentario });
  return { id, grupo_id: opts.grupo === undefined ? 1 : opts.grupo, fecha: opts.fecha || new Date("2026-09-12T00:00:00Z"), filas };
}
const todos = (v) => Object.fromEntries(BANCO.map(([pid]) => [pid, v]));
const snap = (respuestas, extra = {}) => calcularSnapshot({ respuestas, globales: GLOBALES, escala: ["a", "b", "c", "d", "e"], filtros: { instructor: "Alfredo" }, etiqueta: "", ahora: new Date("2026-09-19T20:00:00Z"), ...extra });

(async () => {
  console.log("reporte de encuestas — cálculo");

  await prueba("promedios por dimensión y general con 2 respuestas (agrupados)", () => {
    const s = snap([resp(1, { ...todos(5), i1: 3, i2: 3 }), resp(2, todos(4))]);
    assert.strictEqual(s.n, 2);
    const dim = (n) => s.categorias.find((c) => c.nombre === n).promedio;
    assert.strictEqual(dim("Curso y Materiales"), 4.5);
    assert.strictEqual(dim("Instructor"), 3.5);
    assert.strictEqual(dim("Aprendizaje y Aplicación"), 4.5);
    assert.strictEqual(s.categorias.find((c) => c.nombre === "Globales").promedio, null); // Globales no es dimensión
    assert.strictEqual(s.promedioGeneral, 4.25);
  });

  await prueba("distribución 1-5 por pregunta y nombres de las Globales", () => {
    const s = snap([resp(1, { ...todos(5), c1: 1 }), resp(2, { ...todos(5), c1: 5 }), resp(3, { ...todos(4), c1: 5 })]);
    const c1 = s.categorias[0].preguntas.find((p) => p.id === "c1");
    assert.deepStrictEqual(c1.conteos, [1, 0, 0, 0, 2]);
    assert.strictEqual(c1.n, 3);
    const globales = s.categorias.find((c) => c.nombre === "Globales").preguntas;
    assert.deepStrictEqual(globales.map((g) => g.nombre), ["Satisfacción", "Recomendación"]);
  });

  await prueba("debajo de 4: usa el redondeo del semáforo (3.96 se ve 4.0 y NO se lista; 3.9 sí)", () => {
    const muchas = [];
    for (let i = 0; i < 25; i++) muchas.push(resp(i + 1, { ...todos(5), c1: i < 1 ? 3 : 4, c2: 5 })); // c1 = (3 + 24×4)/25 = 3.96
    const s = snap(muchas);
    assert.strictEqual(s.categorias[0].preguntas.find((p) => p.id === "c1").promedio, 3.96);
    assert.ok(!s.bajoCuatro.map((p) => p.id).includes("c1"), "c1 = 3.96 redondea a 4.0 → no se lista");
    // 10 personas: (3 + 9×4)/10 = 3.9 → sí se lista
    const diez = [];
    for (let i = 0; i < 10; i++) diez.push(resp(i + 1, { ...todos(5), c1: i < 1 ? 3 : 4 }));
    assert.ok(snap(diez).bajoCuatro.map((p) => p.id).includes("c1"), "c1 = 3.9 sí se lista");
  });

  await prueba("bajoCuatro: solo las que están por debajo de 4.0, de la más baja a la más alta", () => {
    const s = snap([resp(1, { ...todos(5), i1: 2, c2: 3.0 }), resp(2, { ...todos(5), i1: 2, c2: 3 })]);
    assert.deepStrictEqual(s.bajoCuatro.map((p) => p.id), ["i1", "c2"]);
    assert.strictEqual(s.bajoCuatro[0].promedio, 2);
  });

  await prueba("si todo está en 4.0 o más, bajoCuatro queda vacío (el reporte lo dice explícito)", () => {
    const s = snap([resp(1, todos(4)), resp(2, todos(5))]);
    assert.deepStrictEqual(s.bajoCuatro, []);
  });

  await prueba("mejores: las 3 de mayor promedio", () => {
    const s = snap([resp(1, { ...todos(4), i1: 5, g2: 5, a1: 5, c1: 3 })]);
    assert.deepStrictEqual(s.mejores.map((p) => p.id).sort(), ["a1", "g2", "i1"]);
    assert.strictEqual(s.mejores.length, 3);
  });

  await prueba("comentarios: todos entran (sin nombre ni correo), los vacíos no", () => {
    const s = snap([
      resp(1, todos(5), "  Excelente curso  ", { fecha: new Date("2026-09-12T00:00:00Z") }),
      resp(2, todos(5), "   "),
      resp(3, todos(5)),
      resp(4, todos(5), "Muy rápido", { fecha: new Date("2026-09-05T00:00:00Z") }),
    ]);
    assert.deepStrictEqual(s.comentarios, [{ texto: "Excelente curso", fecha: "2026-09-12" }, { texto: "Muy rápido", fecha: "2026-09-05" }]);
    assert.ok(!JSON.stringify(s).match(/correo|nombre_persona/));
  });

  await prueba("grupos distintos, respuestas sin grupo y rango real de fechas", () => {
    const s = snap([
      resp(1, todos(5), undefined, { grupo: 1, fecha: new Date("2026-09-12T00:00:00Z") }),
      resp(2, todos(5), undefined, { grupo: 1, fecha: new Date("2026-09-12T00:00:00Z") }),
      resp(3, todos(5), undefined, { grupo: 2, fecha: new Date("2026-09-01T00:00:00Z") }),
      resp(4, todos(5), undefined, { grupo: null, fecha: new Date("2026-09-17T00:00:00Z") }),
    ]);
    assert.strictEqual(s.nGrupos, 2);
    assert.strictEqual(s.nSinGrupo, 1);
    assert.deepStrictEqual(s.rango, { desde: "2026-09-01", hasta: "2026-09-17" });
  });

  await prueba("valores fuera de 1-5 o no numéricos se ignoran", () => {
    const r = resp(1, todos(4));
    r.filas.find((f) => f.pregunta_id === "c1").valor = "9";
    r.filas.find((f) => f.pregunta_id === "c2").valor = "abc";
    const s = snap([r]);
    assert.ok(!s.categorias[0].preguntas.find((p) => p.id === "c1"));
  });

  console.log("\nreporte de encuestas — guardado en Table Storage");

  await prueba("un snapshot chico ida y vuelta, y la lista trae solo campos chicos", async () => {
    const t = tablaFalsa();
    const s = snap([resp(1, todos(5), "Bien")], { etiqueta: "Excel — septiembre" });
    await guardarReporteEncuesta(t, { token: "a".repeat(32), snapshot: s });
    assert.deepStrictEqual(await leerReporteEncuesta(t, "a".repeat(32)), s);
    const lista = await listarReportesEncuesta(t);
    assert.strictEqual(lista.length, 1);
    assert.strictEqual(lista[0].etiqueta, "Excel — septiembre");
    assert.strictEqual(lista[0].nComentarios, 1);
    assert.deepStrictEqual(lista[0].filtros, { instructor: "Alfredo" });
    assert.ok(!("snap0" in lista[0]));
  });

  await prueba("un reporte con MUCHOS comentarios (>64 KB) se parte en trozos y se recupera idéntico", async () => {
    const t = tablaFalsa();
    const respuestas = [];
    for (let i = 0; i < 300; i++) respuestas.push(resp(i + 1, todos(5), "ñ".repeat(400) + " comentario " + i));
    const s = snap(respuestas);
    const texto = JSON.stringify(s);
    assert.ok(texto.length > TROZO * 2, "el caso de prueba debe pasar de 2 trozos (" + texto.length + ")");
    await guardarReporteEncuesta(t, { token: "b".repeat(32), snapshot: s });
    const guardada = await t.getEntity("reporte", "b".repeat(32));
    for (const clave of Object.keys(guardada)) if (typeof guardada[clave] === "string") assert.ok(guardada[clave].length <= TROZO, clave + " pasa del tope por propiedad");
    assert.deepStrictEqual(await leerReporteEncuesta(t, "b".repeat(32)), s);
  });

  await prueba("partirEnTrozos rechaza un reporte imposible de guardar", () => {
    assert.throws(() => partirEnTrozos("x".repeat(TROZO * 31)), /demasiado grande/);
  });

  await prueba("leer un token inexistente → null; eliminar quita el reporte", async () => {
    const t = tablaFalsa();
    assert.strictEqual(await leerReporteEncuesta(t, "c".repeat(32)), null);
    await guardarReporteEncuesta(t, { token: "d".repeat(32), snapshot: snap([resp(1, todos(5))]) });
    await eliminarReporteEncuesta(t, "d".repeat(32));
    assert.strictEqual(await leerReporteEncuesta(t, "d".repeat(32)), null);
  });

  console.log(fallos ? "\n" + fallos + " FALLO(S)" : "\nTODO OK");
  process.exit(fallos ? 1 : 0);
})();
