// enviarDiagnostico/index.js
// Function pública: recibe un envío completo de diagnostico.html (nombre + empresa + herramienta + respuestas), lo
// califica y lo deja en la COLA (Table Storage) — NUNCA toca SQL: así 30-60 personas contestando a cualquier hora no
// despiertan ni mantienen despierta la base (ver api/src/diagnostico-cola.js). El envío pasa a SQL cuando Alfredo abre
// el panel Diagnósticos o pulsa "Importar ahora" (importarDiagnosticosPendientes).
//
// fue_correcta y nivel se calculan AQUÍ, comparando contra el banco de preguntas de este momento (Table Storage) —
// es una foto: si la pregunta se edita después, la respuesta ya guardada no se recalcula. Nunca se confía en lo que
// mande el cliente para esto.
//
// Reglas (2026-10-13):
//   · una persona no contesta dos veces: misma empresa + herramienta + nombre (sin acentos/mayúsculas) → 409. El mismo
//     dispositivo o la misma IP SÍ pueden enviar varios (otra persona en la misma computadora): no se limita por IP.
//   · `envioId` (UUID del navegador) hace idempotente el reintento: el mismo envío dos veces no se duplica.
//   · SOLO con link/QR dedicado por cliente (2026-10-13): la empresa llega como clienteId y se valida al IMPORTAR, que es cuando
//     existe la base. Ya no se acepta una empresa tecleada (juntaba variantes de nombre y creaba Prospectos basura).
const crypto = require("crypto");
const { getDiagnosticoPreguntasTable, listarPreguntas } = require("../src/diagnostico-tables");
const { getDiagnosticoContadorTable, ajustarContadorDiagnostico } = require("../src/diagnostico-contador");
const { getColaTable, getHuellasTable, huellaDe, registrarHuella, liberarHuella, encolar } = require("../src/diagnostico-cola");
const { JSON_HEADERS } = require("../src/http");

const HERRAMIENTAS = ["excel", "powerbi"];
// 'N' = "No lo sé" — nunca es igual a opcion_correcta (siempre A-D), así que cuenta como incorrecta sin caso especial.
const OPCIONES = ["A", "B", "C", "D", "N"];
const ENVIO_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const MAX_RESPUESTAS = 60;

const recorta = (s, n) => String(s == null ? "" : s).trim().slice(0, n);
const responde = (context, status, body) => { context.res = { status, headers: JSON_HEADERS, body }; };

module.exports = async function (context, req) {
  const body = req.body || {};
  const nombre = recorta(body.nombre, 120);
  const herramienta = recorta(body.herramienta, 20).toLowerCase();
  const empresaIn = body.empresa || {};
  const respuestas = Array.isArray(body.respuestas) ? body.respuestas : [];
  const area = recorta(body.area, 120) || null;
  const correo = recorta(body.correo, 160) || null;
  const tiempoRespuestaSeg = Number.isFinite(Number(body.tiempoRespuestaSeg)) ? Math.max(0, Math.round(Number(body.tiempoRespuestaSeg))) : null;
  const envioId = ENVIO_ID_RE.test(String(body.envioId || "")) ? String(body.envioId) : crypto.randomUUID();

  if (!nombre) return responde(context, 400, { error: "Falta tu nombre." });
  if (!HERRAMIENTAS.includes(herramienta)) return responde(context, 400, { error: "Herramienta inválida." });
  if (!respuestas.length) return responde(context, 400, { error: "No hay respuestas que guardar." });
  if (respuestas.length > MAX_RESPUESTAS) return responde(context, 400, { error: "Demasiadas respuestas." });
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return responde(context, 400, { error: "El correo no se ve válido." });

  const clienteId = Number(empresaIn.clienteId);
  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    return responde(context, 400, { error: "Este diagnóstico se contesta con el link o el QR que te dio tu instructor para tu empresa — pídeselo." });
  }
  const empresa = { clienteId };

  // preguntas reales de esta herramienta, para calificar (Table Storage: no depende de la base)
  let preguntasPorId;
  try {
    const entidades = await listarPreguntas(getDiagnosticoPreguntasTable(), herramienta);
    preguntasPorId = new Map(entidades.map((e) => [e.rowKey, { nivel: e.nivel, opcion_correcta: e.opcion_correcta }]));
  } catch (err) {
    context.log.error("Error leyendo el banco de preguntas:", err.message);
    return responde(context, 500, { error: "No se pudo procesar tu envío en este momento." });
  }

  const detalles = [];
  for (const r of respuestas) {
    const preguntaId = recorta(r && r.preguntaId, 64);
    const opcion = recorta(r && r.opcionSeleccionada, 1).toUpperCase();
    if (!preguntaId || !OPCIONES.includes(opcion)) continue;
    const pregunta = preguntasPorId.get(preguntaId);
    if (!pregunta) continue; // pregunta borrada entre que se cargó el form y se envió — se omite, no truena el envío
    detalles.push({ preguntaId, nivel: pregunta.nivel, opcion, fue: opcion === pregunta.opcion_correcta });
  }
  if (!detalles.length) return responde(context, 400, { error: "Las preguntas cambiaron mientras contestabas — abre el diagnóstico de nuevo." });

  try {
    const huellas = getHuellasTable();
    const huella = huellaDe(empresa, herramienta, nombre);
    const estado = await registrarHuella(huellas, huella, envioId);
    if (estado === "repetida") {
      return responde(context, 409, { error: "Ya recibimos un diagnóstico con ese nombre para esta empresa. Si eres otra persona con el mismo nombre, agrega tu segundo apellido o inicial." });
    }

    const datos = { nombre, herramienta, empresa, area, correo, tiempoRespuestaSeg, detalles };
    let r;
    try {
      r = await encolar(getColaTable(), envioId, datos, huella);
    } catch (err) {
      if (estado === "nueva") { try { await liberarHuella(huellas, huella); } catch (_) { /* caduca sola */ } }
      throw err;
    }

    if (r.nueva) {
      // contador en vivo del admin (Table Storage) — cuenta al ENCOLAR; best-effort: el envío ya quedó guardado, y el
      // botón "Recalcular desde SQL" lo corrige si se desfasa.
      try {
        await ajustarContadorDiagnostico(getDiagnosticoContadorTable(), herramienta, 1);
      } catch (errContador) {
        context.log.error("No se pudo sumar al contador de diagnósticos:", errContador.message);
      }
    }
    return responde(context, 200, r.nueva ? { ok: true } : { ok: true, duplicada: true });
  } catch (err) {
    context.log.error("Error guardando el diagnóstico en la cola:", err.message);
    return responde(context, 500, { error: "No se pudo guardar tu diagnóstico en este momento." });
  }
};
