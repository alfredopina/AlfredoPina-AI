// api/src/diagnostico-cola.js
// Cola de envíos del Diagnóstico (diagnostico.html → enviarDiagnostico), mismo patrón que la cola de
// Solicitudes (solicitud-publica-cola.js): la persona SOLO escribe en Table Storage (nunca se duerme, ~1 s) y el
// envío pasa a SQL ("importación") cuando Alfredo abre el panel Diagnósticos o pulsa "Importar ahora".
//
// POR QUÉ: un cliente puede mandar el diagnóstico a 30-60 personas con una semana para contestarlo, a cualquier
// hora. Escribiendo directo a SQL cada envío (y cada apertura de la página) despertaba la base y la dejaba
// despierta 20-30 min: en el peor caso, casi toda la cuota gratis del mes (100 000 vCore-s) por un solo cliente.
//
// Piezas (copiadas de Solicitudes, ajustadas a Diagnóstico):
//   · llave idempotente = envioId (UUID que genera el navegador): un reintento no crea otra fila (409 = ya estaba).
//   · "una persona no contesta dos veces": una HUELLA por (empresa, herramienta, nombre normalizado). Es un hash, no
//     guarda el nombre. Caduca a los DIAS_HUELLA días (por si repite el diagnóstico después del curso) y se libera al
//     eliminar la respuesta o descartar el pendiente. Mismo dispositivo / misma IP SÍ puede enviar varios (otra persona).
//   · importación: nunca lanza, una sola corrida a la vez por instancia, con tope de tiempo (la Function admite 45 s),
//     las filas con error se reintentan al final y se quedan visibles (ultimoError) para que Alfredo las vea.
//   · la calificación (fue_correcta/nivel) se calcula AL ENCOLAR con el banco de ese momento (enviarDiagnostico).
const crypto = require("crypto");
const { TableClient } = require("@azure/data-tables");
const { ensureTable, HERRAMIENTAS } = require("./diagnostico-tables");
const { crearCola, MAX_POR_CORRIDA } = require("./cola-tabla");

const TABLA = "DiagnosticoPendientes";
const TABLA_HUELLAS = "DiagnosticoHuellas";
const DIAS_HUELLA = 30;

// la mecánica de la cola (encolar idempotente, resumen, importar con tope) es la genérica de cola-tabla.js
const cola = crearCola({ tabla: TABLA });
const getColaTable = cola.getTable;
function getHuellasTable() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return TableClient.fromConnectionString(conn, TABLA_HUELLAS);
}

let huellasLista = false;
async function asegurarHuellas(table) {
  if (huellasLista) return;
  await ensureTable(table);
  huellasLista = true;
}
function _reiniciar() { huellasLista = false; cola.reiniciar(); }

const notFound = (err) => err && err.statusCode === 404;

// ── identidad de la persona ──
function normalizarNombre(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
}
function limpiarCodigo(s) { return String(s || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }

// Dónde vive la huella: por Cliente si el link ya lo trae (c<id>), por el código tecleado si no (n<CODIGO>).
function huellaDe(empresa, herramienta, nombre) {
  const e = empresa || {};
  const scope = e.clienteId ? "c" + Number(e.clienteId) : "n" + (limpiarCodigo(e.codigo || e.nombre) || "EMPRESA");
  const rk = crypto.createHash("sha256").update("diag|" + normalizarNombre(nombre)).digest("hex").slice(0, 40);
  return { pk: scope + "|" + herramienta, rk };
}

// "nueva" | "mismo" (mismo envío reintentado) | "repetida" (otra vez la misma persona)
async function registrarHuella(table, h, envioId, ahora = new Date()) {
  await asegurarHuellas(table);
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    let previa = null;
    try { previa = await table.getEntity(h.pk, h.rk); } catch (err) { if (!notFound(err)) throw err; }
    if (!previa) {
      try {
        await table.createEntity({ partitionKey: h.pk, rowKey: h.rk, envioId, en: ahora.toISOString() });
        return "nueva";
      } catch (err) { if (err.statusCode === 409) continue; throw err; } // alguien la creó justo ahora: se vuelve a leer
    }
    if (previa.envioId === envioId) return "mismo";
    const edadDias = (ahora.getTime() - Date.parse(previa.en || 0)) / 86400000;
    if (edadDias >= DIAS_HUELLA) {
      await table.upsertEntity({ partitionKey: h.pk, rowKey: h.rk, envioId, en: ahora.toISOString() }, "Replace");
      return "nueva";
    }
    return "repetida";
  }
  return "repetida";
}

async function liberarHuella(table, h) {
  try { await table.deleteEntity(h.pk, h.rk); } catch (err) { if (!notFound(err)) throw err; }
}

// ── encolar ──
// datos = { nombre, herramienta, empresa:{clienteId}|{nombre,codigo}, area, correo, tiempoRespuestaSeg, detalles:[{preguntaId,nivel,opcion,fue}] }
// → { nueva:false } si ese envío ya estaba (reintento del navegador).
async function encolar(table, envioId, datos, huella, ahora = new Date()) {
  return cola.encolar(table, envioId, {
    herramienta: datos.herramienta, nombre: datos.nombre.slice(0, 120),
    empresaTxt: String((datos.empresa && datos.empresa.nombre) || (datos.empresa && datos.empresa.clienteId ? "cliente #" + datos.empresa.clienteId : "")).slice(0, 120),
    huellaPk: huella.pk, huellaRk: huella.rk, datos: JSON.stringify(datos),
  }, ahora);
}

// ── lectura para el admin (solo Table Storage: no despierta la base) ──
// { total, excel, powerbi, errores, lista:[{id,nombre,empresa,herramienta,recibidoEn,intentos,error}] } (lista = solo las que tienen error)
async function resumenPendientes(table) {
  const r = await cola.resumen(table, {
    select: ["herramienta", "nombre", "empresaTxt"],
    agrupar: (e, acc) => { if (HERRAMIENTAS.includes(e.herramienta)) acc[e.herramienta] = (acc[e.herramienta] || 0) + 1; },
    fila: (e) => ({ id: e.rowKey, nombre: e.nombre, empresa: e.empresaTxt, herramienta: e.herramienta, recibidoEn: e.recibidoEn, intentos: e.intentos || 0, error: e.ultimoError }),
  });
  return { total: r.total, excel: r.excel || 0, powerbi: r.powerbi || 0, errores: r.errores, lista: r.lista };
}

// ── importar a SQL ──
function errorSeguro(mensaje) { const e = new Error(mensaje); e.safe = true; return e; }

// Pasa UN envío de la cola a SQL en una transacción. Idempotente: si una corrida anterior se cortó entre el COMMIT y el
// borrado de la fila, la repetición encuentra la respuesta (mismo cliente+herramienta+nombre+fecha_envio) y no la duplica.
async function insertarEnSql(pool, sql, resolverCliente, envioId, datos, recibidoEn) {
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const nuevaRequest = () => new sql.Request(transaction);

    const lock = await nuevaRequest()
      .input("recurso", sql.NVarChar, "diag_" + envioId)
      .query("DECLARE @r INT; EXEC @r = sp_getapplock @Resource = @recurso, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 40000; SELECT @r AS r");
    if (lock.recordset[0].r < 0) throw new Error("No se obtuvo el candado del envío (código " + lock.recordset[0].r + ")");

    const cliente = await resolverCliente(nuevaRequest, datos.empresa, "Prospecto", { crearError: errorSeguro, origen: "Diagnóstico" });

    const previa = await nuevaRequest()
      .input("clienteId", sql.Int, cliente.id)
      .input("herramienta", sql.VarChar, datos.herramienta)
      .input("nombre", sql.NVarChar, datos.nombre)
      .input("recibido", sql.DateTime2, recibidoEn)
      .query("SELECT TOP 1 id FROM DiagnosticoRespuesta WHERE cliente_id = @clienteId AND herramienta = @herramienta AND nombre = @nombre AND fecha_envio = @recibido");
    if (previa.recordset.length) {
      await transaction.commit();
      return { id: previa.recordset[0].id, duplicada: true };
    }

    const cab = await nuevaRequest()
      .input("nombre", sql.NVarChar, datos.nombre)
      .input("clienteId", sql.Int, cliente.id)
      .input("herramienta", sql.VarChar, datos.herramienta)
      .input("area", sql.NVarChar, datos.area || null)
      .input("correo", sql.NVarChar, datos.correo || null)
      .input("tiempoRespuestaSeg", sql.Int, datos.tiempoRespuestaSeg == null ? null : datos.tiempoRespuestaSeg)
      .input("recibido", sql.DateTime2, recibidoEn)
      .query(
        `INSERT INTO DiagnosticoRespuesta (nombre, cliente_id, herramienta, area, correo, tiempo_respuesta_seg, fecha_envio)
         OUTPUT INSERTED.id
         VALUES (@nombre, @clienteId, @herramienta, @area, @correo, @tiempoRespuestaSeg, @recibido)`
      );
    const respuestaId = cab.recordset[0].id;

    // el detalle va en un solo INSERT de varias filas (una ida a la base en vez de una por pregunta)
    const detalles = datos.detalles || [];
    if (detalles.length) {
      const req = nuevaRequest().input("respuestaId", sql.Int, respuestaId);
      const filas = detalles.map((d, i) => {
        req.input("p" + i, sql.NVarChar, d.preguntaId).input("n" + i, sql.TinyInt, d.nivel).input("o" + i, sql.Char, d.opcion).input("f" + i, sql.Bit, d.fue ? 1 : 0);
        return `(@respuestaId, @p${i}, @n${i}, @o${i}, @f${i})`;
      });
      await req.query(`INSERT INTO DiagnosticoRespuestaDetalle (respuesta_id, pregunta_id, nivel, opcion_seleccionada, fue_correcta) VALUES ${filas.join(", ")}`);
    }

    await transaction.commit();
    return { id: respuestaId, duplicada: false };
  } catch (err) {
    try { await transaction.rollback(); } catch (_) { /* ya cerrada */ }
    throw err;
  }
}

// Importa la cola (ver cola-tabla.js: nunca lanza, tope de filas/tiempo, una corrida a la vez, las fallidas al final).
// `insertar(envioId, datos, recibidoEn)` escribe en SQL (en producción, insertarEnSql).
function importarPendientes(table, insertar, context, opciones) {
  return cola.importar(table, insertar, context, opciones);
}

// Atajo para las Functions del admin: importa con la base real. Nunca lanza.
async function importarConSql(pool, context, opciones) {
  const { sql } = require("./backoffice-db");
  const { resolverCliente } = require("./cliente-resolver");
  try {
    return await importarPendientes(getColaTable(), (id, datos, recibidoEn) => insertarEnSql(pool, sql, resolverCliente, id, datos, recibidoEn), context, opciones);
  } catch (err) {
    if (context) context.log.error("Cola de diagnósticos: no se pudo iniciar la importación:", err.message);
    return { importadas: 0, errores: 0, restantes: 0 };
  }
}

// Descarta un pendiente (borrado real, con confirmación en el front): libera la huella para que la persona pueda reintentar.
// → { herramienta } | null si ya no estaba.
async function descartar(table, huellas, envioId) {
  const fila = await cola.leer(table, envioId);
  if (!fila) return null;
  await cola.borrar(table, envioId);
  if (fila.huellaPk && fila.huellaRk) { try { await liberarHuella(huellas, { pk: fila.huellaPk, rk: fila.huellaRk }); } catch (_) { /* caduca sola */ } }
  return { herramienta: fila.herramienta };
}

module.exports = {
  getColaTable, getHuellasTable, normalizarNombre, huellaDe, registrarHuella, liberarHuella, encolar, resumenPendientes,
  insertarEnSql, importarPendientes, importarConSql, descartar, DIAS_HUELLA, MAX_POR_CORRIDA, _reiniciar,
};
