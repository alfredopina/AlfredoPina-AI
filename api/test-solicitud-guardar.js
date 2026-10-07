// Prueba de api/src/solicitud-guardar.js (alta y edición manual de Solicitudes) con una "base" falsa:
// qué se inserta/actualiza, y los casos que deben fallar (código repetido, contacto ajeno, etc.).
const assert = require("assert");
const g = require("./src/solicitud-guardar");

function fabrica(handler) {
  const llamadas = [];
  const nuevaRequest = () => {
    const params = {};
    const r = {
      input(n, _t, v) { params[n] = v; return r; },
      async query(texto) {
        llamadas.push({ texto, params: { ...params } });
        const res = handler(texto, params);
        return { recordset: res || [], rowsAffected: [1] };
      },
    };
    return r;
  };
  return { nuevaRequest, llamadas, hubo: (frag) => llamadas.filter((c) => c.texto.includes(frag)) };
}

async function rechaza(promesa, status, regex) {
  try { await promesa; } catch (e) {
    assert.ok(e.safe, "error 'seguro' para mostrar: " + e.message);
    assert.strictEqual(e.status, status, e.message);
    if (regex) assert.ok(regex.test(e.message), e.message);
    return;
  }
  assert.fail("debía fallar");
}

const base = {
  herramienta: "excel", temario_tipo: "estandar", temario_nombre: "Excel Básico", temas: [{ nombre: "Fórmulas", horas: 4 }], horas_totales: 16,
};
const prospecto = {
  ...base, es_cliente: false, empresa: { nombre: "Acme Industrial", codigo: "acm" },
  contacto_datos: { nombre: "Ana", correo: "ANA@acme.com", telefono: "81 1234 5678" },
};

(async () => {
  // ── participantes / notas ──
  assert.deepStrictEqual(g.mapearParticipantes("5 a 10"), { columna: "5 a 10", nota: null });
  assert.deepStrictEqual(g.mapearParticipantes("7"), { columna: "5 a 10", nota: "Participantes: 7" });
  assert.deepStrictEqual(g.mapearParticipantes("3"), { columna: null, nota: "Participantes: 3" });
  assert.strictEqual(g.mapearParticipantes("abc"), null);
  assert.strictEqual(g.aplicarNotaParticipantes("Hola\nParticipantes: 3", "Participantes: 7"), "Hola\nParticipantes: 7", "la línea se reemplaza, no se duplica");
  assert.strictEqual(g.aplicarNotaParticipantes("Hola\nParticipantes: 3", null), "Hola", "si ya no hace falta, se quita");

  // ── validaciones de entrada ──
  await rechaza(g.crearSolicitudManual(fabrica(() => []).nuevaRequest, { ...prospecto, horas_totales: 0 }), 400, /horas/i);
  await rechaza(g.crearSolicitudManual(fabrica(() => []).nuevaRequest, { ...prospecto, temas: [] }), 400);
  await rechaza(g.crearSolicitudManual(fabrica(() => []).nuevaRequest, { ...prospecto, participantes: "muchos" }), 400, /participantes/i);
  await rechaza(g.crearSolicitudManual(fabrica(() => []).nuevaRequest, { ...prospecto, recibida_el: new Date(Date.now() + 86400000).toISOString() }), 400, /futura/);
  await rechaza(g.crearSolicitudManual(fabrica(() => []).nuevaRequest, { ...prospecto, contacto_datos: { nombre: "Ana" } }), 400, /correo o WhatsApp/);
  await rechaza(g.crearSolicitudManual(fabrica(() => []).nuevaRequest, { ...prospecto, es_cliente: true, empresa: {} }), 400, /cliente/i);

  // ── crear: Prospecto nuevo ──
  let f = fabrica((t) => {
    if (t.startsWith("SELECT id, nombre FROM Cliente WHERE UPPER(codigo)")) return [];
    if (t.startsWith("INSERT INTO Cliente")) return [{ id: 11, nombre: "Acme Industrial", codigo: "ACM" }];
    if (t.startsWith("INSERT INTO Contacto")) return [{ id: 5 }];
    if (t.startsWith("INSERT INTO Solicitud")) return [{ id: 100 }];
    return [];
  });
  let r = await g.crearSolicitudManual(f.nuevaRequest, { ...prospecto, participantes: "7", notas: "Kick off", objetivo: "no debe guardarse", recibida_el: "2026-10-05T15:00:00Z" });
  assert.strictEqual(r.id, 100);
  assert.strictEqual(f.hubo("INSERT INTO Cliente")[0].params.codigo, "ACM", "el código se limpia y sube a mayúsculas");
  const insC = f.hubo("INSERT INTO Contacto")[0];
  assert.strictEqual(insC.params.correo, "ana@acme.com");
  assert.strictEqual(insC.params.tieneWhatsapp, 1);
  const insS = f.hubo("INSERT INTO Solicitud")[0].params;
  assert.strictEqual(insS.creoProspecto, 1, "esta solicitud dio de alta al Prospecto");
  assert.strictEqual(insS.participantes, "5 a 10");
  assert.strictEqual(insS.notas, "Kick off\nParticipantes: 7");
  assert.strictEqual(insS.objetivo, null, "el programa estándar no guarda objetivo propio");
  assert.strictEqual(insS.temarioNombre, "Excel Básico");
  assert.ok(insS.recibida instanceof Date && insS.recibida.toISOString() === "2026-10-05T15:00:00.000Z");
  assert.ok(f.hubo("INSERT INTO Solicitud")[0].texto.includes("'Manual'"));

  // ── crear: código repetido NO se reutiliza ──
  f = fabrica((t) => (t.startsWith("SELECT id, nombre FROM Cliente WHERE UPPER(codigo)") ? [{ id: 3, nombre: "Acme SA de CV" }] : []));
  await rechaza(g.crearSolicitudManual(f.nuevaRequest, prospecto), 409, /ACM ya existe \(Acme SA de CV\)/);
  assert.strictEqual(f.hubo("INSERT").length, 0, "no inserta nada");

  // ── crear: personalizado guarda objetivo/alcance/dirigido ──
  f = fabrica((t) => {
    if (t.startsWith("SELECT id, nombre, codigo, tipo_cliente FROM Cliente")) return [{ id: 20, nombre: "Beta", codigo: "BET", tipo_cliente: "Directo" }];
    if (t.startsWith("INSERT INTO Solicitud")) return [{ id: 101 }];
    return [];
  });
  r = await g.crearSolicitudManual(f.nuevaRequest, {
    ...base, temario_tipo: "personalizado", temario_nombre: "ignorado", es_cliente: true, empresa: { clienteId: 20 },
    objetivo: " Automatizar reportes ", alcance: "3 sesiones", dirigido_a: "Finanzas", horas_totales: "12.25",
  });
  const p2 = f.hubo("INSERT INTO Solicitud")[0].params;
  assert.strictEqual(p2.creoProspecto, 0);
  assert.strictEqual(p2.contactoId, null);
  assert.strictEqual(p2.temarioNombre, null, "personalizado no lleva nombre de programa");
  assert.deepStrictEqual([p2.objetivo, p2.alcance, p2.dirigidoA], ["Automatizar reportes", "3 sesiones", "Finanzas"]);
  assert.strictEqual(p2.horas, 12.3, "horas a un decimal (columna DECIMAL(6,1))");
  assert.strictEqual(p2.proyectosJson, null, "sin proyectos elegidos no se guarda nada");
  assert.strictEqual(f.hubo("INSERT INTO Cliente").length, 0, "cliente existente: no crea empresa");

  // ── crear: personalizado con proyectos (el estándar los ignora) ──
  const proy = [{ id: "pr1", nombre: "Dashboard de ventas", resumen: "Un tablero", extra: "x" }, { nombre: "sin id" }];
  f = fabrica((t) => (t.startsWith("SELECT id, nombre, codigo, tipo_cliente FROM Cliente") ? [{ id: 20, nombre: "Beta", codigo: "BET", tipo_cliente: "Directo" }] : t.startsWith("INSERT INTO Solicitud") ? [{ id: 103 }] : []));
  await g.crearSolicitudManual(f.nuevaRequest, { ...base, temario_tipo: "personalizado", es_cliente: true, empresa: { clienteId: 20 }, proyectos: proy });
  assert.deepStrictEqual(JSON.parse(f.hubo("INSERT INTO Solicitud")[0].params.proyectosJson), [{ id: "pr1", nombre: "Dashboard de ventas", resumen: "Un tablero" }]);
  f = fabrica((t) => (t.startsWith("SELECT id, nombre, codigo, tipo_cliente FROM Cliente") ? [{ id: 20, nombre: "Beta", codigo: "BET", tipo_cliente: "Directo" }] : t.startsWith("INSERT INTO Solicitud") ? [{ id: 104 }] : []));
  await g.crearSolicitudManual(f.nuevaRequest, { ...base, es_cliente: true, empresa: { clienteId: 20 }, proyectos: proy });
  assert.strictEqual(f.hubo("INSERT INTO Solicitud")[0].params.proyectosJson, null, "el estándar no guarda proyectos propios");

  // ── crear: contacto de otro cliente se rechaza ──
  f = fabrica((t) => {
    if (t.startsWith("SELECT id, nombre, codigo, tipo_cliente FROM Cliente")) return [{ id: 20, nombre: "Beta", codigo: "BET", tipo_cliente: "Directo" }];
    if (t.startsWith("SELECT id, cliente_id FROM Contacto")) return [{ id: 9, cliente_id: 99 }];
    return [];
  });
  await rechaza(g.crearSolicitudManual(f.nuevaRequest, { ...base, es_cliente: true, empresa: { clienteId: 20 }, contacto_id: 9 }), 400, /no pertenece/);

  // ── crear: cliente existente + contacto nuevo (primer contacto = principal por SQL) ──
  f = fabrica((t) => {
    if (t.startsWith("SELECT id, nombre, codigo, tipo_cliente FROM Cliente")) return [{ id: 20, nombre: "Beta", codigo: "BET", tipo_cliente: "Directo" }];
    if (t.startsWith("INSERT INTO Contacto")) return [{ id: 7 }];
    if (t.startsWith("INSERT INTO Solicitud")) return [{ id: 102 }];
    return [];
  });
  await g.crearSolicitudManual(f.nuevaRequest, { ...base, es_cliente: true, empresa: { clienteId: 20 }, contacto_datos: { nombre: "Luis" } });
  assert.strictEqual(f.hubo("INSERT INTO Solicitud")[0].params.contactoId, 7);
  assert.ok(f.hubo("INSERT INTO Contacto")[0].texto.includes("CASE WHEN EXISTS"), "es_principal solo si el cliente no tenía principal");

  // ── editar: Prospecto → Cliente existente (contacto nuevo para el cliente y borra el Prospecto vacío) ──
  const actual = { cliente_id: 11, contacto_id: 5, creo_prospecto: true, tipo_cliente: "Prospecto" };
  const hEditar = (bloqueos) => (t) => {
    if (t.includes("FROM Solicitud s JOIN Cliente c")) return [actual];
    if (t.startsWith("SELECT id, nombre, codigo, tipo_cliente FROM Cliente")) return [{ id: 20, nombre: "Beta", codigo: "BET", tipo_cliente: "Directo" }];
    if (t.startsWith("INSERT INTO Contacto")) return [{ id: 31 }];
    if (t.startsWith("SELECT COUNT(*)")) return [{ n: bloqueos && t.includes("FROM Cotizacion") ? 1 : 0 }];
    return [];
  };
  const cuerpoCliente = { ...base, es_cliente: true, empresa: { clienteId: 20 }, contacto_datos: { nombre: "Ana Pérez", correo: "ana@acme.com", telefono: "81 1234 5678" } };
  f = fabrica(hEditar(false));
  r = await g.editarSolicitudManual(f.nuevaRequest, 50, cuerpoCliente);
  assert.strictEqual(r.prospectoAnteriorBorrado, true);
  assert.strictEqual(f.hubo("INSERT INTO Contacto")[0].params.clienteId, 20, "el contacto se captura como contacto NUEVO del cliente");
  assert.strictEqual(f.hubo("UPDATE Solicitud SET")[0].params.clienteId, 20);
  assert.strictEqual(f.hubo("UPDATE Solicitud SET")[0].params.contactoId, 31);
  assert.ok(f.hubo("DELETE FROM Contacto").length === 1, "los contactos del prospecto viejo se van con él");
  assert.ok(f.hubo("DELETE FROM Cliente").length === 1 && f.hubo("DELETE FROM Cliente")[0].params.id === 11);
  assert.ok(f.hubo("creo_prospecto = 0").length === 1, "ya no cuenta como prospecto generado");
  // el UPDATE de la solicitud va ANTES del conteo de dependencias (si no, la propia solicitud bloquearía el borrado)
  assert.ok(f.llamadas.findIndex((c) => c.texto.startsWith("UPDATE Solicitud SET")) < f.llamadas.findIndex((c) => c.texto.startsWith("SELECT COUNT(*)")));

  // ── editar: el Prospecto viejo tiene otras cosas → se conserva ──
  f = fabrica(hEditar(true));
  r = await g.editarSolicitudManual(f.nuevaRequest, 50, cuerpoCliente);
  assert.strictEqual(r.prospectoAnteriorBorrado, false);
  assert.strictEqual(f.hubo("DELETE FROM Cliente").length, 0);

  // ── editar: mismo Prospecto, se corrige nombre/código/contacto ──
  f = fabrica((t) => {
    if (t.includes("FROM Solicitud s JOIN Cliente c")) return [actual];
    if (t.startsWith("SELECT id, nombre FROM Cliente WHERE UPPER(codigo)")) return [];
    if (t.startsWith("SELECT id, cliente_id FROM Contacto")) return [{ id: 5, cliente_id: 11 }];
    return [];
  });
  r = await g.editarSolicitudManual(f.nuevaRequest, 50, { ...prospecto, empresa: { clienteId: 11, nombre: "Acme Industrial SA", codigo: "ACME" }, contacto_id: 5 });
  assert.strictEqual(f.hubo("SELECT id, nombre FROM Cliente WHERE UPPER(codigo)")[0].params.excluir, 11, "al validar el código se excluye al propio Prospecto");
  assert.strictEqual(f.hubo("UPDATE Cliente SET nombre")[0].params.codigo, "ACME");
  assert.strictEqual(f.hubo("UPDATE Contacto SET nombre")[0].params.nombre, "Ana", "se corrigen los datos del contacto");
  assert.strictEqual(f.hubo("INSERT INTO Cliente").length, 0);
  assert.strictEqual(r.prospectoAnteriorBorrado, null);

  // ── editar: código nuevo que ya existe en otro cliente ──
  f = fabrica((t) => {
    if (t.includes("FROM Solicitud s JOIN Cliente c")) return [actual];
    if (t.startsWith("SELECT id, nombre FROM Cliente WHERE UPPER(codigo)")) return [{ id: 3, nombre: "Otra" }];
    return [];
  });
  await rechaza(g.editarSolicitudManual(f.nuevaRequest, 50, { ...prospecto, empresa: { clienteId: 11, nombre: "Acme", codigo: "OTR" }, contacto_id: 5 }), 409, /ya existe/);

  // ── editar: Cliente → Prospecto nuevo (contacto nuevo, el del cliente se queda con el cliente) ──
  f = fabrica((t) => {
    if (t.includes("FROM Solicitud s JOIN Cliente c")) return [{ cliente_id: 20, contacto_id: 8, creo_prospecto: false, tipo_cliente: "Directo" }];
    if (t.startsWith("SELECT id, nombre FROM Cliente WHERE UPPER(codigo)")) return [];
    if (t.startsWith("INSERT INTO Cliente")) return [{ id: 30, nombre: "Nuevo", codigo: "NUE" }];
    if (t.startsWith("INSERT INTO Contacto")) return [{ id: 31 }];
    return [];
  });
  r = await g.editarSolicitudManual(f.nuevaRequest, 50, { ...prospecto, empresa: { nombre: "Nuevo", codigo: "nue" } });
  const up = f.hubo("UPDATE Solicitud SET")[0].params;
  assert.deepStrictEqual([up.clienteId, up.contactoId, up.creoProspecto], [30, 31, 1]);
  assert.strictEqual(f.hubo("UPDATE Contacto SET cliente_id").length, 0, "nunca se mueve un contacto entre clientes");
  assert.strictEqual(f.hubo("DELETE FROM Cliente").length, 0, "un Cliente real nunca se borra");

  // ── editar: solicitud inexistente ──
  await rechaza(g.editarSolicitudManual(fabrica(() => []).nuevaRequest, 999, cuerpoCliente), 404);

  // ── editar con "recibida el": mueve fecha_creacion ──
  f = fabrica(hEditar(false));
  await g.editarSolicitudManual(f.nuevaRequest, 50, { ...cuerpoCliente, empresa: { clienteId: 20 }, recibida_el: "2026-10-01T10:00:00Z" });
  assert.ok(f.hubo("UPDATE Solicitud SET")[0].params.recibida instanceof Date);

  console.log("test-solicitud-guardar: ok");
})().catch((e) => { console.error(e); process.exit(1); });
