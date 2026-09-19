// Links de encuesta por Grupo + contadores en vivo — todo en Table Storage
// (tabla "EncuestaLinks"), nunca en SQL, por dos razones:
//
// 1. La página pública lee el snapshot del grupo desde aquí al cargar (cero
//    SQL, la base serverless puede estar dormida).
// 2. Los contadores de "Respuestas en vivo" del admin salen de aquí: el admin
//    los consulta cada 10 s y NO debe despertar/mantener despierta la base
//    (esa fue la causa raíz del incidente de vCore-seconds de 2026-09-17).
//    enviarRespuesta ya toca SQL en ese momento, así que ahí mismo suma 1 acá.
//
// Entidades (todas en la misma tabla, distinguidas por PartitionKey):
//   "link"     / RowKey = token opaco  → snapshot del grupo + abierta + respuestas
//   "contador" / RowKey = "global"     → total + hoy (hoyFecha = día en hora México)
const { TableClient } = require("@azure/data-tables");
const crypto = require("crypto");
const { ensureTable, isTableNotFound } = require("./encuesta-tables");
const { fechaMexico } = require("./encuesta-logic");
const { actualizarConReintento } = require("./table-contador");

function getConnectionString() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return conn;
}

function getEncuestaLinksTable() {
  return TableClient.fromConnectionString(getConnectionString(), "EncuestaLinks");
}

function nuevoToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

// Lo que ve la página pública y el admin — nunca se expone el objeto crudo.
function entidadALink(e) {
  return {
    token: e.rowKey,
    grupoId: e.grupoId,
    clienteId: e.clienteId,
    clienteNombre: e.clienteNombre,
    curso: e.curso,
    instructor: e.instructor,
    herramientas: e.herramientas || "[]",
    horas: typeof e.horas === "number" ? e.horas : null,
    modalidad: e.modalidad || null,
    fechaInicio: e.fechaInicio || null,
    fechaFin: e.fechaFin || null,
    abierta: e.abierta !== false,
    generadoEn: e.generadoEn,
    respuestas: typeof e.respuestas === "number" ? e.respuestas : 0,
  };
}

async function leerLink(table, token) {
  try {
    const e = await table.getEntity("link", token);
    return entidadALink(e);
  } catch (err) {
    if (err.statusCode === 404 || isTableNotFound(err)) return null;
    throw err;
  }
}

async function listarLinks(table) {
  const items = [];
  try {
    for await (const e of table.listEntities({ queryOptions: { filter: "PartitionKey eq 'link'" } })) items.push(entidadALink(e));
  } catch (err) {
    if (!isTableNotFound(err)) throw err;
  }
  return items;
}

// grupoId se guarda como texto para que el filtro OData sea inequívoco
// (un número entero puede quedar como Int32 o Double según el SDK).
async function buscarLinkPorGrupo(table, grupoId) {
  try {
    for await (const e of table.listEntities({ queryOptions: { filter: `PartitionKey eq 'link' and grupoId eq '${String(grupoId).replace(/'/g, "''")}'` } })) {
      return entidadALink(e);
    }
  } catch (err) {
    if (!isTableNotFound(err)) throw err;
  }
  return null;
}

// Crea o refresca el link de un grupo: un solo token por grupo, siempre el
// mismo (el QR impreso no caduca) — volver a "generar" solo actualiza el
// snapshot con los datos vigentes del Grupo y conserva token/abierta/conteo.
async function guardarLinkDeGrupo(table, snapshot) {
  await ensureTable(table);
  const existente = await buscarLinkPorGrupo(table, snapshot.grupoId);
  const token = existente ? existente.token : nuevoToken();
  const entidad = {
    partitionKey: "link",
    rowKey: token,
    grupoId: String(snapshot.grupoId),
    clienteId: snapshot.clienteId,
    clienteNombre: snapshot.clienteNombre,
    curso: snapshot.curso,
    instructor: snapshot.instructor,
    herramientas: snapshot.herramientas || "[]",
    modalidad: snapshot.modalidad || "",
    fechaInicio: snapshot.fechaInicio || "",
    fechaFin: snapshot.fechaFin || "",
    abierta: existente ? existente.abierta : true,
    generadoEn: existente ? existente.generadoEn : new Date().toISOString(),
    respuestas: existente ? existente.respuestas : 0,
  };
  if (snapshot.horas != null) entidad.horas = Number(snapshot.horas);
  await table.upsertEntity(entidad, "Replace");
  return leerLink(table, token);
}

async function cambiarEstadoLink(table, token, abierta) {
  await table.updateEntity({ partitionKey: "link", rowKey: token, abierta: !!abierta }, "Merge");
}

// delta = +1 al enviar una respuesta, -1 al borrarla. token = null para el
// link genérico (solo cuenta en el global). `descontarHoy` (solo aplica al
// restar): borrar una respuesta de hace días NO debe bajar el "hoy" — solo se
// resta de "hoy" si la respuesta borrada fue de hoy.
async function ajustarContadores(table, { token, delta, descontarHoy = true }) {
  await ensureTable(table);
  const hoyFecha = fechaMexico(new Date());
  const deltaHoy = delta > 0 || descontarHoy ? delta : 0;

  await actualizarConReintento(
    table, "contador", "global",
    (e) => {
      const mismoDia = e.hoyFecha === hoyFecha;
      return { total: Math.max(0, (e.total || 0) + delta), hoyFecha, hoy: Math.max(0, (mismoDia ? e.hoy || 0 : 0) + deltaHoy) };
    },
    () => ({ total: Math.max(0, delta), hoyFecha, hoy: Math.max(0, deltaHoy) })
  );

  if (token) {
    try {
      await actualizarConReintento(table, "link", token, (e) => ({ respuestas: Math.max(0, (e.respuestas || 0) + delta) }), () => ({ respuestas: 0 }));
    } catch (err) {
      // el token ya no existe (no debería pasar) — el global ya quedó bien
    }
  }
}

async function leerContadores(table) {
  const hoyFecha = fechaMexico(new Date());
  let total = 0, hoy = 0;
  try {
    const e = await table.getEntity("contador", "global");
    total = e.total || 0;
    hoy = e.hoyFecha === hoyFecha ? e.hoy || 0 : 0;
  } catch (err) {
    if (err.statusCode !== 404 && !isTableNotFound(err)) throw err;
  }
  const links = await listarLinks(table);
  return { total, hoy, links: links.map((l) => ({ token: l.token, respuestas: l.respuestas, abierta: l.abierta })) };
}

module.exports = {
  getEncuestaLinksTable,
  nuevoToken,
  leerLink,
  listarLinks,
  buscarLinkPorGrupo,
  guardarLinkDeGrupo,
  cambiarEstadoLink,
  ajustarContadores,
  leerContadores,
};
