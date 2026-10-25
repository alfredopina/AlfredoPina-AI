// test-avisos-destinos.js — destinatarios por aviso (Configuración → Notificaciones) y el aviso "nueva cuenta por cobrar". Sin red: Table Storage, el SDK de
// correo y la base simulados. Datos ficticios.
const Module = require("module");
const assert = require("assert");

const tablas = {};
function fakeTable(nombre) {
  const filas = tablas[nombre] || (tablas[nombre] = new Map());
  const k = (p, r) => p + "|" + r;
  const nf = () => { const e = new Error("nf"); e.statusCode = 404; return e; };
  return {
    createTable: async () => {},
    getEntity: async (p, r) => { const e = filas.get(k(p, r)); if (!e) throw nf(); return { ...e }; },
    upsertEntity: async (e, modo) => { const a = filas.get(k(e.partitionKey, e.rowKey)); filas.set(k(e.partitionKey, e.rowKey), modo === "Merge" && a ? { ...a, ...e } : { ...e }); },
  };
}
const enviados = [];
let filaCuenta = [{ concepto: "Power BI Avanzado", total: 11600, cliente: "Instituto Ejemplo", cotizacion_folio: "AP26-IE-PBI-01", grupo_codigo: null, nombre_curso: null }];
let poolFalla = false;
const original = Module._load;
Module._load = function (request) {
  if (request === "@azure/data-tables") return { TableClient: { fromConnectionString: (c, nombre) => fakeTable(nombre) } };
  if (request === "@azure/communication-email") return { EmailClient: class { beginSend(m) { enviados.push(m); return Promise.resolve({}); } } };
  if (/\/backoffice-db$/.test(request)) {
    return {
      sql: { Int: "int" },
      getPool: async () => {
        if (poolFalla) throw new Error("base dormida");
        return { request: () => { const q = { input() { return q; }, query: async () => ({ recordset: filaCuenta }) }; return q; } };
      },
    };
  }
  return original.apply(this, arguments);
};

process.env.RECURSOS_STORAGE_CONNECTION = "fake";
process.env.ACS_EMAIL_CONNECTION = "endpoint=https://fake;accesskey=x";
process.env.NOTIFICACIONES_REMITENTE = "notificaciones@ejemplo.test";
process.env.NOTIFICACIONES_DESTINO = "alfredo@ejemplo.test";
const A = require("./src/notificaciones-ajustes");
const { enviarCorreo, notificarCuentaCobranza } = require("./src/notificaciones-correo");
const { avisarCuentaNueva } = require("./src/cobranza-aviso");

let fallos = 0;
const check = async (n, fn) => { try { await fn(); console.log("  OK " + n); } catch (e) { console.log("  FALLA " + n + " → " + e.message); fallos++; } };
const destinatarios = () => enviados[enviados.length - 1].recipients.to.map((x) => x.address);

(async () => {
  await check("el aviso nuevo existe, está encendido y cada aviso tiene su campo de destinatarios", async () => {
    const a = await A.getAjustes();
    assert.strictEqual(a.nuevaCuentaCobranza, true);
    for (const t of A.TIPOS) assert.ok(t in A.CAMPO_DESTINO && typeof a[A.CAMPO_DESTINO[t]] === "string", "falta el campo de " + t);
    assert.strictEqual(A.CAMPO_DESTINO.resumenSemanal, "destinoResumen", "el del resumen sigue siendo el de siempre");
  });
  await check("guardar destinatarios de un aviso: valida el formato y el máximo", async () => {
    const r = await A.actualizarAjustes({ destinoNuevaCuentaCobranza: "viri@ejemplo.test, alfredo@ejemplo.test" });
    assert.strictEqual(r.destinoNuevaCuentaCobranza, "viri@ejemplo.test, alfredo@ejemplo.test");
    await assert.rejects(A.actualizarAjustes({ destinoPropuestaAbierta: "no-es-correo" }), /no parece un correo/);
    await assert.rejects(A.actualizarAjustes({ destinoNuevaSolicitud: "a@x.co,b@x.co,c@x.co,d@x.co,e@x.co,f@x.co" }), /Máximo 5/);
    assert.strictEqual((await A.getAjustes()).destinoPropuestaAbierta, "", "lo inválido no se guardó");
  });
  await check("cada aviso sale a SUS destinatarios; vacío = NOTIFICACIONES_DESTINO", async () => {
    await A.actualizarAjustes({ destinoPropuestaAceptada: "otra@ejemplo.test" });
    enviados.length = 0;
    await enviarCorreo({ tipo: "nuevaCuentaCobranza", asunto: "x", texto: "x", html: "x" });
    assert.deepStrictEqual(destinatarios(), ["viri@ejemplo.test", "alfredo@ejemplo.test"]);
    await enviarCorreo({ tipo: "propuestaAceptada", asunto: "x", texto: "x", html: "x" });
    assert.deepStrictEqual(destinatarios(), ["otra@ejemplo.test"]);
    await enviarCorreo({ tipo: "propuestaAbierta", asunto: "x", texto: "x", html: "x" });
    assert.deepStrictEqual(destinatarios(), ["alfredo@ejemplo.test"], "sin destinatarios propios: el correo de siempre");
  });
  await check("un destino pasado a mano (el resumen) manda sobre el configurado; sin tipo (las pruebas) va al correo de siempre", async () => {
    enviados.length = 0;
    await enviarCorreo({ tipo: "nuevaCuentaCobranza", destino: ["x@ejemplo.test"], asunto: "x", texto: "x", html: "x" });
    assert.deepStrictEqual(destinatarios(), ["x@ejemplo.test"]);
    await enviarCorreo({ asunto: "prueba", texto: "x", html: "x" });
    assert.deepStrictEqual(destinatarios(), ["alfredo@ejemplo.test"]);
  });
  await check("apagar el aviso, o el interruptor general, impide el envío", async () => {
    enviados.length = 0;
    await A.actualizarAjustes({ nuevaCuentaCobranza: false });
    assert.strictEqual((await enviarCorreo({ tipo: "nuevaCuentaCobranza", asunto: "x", texto: "x", html: "x" })).motivo, "desactivado");
    await A.actualizarAjustes({ nuevaCuentaCobranza: true, general: false });
    assert.strictEqual((await enviarCorreo({ tipo: "nuevaCuentaCobranza", asunto: "x", texto: "x", html: "x" })).motivo, "desactivado");
    await A.actualizarAjustes({ general: true });
    assert.strictEqual(enviados.length, 0);
  });
  await check("el correo de cuenta nueva trae cliente, concepto, monto, origen y enlace; sin monto dice 'por definir'", async () => {
    enviados.length = 0;
    await notificarCuentaCobranza({ cliente: "Acme <SA>", concepto: "Curso", total: 11600, origen: "Grupo GR-01" });
    let m = enviados[0];
    assert.ok(/Por facturar: Acme/.test(m.content.subject));
    assert.ok(m.content.plainText.includes("Cliente: Acme <SA>") && m.content.plainText.includes("Grupo GR-01") && /11,600\.00/.test(m.content.plainText) && m.content.plainText.includes("alfredopina.ai/admin"));
    assert.ok(m.content.html.includes("Acme &lt;SA&gt;"), "el HTML escapa el nombre");
    await notificarCuentaCobranza({ cliente: "Acme", concepto: "Curso", total: 0, origen: "Grupo GR-02" });
    assert.ok(/Por definir/.test(enviados[1].content.plainText));
  });
  await check("avisarCuentaNueva lee la cuenta, arma el origen (cotización o grupo) y envía", async () => {
    enviados.length = 0;
    const r = await avisarCuentaNueva(5);
    assert.strictEqual(r.enviado, true);
    assert.ok(/Cotización AP26-IE-PBI-01 ganada/.test(enviados[0].content.plainText) && /Instituto Ejemplo/.test(enviados[0].content.plainText));
    filaCuenta = [{ concepto: "Excel", total: 0, cliente: "Beta", cotizacion_folio: null, grupo_codigo: "GR-9", nombre_curso: "Excel" }];
    await avisarCuentaNueva(6);
    assert.ok(/Grupo GR-9/.test(enviados[1].content.plainText) && /Por definir/.test(enviados[1].content.plainText));
  });
  await check("avisarCuentaNueva NUNCA lanza (base dormida, cuenta inexistente, sin id)", async () => {
    poolFalla = true;
    assert.strictEqual((await avisarCuentaNueva(5)).enviado, false);
    poolFalla = false;
    filaCuenta = [];
    assert.strictEqual((await avisarCuentaNueva(99)).enviado, false);
    assert.strictEqual((await avisarCuentaNueva(null)).enviado, false);
  });

  console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : "\ntest-avisos-destinos: ok");
  process.exit(fallos ? 1 : 0);
})();
