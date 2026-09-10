// crearCotizacion/index.js
// Function protegida (rol "admin"): alta de una Cotización. Resuelve folio
// (mismo patrón AP_{HERRAMIENTA}_{código}_{AA}-{consecutivo} que
// generarDiplomas, consecutivo por Cliente+Año), calcula precio_sugerido =
// horas × TarifaHerramienta y sugiere 10% de descuento para grupos chicos
// ("Solo yo"/"5 a 10") — ambos siempre editables desde el front
// (descuento_pct/precio_final, si vienen, pisan la sugerencia). Genera el PDF
// final y lo sube al contenedor privado "cotizaciones" (autocreado). Si viene
// reemplaza_a_folio, la cotización vieja pasa a "Reemplazada" (no se borra —
// mismo criterio que anularDiploma). Si viene solicitud_id, esa Solicitud
// pasa a "Cotizada".
const { getPool, sql } = require("../src/backoffice-db");
const { subirCotizacionPdf } = require("../src/cotizaciones-storage");
const { generarCotizacionPdf } = require("../src/cotizacion-pdf");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");

const TEMARIO_TIPOS = ["estandar", "personalizado"];
const MODALIDADES = ["Online", "Presencial", "Híbrido"];
const PARTICIPANTES_OPCIONES = ["Solo yo", "5 a 10", "10 a 15", "Más de 15"];
const GRUPOS_CHICOS = ["Solo yo", "5 a 10"];

const TOOL_LABELS = {
  excel: "Excel", powerbi: "Power BI", powerapps: "Power Apps",
  powerautomate: "Power Automate", ia: "IA Aplicada", ofimatica: "Ofimática Básica",
};

function limpiarCodigo(codigo) {
  return (codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// mismo patrón que crearSolicitud/generarDiplomas — duplicado a propósito
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

// consecutivo por Cliente+Año, mismo cálculo que generarDiplomas pero leyendo
// los folios ya usados en Cotizacion en vez de Diploma.
async function siguienteConsecutivo(pool, clienteId, yy) {
  const r = await pool.request().input("clienteId", sql.Int, clienteId).query("SELECT folio FROM Cotizacion WHERE cliente_id = @clienteId");
  const patron = new RegExp(`_${yy}-(\\d+)$`);
  let max = 0;
  for (const row of r.recordset) {
    const m = patron.exec(row.folio || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const empresa = body.empresa || {};
  const contactoId = body.contacto_id ? Number(body.contacto_id) : null;
  const solicitudId = body.solicitud_id ? Number(body.solicitud_id) : null;
  const reemplazaAFolio = (body.reemplaza_a_folio || "").trim() || null;
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const temarioTipo = (body.temario_tipo || "").trim();
  const temarioNombre = (body.temario_nombre || "").trim() || null;
  const temas = Array.isArray(body.temas) ? body.temas : [];
  const horas = Number(body.horas_totales);
  const fechaTentativa = (body.fecha_tentativa || "").trim() || null;
  const ciudadSede = (body.ciudad_sede || "").trim() || null;
  const participantes = (body.participantes || "").trim() || null;
  const modalidad = (body.modalidad || "").trim() || null;
  const descuentoPctBody = body.descuento_pct != null && body.descuento_pct !== "" ? Number(body.descuento_pct) : null;
  const precioFinalBody = body.precio_final != null && body.precio_final !== "" ? Number(body.precio_final) : null;
  const fechaVigenciaBody = (body.fecha_vigencia || "").trim();
  const dirigidoA = (body.dirigido_a || "").trim() || null;
  const objetivo = (body.objetivo || "").trim() || null;

  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }
  if (!TEMARIO_TIPOS.includes(temarioTipo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El tipo de temario debe ser estándar o personalizado." } };
    return;
  }
  if (!temas.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el desglose de temas." } };
    return;
  }
  if (!Number.isFinite(horas) || horas <= 0) {
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

  let pool, cliente, contactoNombre;
  try {
    pool = await getPool();
    cliente = await resolverCliente(pool, empresa);
    if (contactoId) {
      const r = await pool.request().input("id", sql.Int, contactoId).query("SELECT nombre FROM Contacto WHERE id = @id");
      contactoNombre = r.recordset.length ? r.recordset[0].nombre : null;
    }
  } catch (err) {
    context.log.error("Error resolviendo el cliente/contacto:", err.message);
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: err.message } };
    return;
  }

  let precioHora;
  try {
    const r = await pool.request().input("herramienta", sql.NVarChar, herramienta).query("SELECT precio_hora FROM TarifaHerramienta WHERE herramienta = @herramienta");
    if (!r.recordset.length) throw new Error("Esa herramienta no tiene tarifa configurada todavía.");
    precioHora = Number(r.recordset[0].precio_hora);
  } catch (err) {
    context.log.error("Error leyendo la tarifa:", err.message);
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: err.message } };
    return;
  }

  const precioSugerido = Math.round(horas * precioHora * 100) / 100;
  const descuentoPct = descuentoPctBody != null ? descuentoPctBody : (GRUPOS_CHICOS.includes(participantes) ? 10 : 0);
  const precioFinal = precioFinalBody != null ? precioFinalBody : Math.round(precioSugerido * (1 - descuentoPct / 100) * 100) / 100;
  const fechaVigencia = fechaVigenciaBody
    ? new Date(fechaVigenciaBody)
    : new Date(Date.now() + 15 * 24 * 3600 * 1000);

  const yy = String(new Date().getFullYear()).slice(-2);
  let folio;
  try {
    const consecutivo = await siguienteConsecutivo(pool, cliente.id, yy);
    folio = `AP_${herramienta.toUpperCase()}_${cliente.codigo}_${yy}-${consecutivo}`;
  } catch (err) {
    context.log.error("Error calculando el folio:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo calcular el folio: " + err.message } };
    return;
  }

  let blobPath;
  try {
    const pdfBuffer = await generarCotizacionPdf({
      cliente: cliente.nombre,
      contacto: contactoNombre,
      herramienta,
      herramientaLabel: TOOL_LABELS[herramienta] || herramienta,
      temarioTitulo: temarioTipo === "estandar" ? temarioNombre : "Temario personalizado",
      temas,
      horasTotales: horas,
      precioFinal,
      modalidad,
      participantes,
      ciudadSede,
      fechaTentativa,
      fechaVigencia,
      folio,
      dirigidoA,
      objetivo,
    });
    blobPath = await subirCotizacionPdf(folio, pdfBuffer);
  } catch (err) {
    context.log.error("Error generando el PDF de la cotización:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo generar el PDF: " + err.message } };
    return;
  }

  try {
    const insert = await pool
      .request()
      .input("folio", sql.NVarChar, folio)
      .input("solicitudId", sql.Int, solicitudId)
      .input("clienteId", sql.Int, cliente.id)
      .input("contactoId", sql.Int, contactoId)
      .input("herramienta", sql.NVarChar, herramienta)
      .input("temarioTipo", sql.NVarChar, temarioTipo)
      .input("temarioNombre", sql.NVarChar, temarioNombre)
      .input("temasJson", sql.NVarChar, JSON.stringify(temas))
      .input("horas", sql.Decimal(6, 1), horas)
      .input("precioSugerido", sql.Decimal(10, 2), precioSugerido)
      .input("descuentoPct", sql.Decimal(5, 2), descuentoPct)
      .input("precioFinal", sql.Decimal(10, 2), precioFinal)
      .input("fechaVigencia", sql.Date, fechaVigencia)
      .input("reemplazaAFolio", sql.NVarChar, reemplazaAFolio)
      .input("blobPath", sql.NVarChar, blobPath)
      .input("fechaTentativa", sql.NVarChar, fechaTentativa)
      .input("ciudadSede", sql.NVarChar, ciudadSede)
      .input("participantes", sql.NVarChar, participantes)
      .input("modalidad", sql.NVarChar, modalidad)
      .query(
        `INSERT INTO Cotizacion
          (folio, solicitud_id, cliente_id, contacto_id, herramienta, temario_tipo, temario_nombre, temas_json,
           horas, precio_sugerido, descuento_pct, precio_final, fecha_vigencia, reemplaza_a_folio, blob_path,
           fecha_tentativa, ciudad_sede, participantes, modalidad)
         OUTPUT INSERTED.id
         VALUES
          (@folio, @solicitudId, @clienteId, @contactoId, @herramienta, @temarioTipo, @temarioNombre, @temasJson,
           @horas, @precioSugerido, @descuentoPct, @precioFinal, @fechaVigencia, @reemplazaAFolio, @blobPath,
           @fechaTentativa, @ciudadSede, @participantes, @modalidad)`
      );

    if (reemplazaAFolio) {
      await pool.request().input("folio", sql.NVarChar, reemplazaAFolio).query("UPDATE Cotizacion SET estatus = 'Reemplazada' WHERE folio = @folio");
    }
    if (solicitudId) {
      await pool.request().input("id", sql.Int, solicitudId).query("UPDATE Solicitud SET estatus = 'Cotizada' WHERE id = @id");
    }

    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: { id: insert.recordset[0].id, folio, cliente, precioSugerido, descuentoPct, precioFinal },
    };
  } catch (err) {
    context.log.error("Error creando la cotización:", err.message);
    const folioColisiono = err.number === 2627 || err.number === 2601;
    context.res = {
      status: 500,
      headers: JSON_HEADERS,
      body: { error: folioColisiono ? "Ese folio ya se generó, intenta de nuevo." : "No se pudo crear la cotización." },
    };
  }
};
