// api/src/solicitud-publica-cola.js
// Cola de solicitudes del formulario público (cursos.html → crearSolicitudPublica).
//
// POR QUÉ EXISTE: la base SQL (apcweb-backoffice) se duerme sola y despertarla
// tarda 30-60 s o más. Antes el formulario escribía directo a SQL: con la base
// dormida el visitante esperaba, veía "Seguimos intentando…" y a veces un error
// (o cerraba la ventana y la solicitud se perdía). Ahora el formulario SOLO
// escribe aquí, en Table Storage (que nunca se duerme), responde en ~1 s, y la
// solicitud pasa a SQL ("drenado") la próxima vez que la base esté despierta
// porque Alfredo abre el admin — ver drenarPendientes y quién lo llama.
//
// Idempotencia: la fila de la cola se llama como la "llave" del envío (hash de
// contacto+empresa+programa+detalles), así un reintento del navegador no crea
// otra fila. Y al pasar a SQL se conserva el candado (sp_getapplock) y la
// búsqueda de una Solicitud igual ya creada, por si el drenado se interrumpe
// entre el INSERT y el borrado de la fila de la cola.
const crypto = require("crypto");
const { TableClient } = require("@azure/data-tables");

const TABLA = "SolicitudesPendientes";
const PARTICION = "pend";
const MAX_POR_DRENADO = 25;
const VENTANA_DUPLICADO_MIN = 30;

function getColaTable() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return TableClient.fromConnectionString(conn, TABLA);
}

let tablaLista = false;
async function asegurarTabla(table) {
  if (tablaLista) return;
  try {
    await table.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err;
  }
  tablaLista = true;
}

function llaveDeEnvio(d) {
  return crypto
    .createHash("sha1")
    .update(
      [d.nombreContacto, d.correo, d.telefono, d.empresaNombre, d.herramienta, d.temarioNombre, d.participantesRaw, d.modalidad, d.comentarios]
        .map((x) => (x || "").toString().toLowerCase())
        .join("|")
    )
    .digest("hex");
}

function derivarCodigo(nombre) {
  const base = (nombre || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "EMPRESA";
  return base + Math.floor(100 + Math.random() * 900);
}

// Guarda la solicitud en la cola. { nueva:false } si ese mismo envío ya estaba
// (reintento del navegador): no se vuelve a contar para los límites ni a avisar.
async function encolar(table, llave, datos, ahora = new Date()) {
  await asegurarTabla(table);
  try {
    await table.createEntity({ partitionKey: PARTICION, rowKey: llave, recibidoEn: ahora.toISOString(), datos: JSON.stringify(datos) });
    return { nueva: true };
  } catch (err) {
    if (err.statusCode === 409) return { nueva: false };
    throw err;
  }
}

// Pasa UNA solicitud de la cola a SQL (misma lógica que tenía crearSolicitudPublica:
// transacción + candado por llave + búsqueda de duplicado). Devuelve { id, duplicada }.
// `sql`/`resolverCliente` se reciben para poder probar el drenado sin base real.
async function insertarEnSql(pool, sql, resolverCliente, llave, datos, recibidoEn) {
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const nuevaRequest = () => new sql.Request(transaction);

    const lock = await nuevaRequest()
      .input("recurso", sql.NVarChar, "solpub_" + llave)
      .query("DECLARE @r INT; EXEC @r = sp_getapplock @Resource = @recurso, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 40000; SELECT @r AS r");
    if (lock.recordset[0].r < 0) throw new Error("No se obtuvo el candado del envío (código " + lock.recordset[0].r + ")");

    const previa = await nuevaRequest()
      .input("herramienta", sql.NVarChar, datos.herramienta)
      .input("temarioNombre", sql.NVarChar, datos.temarioNombre)
      .input("nombre", sql.NVarChar, datos.nombreContacto)
      .input("correo", sql.NVarChar, datos.correo || "")
      .input("telefono", sql.NVarChar, datos.telefono || "")
      .input("empresa", sql.NVarChar, datos.empresaNombre)
      .input("participantes", sql.NVarChar, datos.participantes || "")
      .input("modalidad", sql.NVarChar, datos.modalidad || "")
      .input("notas", sql.NVarChar, datos.notas || "")
      .input("recibido", sql.DateTime2, recibidoEn)
      .input("ventana", sql.Int, VENTANA_DUPLICADO_MIN)
      .query(
        `SELECT TOP 1 s.id
           FROM Solicitud s
           JOIN Contacto c ON c.id = s.contacto_id
           JOIN Cliente cl ON cl.id = s.cliente_id
          WHERE s.canal_origen = 'Sitio'
            AND s.fecha_creacion >= DATEADD(MINUTE, -@ventana, @recibido)
            AND s.herramienta = @herramienta AND s.temario_nombre = @temarioNombre
            AND c.nombre = @nombre AND ISNULL(c.correo, '') = @correo AND ISNULL(c.telefono, '') = @telefono
            AND cl.nombre = @empresa
            AND ISNULL(s.participantes, '') = @participantes AND ISNULL(s.modalidad, '') = @modalidad
            AND ISNULL(s.notas, '') = @notas
          ORDER BY s.id`
      );
    if (previa.recordset.length) {
      await transaction.commit();
      return { id: previa.recordset[0].id, duplicada: true };
    }

    const cliente = await resolverCliente(nuevaRequest, { nombre: datos.empresaNombre, codigo: derivarCodigo(datos.empresaNombre) });

    const insertContacto = await nuevaRequest()
      .input("clienteId", sql.Int, cliente.id)
      .input("nombre", sql.NVarChar, datos.nombreContacto)
      .input("correo", sql.NVarChar, datos.correo)
      .input("telefono", sql.NVarChar, datos.telefono)
      .input("tieneWhatsapp", sql.Bit, datos.telefono ? 1 : 0)
      .query(
        `INSERT INTO Contacto (cliente_id, nombre, correo, telefono, tiene_whatsapp, es_principal)
         OUTPUT INSERTED.id
         VALUES (@clienteId, @nombre, @correo, @telefono, @tieneWhatsapp, 1)`
      );

    // fecha_creacion/fecha_estatus = cuándo la ENVIÓ el visitante, no cuándo se
    // drenó: el semáforo de horas sin atender de Solicitudes cuenta desde ahí
    const insert = await nuevaRequest()
      .input("clienteId", sql.Int, cliente.id)
      .input("contactoId", sql.Int, insertContacto.recordset[0].id)
      .input("herramienta", sql.NVarChar, datos.herramienta)
      .input("temarioNombre", sql.NVarChar, datos.temarioNombre)
      .input("temasJson", sql.NVarChar, JSON.stringify(datos.temas || []))
      .input("horasTotales", sql.Decimal(6, 1), datos.horasTotales)
      .input("notas", sql.NVarChar, datos.notas)
      .input("participantes", sql.NVarChar, datos.participantes)
      .input("modalidad", sql.NVarChar, datos.modalidad)
      .input("creoProspecto", sql.Bit, cliente.creado ? 1 : 0)
      .input("recibido", sql.DateTime2, recibidoEn)
      .query(
        `INSERT INTO Solicitud
          (cliente_id, contacto_id, herramienta, temario_tipo, temario_nombre, temas_json, horas_totales, canal_origen, notas,
           fecha_tentativa, ciudad_sede, participantes, modalidad, fecha_creacion, fecha_estatus, creo_prospecto)
         OUTPUT INSERTED.id
         VALUES
          (@clienteId, @contactoId, @herramienta, 'estandar', @temarioNombre, @temasJson, @horasTotales, 'Sitio', @notas,
           NULL, NULL, @participantes, @modalidad, @recibido, @recibido, @creoProspecto)`
      );

    await transaction.commit();
    return { id: insert.recordset[0].id, duplicada: false };
  } catch (err) {
    try { await transaction.rollback(); } catch (_) { /* ya cerrada */ }
    throw err;
  }
}

// Drena la cola hacia SQL. NUNCA lanza (la lee el admin al abrir paneles: un
// problema aquí no debe tumbar la carga). `insertar(llave, datos, recibidoEn)`
// es quien escribe en SQL (en producción, insertarEnSql con la base real).
// Devuelve cuántas pasó. Una sola corrida a la vez por instancia: si ya hay una
// en curso, las demás llamadas esperan ESA misma (el admin dispara 3 lecturas
// juntas al abrir).
let enCurso = null;
async function drenarPendientes(table, insertar, context) {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    let pasadas = 0;
    try {
      await asegurarTabla(table);
      const pendientes = [];
      for await (const e of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTICION}'` } })) {
        pendientes.push(e);
        if (pendientes.length >= MAX_POR_DRENADO) break;
      }
      pendientes.sort((a, b) => String(a.recibidoEn).localeCompare(String(b.recibidoEn)));
      for (const e of pendientes) {
        try {
          const datos = JSON.parse(e.datos);
          await insertar(e.rowKey, datos, new Date(e.recibidoEn));
          try { await table.deleteEntity(PARTICION, e.rowKey); } catch (errDel) { if (errDel.statusCode !== 404) throw errDel; }
          pasadas++;
        } catch (err) {
          if (context) context.log.error("Cola de solicitudes: no se pudo pasar " + e.rowKey + " a SQL:", err.message);
        }
      }
    } catch (err) {
      if (context) context.log.error("Cola de solicitudes: no se pudo drenar:", err.message);
    }
    return pasadas;
  })();
  try {
    return await enCurso;
  } finally {
    enCurso = null;
  }
}

// Atajo para las Functions del admin: drena con la base real. Nunca lanza.
async function drenarConSql(pool, context) {
  const { sql } = require("./backoffice-db");
  const { resolverCliente } = require("./cliente-resolver");
  try {
    return await drenarPendientes(getColaTable(), (llave, datos, recibidoEn) => insertarEnSql(pool, sql, resolverCliente, llave, datos, recibidoEn), context);
  } catch (err) {
    if (context) context.log.error("Cola de solicitudes: no se pudo iniciar el drenado:", err.message);
    return 0;
  }
}

module.exports = { getColaTable, llaveDeEnvio, encolar, insertarEnSql, drenarPendientes, drenarConSql, derivarCodigo };
