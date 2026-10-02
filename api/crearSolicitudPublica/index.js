// crearSolicitudPublica/index.js
// Function PÚBLICA (anonymous, sin rol — no listada en staticwebapp.config.json
// a propósito, igual que getCatalogoCursos): el formulario de cursos.html crea
// aquí la Solicitud real en vez de solo abrir WhatsApp/correo. Mismo contrato
// que crearSolicitud (admin), con 3 diferencias:
//   - canal_origen siempre 'Sitio' (crearSolicitud ya traía el comentario
//     anticipando esto).
//   - el form público no pide "código" de empresa (fricción innecesaria para
//     un prospecto frío) — se deriva uno de su nombre + sufijo random para no
//     chocar con un código real existente.
//   - valida un honeypot (campo "web", oculto por CSS) como único filtro
//     antispam — no hay rate-limit real todavía, ver CLAUDE_DETALLE.md.
// contacto_id se deja NULL (resolver un Contacto real es trabajo de otra
// tanda); el nombre de quien llena el form va dentro de notas.
const { getPool, sql } = require("../src/backoffice-db");
const { resolverCliente } = require("../src/cliente-resolver");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");

const MODALIDADES = ["Online", "Presencial", "Híbrido"];
const PARTICIPANTES_OPCIONES = ["Solo yo", "5 a 10", "10 a 15", "Más de 15"];

function derivarCodigo(nombre) {
  const base = (nombre || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "EMPRESA";
  return base + Math.floor(100 + Math.random() * 900);
}

module.exports = async function (context, req) {
  const body = req.body || {};

  // honeypot: un humano nunca llena este campo (oculto por CSS en el form)
  if ((body.web || "").trim()) {
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
    return;
  }

  const nombreContacto = (body.nombre || "").trim();
  const empresaNombre = (body.empresa || "").trim() || nombreContacto;
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const temarioNombre = (body.temario_nombre || "").trim();
  const temas = Array.isArray(body.temas) ? body.temas : [];
  const horasTotales = Number(body.horas_totales);
  const fechaTentativa = (body.fecha_tentativa || "").trim() || null;
  const ciudadSede = (body.ciudad_sede || "").trim() || null;
  const participantes = (body.participantes || "").trim() || null;
  const modalidad = (body.modalidad || "").trim() || null;
  const comentarios = (body.comentarios || "").trim();

  if (!nombreContacto) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta tu nombre." } };
    return;
  }
  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }
  if (!temarioNombre) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el temario." } };
    return;
  }
  if (!Number.isFinite(horasTotales) || horasTotales <= 0) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Las horas no son válidas." } };
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

  const notas = comentarios ? `Contacto: ${nombreContacto} — ${comentarios}` : `Contacto: ${nombreContacto}`;

  let pool, cliente;
  try {
    pool = await getPool();
    cliente = await resolverCliente(pool, { nombre: empresaNombre, codigo: derivarCodigo(empresaNombre) });
  } catch (err) {
    context.log.error("Error resolviendo el cliente (público):", err.message);
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "No se pudo procesar tu solicitud, inténtalo de nuevo." } };
    return;
  }

  try {
    const insert = await pool
      .request()
      .input("clienteId", sql.Int, cliente.id)
      .input("herramienta", sql.NVarChar, herramienta)
      .input("temarioNombre", sql.NVarChar, temarioNombre)
      .input("temasJson", sql.NVarChar, JSON.stringify(temas))
      .input("horasTotales", sql.Decimal(6, 1), horasTotales)
      .input("notas", sql.NVarChar, notas)
      .input("fechaTentativa", sql.NVarChar, fechaTentativa)
      .input("ciudadSede", sql.NVarChar, ciudadSede)
      .input("participantes", sql.NVarChar, participantes)
      .input("modalidad", sql.NVarChar, modalidad)
      .query(
        `INSERT INTO Solicitud
          (cliente_id, herramienta, temario_tipo, temario_nombre, temas_json, horas_totales, canal_origen, notas,
           fecha_tentativa, ciudad_sede, participantes, modalidad)
         OUTPUT INSERTED.id
         VALUES
          (@clienteId, @herramienta, 'estandar', @temarioNombre, @temasJson, @horasTotales, 'Sitio', @notas,
           @fechaTentativa, @ciudadSede, @participantes, @modalidad)`
      );
    context.res = { status: 200, headers: JSON_HEADERS, body: { id: insert.recordset[0].id } };
  } catch (err) {
    context.log.error("Error creando la solicitud pública:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo crear la solicitud." } };
  }
};
