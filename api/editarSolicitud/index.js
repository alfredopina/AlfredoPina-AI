// editarSolicitud/index.js
// Function protegida (rol "admin"): edita una Solicitud existente — nace del
// flujo de Cotizaciones ("Editar" en la lista de Solicitudes activas para
// cotizar, o desde dentro de la vista de Cotizar antes de confirmar). Mismas
// validaciones que crearSolicitud, pero UPDATE en vez de INSERT. cliente_id y
// canal_origen NO son editables aquí a propósito — cambiar de empresa a una
// Solicitud ya capturada es un caso raro que, si pasa, se resuelve mejor
// descartando esta y creando una nueva.
const { getPool, sql } = require("../src/backoffice-db");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");

const TEMARIO_TIPOS = ["estandar", "personalizado"];
const MODALIDADES = ["Online", "Presencial", "Híbrido"];
const PARTICIPANTES_OPCIONES = ["Solo yo", "5 a 10", "10 a 15", "Más de 15"];

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = Number(body.id);
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

  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id de la solicitud." } };
    return;
  }
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

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
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
        `UPDATE Solicitud SET
           contacto_id = @contactoId, herramienta = @herramienta, temario_tipo = @temarioTipo,
           temario_nombre = @temarioNombre, temas_json = @temasJson, horas_totales = @horasTotales,
           notas = @notas, fecha_tentativa = @fechaTentativa, ciudad_sede = @ciudadSede,
           participantes = @participantes, modalidad = @modalidad
         WHERE id = @id`
      );
    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa solicitud ya no existe." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error editando la solicitud:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar la edición." } };
  }
};
