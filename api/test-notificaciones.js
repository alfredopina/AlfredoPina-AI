// Prueba de api/src/notificaciones-correo.js con el SDK de Azure simulado: apagado sin configuración,
// contenido del aviso, y que ningún fallo (error o tiempo agotado) llegue a lanzar.
const assert = require("assert");
const Module = require("module");

const llamadas = [];
let modo = "ok";
const original = Module._load;
Module._load = function (request) {
  if (request === "@azure/communication-email") {
    return {
      EmailClient: class {
        constructor(conexion) { this.conexion = conexion; }
        beginSend(mensaje) {
          llamadas.push({ conexion: this.conexion, mensaje });
          if (modo === "error") return Promise.reject(new Error("fallo simulado"));
          if (modo === "colgado") return new Promise(() => {});
          return Promise.resolve({ ok: true });
        }
      },
    };
  }
  return original.apply(this, arguments);
};

const { enviarCorreo, notificarSolicitudNueva } = require("./src/notificaciones-correo");

const datos = {
  id: 7, nombre: "Ana <b>Pérez</b>", empresa: "ACME", correo: "ana@acme.com", telefono: "81 1234 5678",
  programa: "Excel Básico-Intermedio", herramienta: "excel", horas: 16, participantes: "7", modalidad: "Online", comentarios: "Con kick off\nY grabación",
};

(async () => {
  delete process.env.ACS_EMAIL_CONNECTION; delete process.env.NOTIFICACIONES_REMITENTE; delete process.env.NOTIFICACIONES_DESTINO;

  // sin configuración: apagado, sin llamar al SDK, sin lanzar
  let r = await notificarSolicitudNueva(datos);
  assert.strictEqual(r.enviado, false); assert.strictEqual(llamadas.length, 0);

  // configuración incompleta (falta el destino): también apagado
  process.env.ACS_EMAIL_CONNECTION = "endpoint=https://x.communication.azure.com/;accesskey=secreto";
  process.env.NOTIFICACIONES_REMITENTE = "notificaciones@alfredopina.ai";
  r = await enviarCorreo({ asunto: "x", texto: "x", html: "x" });
  assert.strictEqual(r.enviado, false); assert.strictEqual(llamadas.length, 0);

  // configurado: se envía con remitente, destino(s) y contenido correctos
  process.env.NOTIFICACIONES_DESTINO = "alfredo.pina@lifezen.com.mx, otro@ejemplo.com";
  r = await notificarSolicitudNueva(datos);
  assert.strictEqual(r.enviado, true); assert.strictEqual(llamadas.length, 1);
  const m = llamadas[0].mensaje;
  assert.strictEqual(m.senderAddress, "notificaciones@alfredopina.ai");
  assert.deepStrictEqual(m.recipients.to.map((x) => x.address), ["alfredo.pina@lifezen.com.mx", "otro@ejemplo.com"]);
  assert.strictEqual(m.content.subject, "Nueva solicitud: Excel Básico-Intermedio — ACME");
  assert.ok(m.content.plainText.includes("WhatsApp: 81 1234 5678") && m.content.plainText.includes("Participantes: 7") && m.content.plainText.includes("https://www.alfredopina.ai/admin"));
  assert.ok(m.content.html.includes("Ana &lt;b&gt;Pérez&lt;/b&gt;") && !m.content.html.includes("<b>Pérez</b>"), "el HTML escapa lo que escribe el visitante");
  assert.ok(m.content.html.includes("white-space:pre-line"), "los saltos de línea de los comentarios se respetan");

  // sin empresa: el asunto usa el nombre, y no se repite el campo Empresa
  await notificarSolicitudNueva({ ...datos, empresa: datos.nombre, nombre: "Luis" , programa: "Power BI Básico" });
  await notificarSolicitudNueva({ ...datos, nombre: "Luis", empresa: "Luis", programa: "Power BI Básico" });
  const m2 = llamadas[llamadas.length - 1].mensaje;
  assert.strictEqual(m2.content.subject, "Nueva solicitud: Power BI Básico — Luis");
  assert.ok(!m2.content.plainText.includes("Empresa:"));

  // fallos: nunca lanzan
  modo = "error";
  r = await notificarSolicitudNueva(datos);
  assert.strictEqual(r.enviado, false); assert.ok(/fallo simulado/.test(r.motivo));
  modo = "colgado";
  const t0 = Date.now();
  r = await notificarSolicitudNueva(datos);
  assert.strictEqual(r.enviado, false); assert.ok(/tiempo de espera/.test(r.motivo));
  assert.ok(Date.now() - t0 < 8000, "el tiempo de espera corta el aviso colgado");

  console.log("test-notificaciones: ok");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
