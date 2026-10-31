// test-cotizacion-editar.js — crearCotizacion editando un Borrador en el lugar (mismo folio y código), sin red.
const Module = require("module");
const consultas = [];
const propGuardadas = [];
let intermRow = null;
let contactoRow = null;
let logoExiste = true;
const fila = { id: 7, folio: "AP26-ACME-EXCEL-01", estatus: "Borrador", cliente_id: 1, blob_path: "propuesta/abcd1234" };
const fakePool = {
  request() {
    const q = { _in: {}, input(n, t, v) { this._in[n] = v; return this; },
      async query(sqlText) {
        consultas.push({ sqlText, inputs: this._in });
        if (/FROM Cotizacion WHERE id/.test(sqlText)) return { recordset: [fila] };
        if (/FROM Contacto WHERE id/.test(sqlText)) return { recordset: contactoRow ? [contactoRow] : [] };
        if (/FROM Cliente WHERE id/.test(sqlText)) return { recordset: intermRow ? [intermRow] : [] };
        if (/INSERT INTO Cotizacion/.test(sqlText)) return { recordset: [{ id: 99 }] };
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
  if (/intermediarios-storage$/.test(req)) return { existeLogoIntermediario: async () => logoExiste };
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
const base = { empresa: { clienteId: 1 }, herramienta: "excel", temario_tipo: "personalizado", temas: [{ nombre: "T1", nivel: 1 }], horas_totales: 8, precio_final: 1200, objetivo: "Obj", proyectos: [{ id: "p1", nombre: "Tablero", resumen: "r" }] };
async function llamar(body) { const ctx = { log: { error() {} }, res: null }; await fn(ctx, { body }); return ctx.res; }
(async () => {
  let r = await llamar({ ...base, actualiza_id: 7 });
  check("editar Borrador: 200, mismo folio, actualizada", r.status === 200 && r.body.folio === "AP26-ACME-EXCEL-01" && r.body.actualizada === true);
  check("conserva el código de la propuesta", r.body.propuesta_codigo === "abcd1234" && propGuardadas[0].codigo === "abcd1234");
  check("el snapshot lleva los proyectos de la personalizada y ya no lleva alcance", propGuardadas[0].snapshot.proyectos[0].n === "Tablero" && !("alcance" in propGuardadas[0].snapshot));
  check("hace UPDATE (no INSERT) solo sobre Borrador", consultas.some((c) => /UPDATE Cotizacion SET/.test(c.sqlText) && /estatus = 'Borrador'/.test(c.sqlText)) && !consultas.some((c) => /INSERT INTO Cotizacion/.test(c.sqlText)));
  fila.estatus = "Enviada";
  r = await llamar({ ...base, actualiza_id: 7 });
  check("editar una Enviada en el lugar: 400", r.status === 400);
  fila.estatus = "Borrador";
  process.env.CLI = "2";
  r = await llamar({ ...base, actualiza_id: 7 });
  check("cambiar de cliente al editar: 400", r.status === 400);
// ── vía intermediario ──
  process.env.CLI = "2"; // el cliente de la solicitud (cliente FINAL)
  intermRow = { id: 5, nombre: "Intermedia SA", codigo: "INT", tipo_cliente: "Intermediario", mostrar_logo: 1 };
  propGuardadas.length = 0; consultas.length = 0;
  r = await llamar({ ...base, intermediario_id: 5 });
  const ins = consultas.find((c) => /INSERT INTO Cotizacion/.test(c.sqlText));
  check("vía intermediario: 200, la cotización queda a nombre del intermediario y guarda al cliente final", r.status === 200 && ins && ins.inputs.clienteId === 5 && ins.inputs.clienteFinalId === 2);
  check("el folio usa el código del intermediario", /^AP\d\d-INT-EXCEL-\d\d$/.test(r.body.folio));
  const sn = propGuardadas[0].snapshot;
  check("la propuesta lleva intermediario, cliente final y el logo (permiso + archivo)", sn.cliente === "Intermedia SA" && sn.clienteFinal === "Acme" && sn.intermediario.nombre === "Intermedia SA" && sn.intermediario.logoUrl === "/api/getLogoIntermediario?cliente=5");
  logoExiste = false; propGuardadas.length = 0;
  await llamar({ ...base, intermediario_id: 5 });
  check("sin logo subido: sin logoUrl (solo texto)", propGuardadas[0].snapshot.intermediario.logoUrl === null);
  logoExiste = true; intermRow.mostrar_logo = 0; propGuardadas.length = 0;
  await llamar({ ...base, intermediario_id: 5 });
  check("con 'mostrar logo' apagado: sin logoUrl", propGuardadas[0].snapshot.intermediario.logoUrl === null);
  intermRow.mostrar_logo = 1; intermRow.tipo_cliente = "Directo";
  r = await llamar({ ...base, intermediario_id: 5 });
  check("elegir un cliente que no es Intermediario: 400", r.status === 400);
  intermRow.tipo_cliente = "Intermediario"; process.env.CLI = "5";
  r = await llamar({ ...base, intermediario_id: 5 });
  check("intermediario = cliente final: 400", r.status === 400);
  process.env.CLI = "2"; consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base });
  const ins2 = consultas.find((c) => /INSERT INTO Cotizacion/.test(c.sqlText));
  check("cotización normal: sin cliente final ni intermediario", r.status === 200 && ins2.inputs.clienteFinalId === null && propGuardadas[0].snapshot.intermediario === null && propGuardadas[0].snapshot.clienteFinal === null);
  fila.estatus = "Borrador"; fila.cliente_id = 5; fila.cliente_final_id = null;
  r = await llamar({ ...base, intermediario_id: 5, actualiza_id: 7 });
  check("editar en el lugar un Borrador cambiándole el intermediario: 400", r.status === 400);
  fila.cliente_final_id = 2;
  r = await llamar({ ...base, intermediario_id: 5, actualiza_id: 7 });
  check("editar en el lugar un Borrador vía intermediario (mismos clientes): 200", r.status === 200 && r.body.actualizada === true);

  // ── varios grupos ──
  intermRow = null; process.env.CLI = "2";
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, num_grupos: 3, participantes_num: 12, participantes: "10 a 15" });
  const g3 = consultas.find((c) => /INSERT INTO Cotizacion/.test(c.sqlText));
  check("3 grupos: precio de lista × 3 y 10 % sugerido", r.status === 200 && g3.inputs.numGrupos === 3 && g3.inputs.precioSugerido === 12000 && g3.inputs.descuentoPct === 10 && g3.inputs.precioFinal === 10800);
  const sg = propGuardadas[0].snapshot;
  check("la propuesta lleva grupos, precio por grupo y participantes exactos", sg.grupos === 3 && sg.sugeridoGrupo === 4000 && sg.totalGrupo === 3600 && sg.total === 10800 && sg.participantesNum === 12);
  check("los términos piden OC por el total y fijan 6 meses", sg.terminos.some((t) => /orden de compra \(OC\) por el total de los 3 grupos/.test(t)) && sg.terminos.some((t) => /6 meses/.test(t)));
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, num_grupos: 2, participantes: "10 a 15" });
  const g2 = consultas.find((c) => /INSERT INTO Cotizacion/.test(c.sqlText));
  check("2 grupos: 5 %", g2.inputs.descuentoPct === 5 && g2.inputs.precioFinal === 7600);
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, num_grupos: 1, participantes: "10 a 15" });
  const g1 = consultas.find((c) => /INSERT INTO Cotizacion/.test(c.sqlText));
  check("1 grupo: igual que siempre y sin términos de OC", g1.inputs.numGrupos === 1 && g1.inputs.precioFinal === 4000 && propGuardadas[0].snapshot.grupos === 1 && !propGuardadas[0].snapshot.terminos.some((t) => /orden de compra/.test(t)));

  // ── temas a tu medida ──
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, temas: [{ nombre: "T1", nivel: 1 }], temas_custom: [{ nombre: " Macros de cierre ", objetivo: "Automatizar el cierre", extra: 1 }, { nombre: "" }] });
  check("personalizada con temas a tu medida: el snapshot los lleva (recortados, sin vacíos)", r.status === 200 && JSON.stringify(propGuardadas[0].snapshot.temasCustom) === JSON.stringify([{ n: "Macros de cierre", o: "Automatizar el cierre" }]));
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, temas: [], temas_custom: [{ nombre: "Solo a medida", objetivo: "x" }] });
  check("personalizada solo con temas a tu medida: se permite", r.status === 200 && propGuardadas[0].snapshot.temasCustom.length === 1 && propGuardadas[0].snapshot.temas.length === 0);
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, temas: [], temas_custom: [] });
  check("sin temas de ningún tipo: 400", r.status === 400);
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, temario_tipo: "estandar", temario_nombre: "Excel Básico", temas_custom: [{ nombre: "No aplica", objetivo: "x" }] });
  check("el estándar ignora los temas a tu medida", r.status === 200 && propGuardadas[0].snapshot.temasCustom.length === 0);

  // ── nombre del programa personalizado ──
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, temario_nombre: "Excel para finanzas" });
  check("personalizada con nombre: el título de la propuesta es ese nombre", r.status === 200 && propGuardadas[0].snapshot.programa === "Excel para finanzas");
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, temario_nombre: undefined });
  check("personalizada sin nombre: sigue como Programa personalizado", r.status === 200 && propGuardadas[0].snapshot.programa === "Programa personalizado");

  // ── WhatsApp del contacto del intermediario (sale de su ficha; sin campo manual) ──
  intermRow = { id: 5, nombre: "Intermedia SA", codigo: "INT", tipo_cliente: "Intermediario", mostrar_logo: 0 }; process.env.CLI = "2";
  contactoRow = { nombre: "Paty Ortega", telefono: "+52 (81) 1234-5678", tiene_whatsapp: 1 };
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, intermediario_id: 5, contacto_id: 9 });
  check("vía intermediario: 'Tengo dudas' lleva al WhatsApp del contacto elegido (normalizado)", r.status === 200 && propGuardadas[0].snapshot.contactoWa === "528112345678" && propGuardadas[0].snapshot.contacto === "Paty Ortega");
  contactoRow = { nombre: "Paty Ortega", telefono: "81 1234 5678", tiene_whatsapp: 0 };
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, intermediario_id: 5, contacto_id: 9 });
  check("contacto sin WhatsApp marcado: el botón sigue yendo a Alfredo", r.status === 200 && propGuardadas[0].snapshot.contactoWa === null);
  contactoRow = { nombre: "Paty Ortega", telefono: "123", tiene_whatsapp: 1 };
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, intermediario_id: 5, contacto_id: 9 });
  check("teléfono inválido en la ficha: no rompe, va a Alfredo", r.status === 200 && propGuardadas[0].snapshot.contactoWa === null);
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, intermediario_id: 5 });
  check("vía intermediario sin contacto: va a Alfredo", r.status === 200 && propGuardadas[0].snapshot.contactoWa === null);
  intermRow = null; process.env.CLI = "2"; contactoRow = { nombre: "Ana", telefono: "81 1234 5678", tiene_whatsapp: 1 };
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined, contacto_id: 3 });
  check("sin intermediario: el teléfono del contacto no cambia el botón", r.status === 200 && propGuardadas[0].snapshot.contactoWa === null);

// ── consultoría (por horas, con fases) ──
  intermRow = null; process.env.CLI = "2"; consultas.length = 0; propGuardadas.length = 0;
  const consul = { fases: [{ nombre: "Levantamiento", descripcion: "Entrevistas", horas: 6 }, { nombre: "Tablero", descripcion: "", horas: 10 }], entregables: ["Tablero publicado", "Manual"], imagen: null };
  r = await llamar({ ...base, temario_tipo: "consultoria", temario_nombre: "Tablero de ventas", temas: [], temas_custom: [], proyectos: [], consultoria: consul, horas_totales: 999, participantes: "Solo yo", num_grupos: 4, precio_final: undefined });
  const tCons = consultas.find((c) => /TarifaHerramienta/.test(c.sqlText));
  const iCons = consultas.find((c) => /INSERT INTO Cotizacion/.test(c.sqlText));
  const snC = propGuardadas[0] && propGuardadas[0].snapshot;
  check("consultoría: 200, usa la tarifa 'consultoria' y las horas son la suma de las fases (no las escritas)", r.status === 200 && tCons.inputs.herramienta === "consultoria" && iCons.inputs.horas === 16);
  check("consultoría: 500 × 16 h, sin descuento (ni por grupos ni por participantes) y 1 solo grupo", iCons.inputs.precioSugerido === 8000 && iCons.inputs.descuentoPct === 0 && iCons.inputs.precioFinal === 8000 && iCons.inputs.numGrupos === 1 && iCons.inputs.participantes === null);
  check("consultoría: la propuesta lleva fases con horas, entregables, título, sin adicionales y con sus términos", snC.servicio === "consultoria" && snC.consultoria.fases.length === 2 && snC.consultoria.fases[1].h === 10 && snC.consultoria.entregables.length === 2 && snC.programa === "Tablero de ventas" && snC.adicionales.length === 0 && snC.terminos.some((t) => /horas estimadas/.test(t)) && snC.grupos === 1);
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, temario_tipo: "consultoria", temas: [], consultoria: { fases: [] }, precio_final: undefined });
  check("consultoría sin fases: 400", r.status === 400 && propGuardadas.length === 0);
  consultas.length = 0; propGuardadas.length = 0;
  r = await llamar({ ...base, precio_final: undefined });
  check("una cotización normal sigue siendo capacitación (sin consultoría en el snapshot)", r.status === 200 && propGuardadas[0].snapshot.servicio === "capacitacion" && propGuardadas[0].snapshot.consultoria === null);

    console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : "\nTodas las pruebas pasaron.");
  process.exit(fallos ? 1 : 0);
})();
