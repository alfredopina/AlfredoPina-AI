// test-cotizacion-editar.js — crearCotizacion editando un Borrador en el lugar (mismo folio y código), sin red.
const Module = require("module");
const consultas = [];
const propGuardadas = [];
const fila = { id: 7, folio: "AP26-ACME-EXCEL-01", estatus: "Borrador", cliente_id: 1, blob_path: "propuesta/abcd1234" };
const fakePool = {
  request() {
    const q = { _in: {}, input(n, t, v) { this._in[n] = v; return this; },
      async query(sqlText) {
        consultas.push({ sqlText, inputs: this._in });
        if (/FROM Cotizacion WHERE id/.test(sqlText)) return { recordset: [fila] };
        if (/TarifaHerramienta/.test(sqlText)) return { recordset: [{ precio_hora: 500 }] };
        if (/FROM Cotizacion WHERE cliente_id/.test(sqlText)) return { recordset: [] };
        return { recordset: [], rowsAffected: [1] };
      } };
    return q;
  },
};
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (/backoffice-db$/.test(req)) return { getPool: async () => fakePool, sql: { Int: 1, NVarChar: 1, Decimal: () => 1, Date: 1 } };
  if (/cliente-resolver$/.test(req)) return { resolverCliente: async () => ({ id: Number(process.env.CLI || 1), nombre: "Acme", codigo: "ACME" }) };
  if (/cotizacion-proyectos$/.test(req)) return { proyectosParaPropuesta: async () => [], proyectosPorIds: async (h, e) => e.map((p) => ({ nombre: p.nombre, resumen: p.resumen, imagenUrl: null })) };
  if (/\/propuestas$/.test(req)) {
    const real = origLoad.call(this, req, ...a);
    return { ...real, getPropuestasTable: () => ({}), guardarPropuesta: async (t, d) => { propGuardadas.push(d); } };
  }
  return origLoad.call(this, req, ...a);
};
const fn = require("./crearCotizacion");
let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };
const base = { empresa: { clienteId: 1 }, herramienta: "excel", temario_tipo: "personalizado", temas: [{ nombre: "T1", nivel: 1 }], horas_totales: 8, precio_final: 1200, alcance: "Alc", objetivo: "Obj", proyectos: [{ id: "p1", nombre: "Tablero", resumen: "r" }] };
async function llamar(body) { const ctx = { log: { error() {} }, res: null }; await fn(ctx, { body }); return ctx.res; }
(async () => {
  let r = await llamar({ ...base, actualiza_id: 7 });
  check("editar Borrador: 200, mismo folio, actualizada", r.status === 200 && r.body.folio === "AP26-ACME-EXCEL-01" && r.body.actualizada === true);
  check("conserva el código de la propuesta", r.body.propuesta_codigo === "abcd1234" && propGuardadas[0].codigo === "abcd1234");
  check("el snapshot lleva alcance y proyectos de la personalizada", propGuardadas[0].snapshot.alcance === "Alc" && propGuardadas[0].snapshot.proyectos[0].n === "Tablero");
  check("hace UPDATE (no INSERT) solo sobre Borrador", consultas.some((c) => /UPDATE Cotizacion SET/.test(c.sqlText) && /estatus = 'Borrador'/.test(c.sqlText)) && !consultas.some((c) => /INSERT INTO Cotizacion/.test(c.sqlText)));
  fila.estatus = "Enviada";
  r = await llamar({ ...base, actualiza_id: 7 });
  check("editar una Enviada en el lugar: 400", r.status === 400);
  fila.estatus = "Borrador";
  process.env.CLI = "2";
  r = await llamar({ ...base, actualiza_id: 7 });
  check("cambiar de cliente al editar: 400", r.status === 400);
  console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : "\nTodas las pruebas pasaron.");
  process.exit(fallos ? 1 : 0);
})();
