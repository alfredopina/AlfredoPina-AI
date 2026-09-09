// crearSolicitud/index.js
// Function protegida (rol "admin"): alta de una Solicitud. El cliente se
// resuelve igual que en generarDiplomas/enviarRespuesta (clienteId existente,
// o nombre+código para dar de alta uno nuevo) — duplicado a propósito, mismo
// criterio que ya usa el proyecto. temas_json es una FOTO completa del
// desglose de temas (id/nombre/descripcion/horas/nivel) al momento de crear
// la solicitud — se guarda tanto para "personalizado" (los temas marcados)
// como para "estandar" (los temas que trae ese temario), porque Alfredo lo
// necesita para armar el desglose de la Cotización después; no es una
// referencia viva a Temas en Table Storage, así que un cambio futuro al
// banco de temas no altera solicitudes ya capturadas.
// fecha_tentativa/ciudad_sede/participantes/modalidad replican los mismos
// campos que ya pide el formulario público de contacto en cursos.html, para
// que el modelo quede alineado con lo que un futuro form público (canal_origen
// "Sitio") va a mandar. canal_origen siempre es "Manual" desde este form.
const { getPool, sql } = require("../src/backoffice-db");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");

const TEMARIO_TIPOS = ["estandar", "personalizado"];
const MODALIDADES = ["Online", "Presencial", "Híbrido"];
const PARTICIPANTES_OPCIONES = ["Solo yo", "5 a 10", "10 a 15", "Más de 15"];

function limpiarCodigo(codigo) {
  return (codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function resolverCliente(pool, empresa) {
  const clienteId = empresa.clienteId ? Number(empresa.clienteId) : null;

  if (clienteId) {
    const r = await pool.request().input("id", sql.Int, clienteId).query("SELECT id, nombre, codigo FROM Cliente WHERE id = @id");
    if (!r.recordset.length) throw new Error("El cliente seleccionado ya no existe.");
    return r.recordset[0];
  }

  const nombre = (empresa.nombre || "").trim();
  const codigo = limpiarCodigo(empresa.codigo);
  if (!nombre || !codigo) throw new Error("Falta el nombre o el código de la empresa nueva.");

  const existente = await pool.request().input("codigo", sql.NVarChar, codigo).query("SELECT id, nombre, codigo FROM Cliente WHERE codigo = @codigo");
  if (existente.recordset.length) return existente.recordset[0];

  const insert = await pool
    .request()
    .input("nombre", sql.NVarChar, nombre)
    .input("codigo", sql.NVarChar, codigo)
    .query("INSERT INTO Cliente (nombre, codigo) OUTPUT INSERTED.id, INSERTED.nombre, INSERTED.codigo VALUES (@nombre, @codigo)");
  return insert.recordset[0];
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const empresa = body.empresa || {};
  const contactoId = body.contacto_id ? Number(body.contacto_id) : null;
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const temarioTipo = (body.temario_tipo || "").trim();
  const temarioNombre = (body.temario_nombre || "").trim() || null;
  const temas = Array.isArray(body.temas) ? body.temas : [];
  const horasTotales = Number(body.horas_totales);
  const notas = (body.notas || "").trim() || null;
  const fechaTentativa = (body.fecha_tentativa || "").trim() || null;
  const ciudadSede = (body.ciudad_sede || "").trim() || null;
  const participantes = (body.participantes || "").trim() || null;
  const modalidad = (body.modalidad || "").trim() || null;

  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }
  if (!TEMARIO_TIPOS.includes(temarioTipo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El tipo de temario debe ser estándar o personalizado." } };
    return;
  }
  if (temarioTipo === "estandar" && !temarioNombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el temario estándar." } };
    return;
  }
  if (!temas.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el desglose de temas." } };
    return;
  }
  if (!Number.isFinite(horasTotales) || horasTotales <= 0) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Las horas totales no son válidas." } };
    return;
  }
  if (modalidad && !MODALIDADES.includes(modalidad)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Modalidad inválida." } };
    return;
  }
  if (participantes && !PARTICIPANTES_OPCIONES.includes(participantes)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Participantes inválido." } };
    return;
  }

  let pool, cliente;
  try {
    pool = await getPool();
    cliente = await resolverCliente(pool, empresa);
  } catch (err) {
    context.log.error("Error resolviendo el cliente:", err.message);
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: err.message } };
    return;
  }

  try {
    const insert = await pool
      .request()
      .input("clienteId", sql.Int, cliente.id)
      .input("contactoId", sql.Int, contactoId)
      .input("herramienta", sql.NVarChar, herramienta)
      .input("temarioTipo", sql.NVarChar, temarioTipo)
      .input("temarioNombre", sql.NVarChar, temarioTipo === "estandar" ? temarioNombre : null)
      .input("temasJson", sql.NVarChar, JSON.stringify(temas))
      .input("horasTotales", sql.Decimal(6, 1), horasTotales)
      .input("notas", sql.NVarChar, notas)
      .input("fechaTentativa", sql.NVarChar, fechaTentativa)
      .input("ciudadSede", sql.NVarChar, ciudadSede)
      .input("participantes", sql.NVarChar, participantes)
      .input("modalidad", sql.NVarChar, modalidad)
      .query(
        `INSERT INTO Solicitud
          (cliente_id, contacto_id, herramienta, temario_tipo, temario_nombre, temas_json, horas_totales, canal_origen, notas,
           fecha_tentativa, ciudad_sede, participantes, modalidad)
         OUTPUT INSERTED.id
         VALUES
          (@clienteId, @contactoId, @herramienta, @temarioTipo, @temarioNombre, @temasJson, @horasTotales, 'Manual', @notas,
           @fechaTentativa, @ciudadSede, @participantes, @modalidad)`
      );
    context.res = { status: 200, headers: JSON_HEADERS, body: { id: insert.recordset[0].id, cliente } };
  } catch (err) {
    context.log.error("Error creando la solicitud:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo crear la solicitud." } };
  }
};
