// crearCotizacion/index.js
// Function protegida (rol "admin"): alta de una Cotización. Resuelve folio
// (AP{AA}-{código}-{HERRAMIENTA}-{NN}, consecutivo por Cliente+Año, ver
// api/src/cotizacion-folio.js), calcula precio_sugerido =
// horas × TarifaHerramienta y sugiere 10% de descuento para grupos chicos
// ("Solo yo"/"5 a 10") — ambos siempre editables desde el front
// (descuento_pct/precio_final, si vienen, pisan la sugerencia). Genera el PDF
// la PROPUESTA (snapshot en Table Storage, ver api/src/propuestas.js) que el
// cliente abre en /propuesta/{código}, y guarda ese código en blob_path como
// "propuesta/{código}". Si viene reemplaza_a_folio, la cotización vieja pasa a "Reemplazada" (no se borra —
// mismo criterio que anularDiploma). Si viene solicitud_id, esa Solicitud
// pasa a "Cotizada".
const { getPool, sql } = require("../src/backoffice-db");
const { resolverCliente } = require("../src/cliente-resolver");
const { proyectosParaPropuesta, proyectosPorIds } = require("../src/cotizacion-proyectos");
const { esPrecioManual, armarSnapshot, getPropuestasTable, guardarPropuesta, marcarReemplazada, blobPathDePropuesta, codigoDePropuesta } = require("../src/propuestas");
const { codigoCortoUnico } = require("../src/codigo-corto");
const { folioNuevo, maxConsecutivo } = require("../src/cotizacion-folio");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");

const TEMARIO_TIPOS = ["estandar", "personalizado"];
const MODALIDADES = ["Online", "Presencial", "Híbrido"];
const PARTICIPANTES_OPCIONES = ["Solo yo", "5 a 10", "10 a 15", "Más de 15"];
const GRUPOS_CHICOS = ["Solo yo", "5 a 10"];


// consecutivo por Cliente+Año: lee los folios ya usados (formato viejo y nuevo)
async function siguienteConsecutivo(pool, clienteId, yy) {
  const r = await pool.request().input("clienteId", sql.Int, clienteId).query("SELECT folio FROM Cotizacion WHERE cliente_id = @clienteId");
  return maxConsecutivo(r.recordset.map((row) => row.folio), yy) + 1;
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
  const alcance = (body.alcance || "").trim() || null;
  const proyectosElegidos = Array.isArray(body.proyectos) ? body.proyectos : [];
  // editar un Borrador = se guarda en el mismo folio y el mismo link (versión nueva solo desde Enviada en adelante)
  const actualizaId = body.actualiza_id ? Number(body.actualiza_id) : null;

  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }
  if (!TEMARIO_TIPOS.includes(temarioTipo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El tipo de programa debe ser estándar o personalizado." } };
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
  let existente = null;
  try {
    if (actualizaId) {
      const r = await pool.request().input("id", sql.Int, actualizaId).query("SELECT id, folio, estatus, cliente_id, blob_path FROM Cotizacion WHERE id = @id");
      existente = r.recordset[0];
      if (!existente) throw Object.assign(new Error("Esa cotización ya no existe."), { status: 404 });
      if (existente.estatus !== "Borrador") throw Object.assign(new Error("Solo un Borrador se edita en el lugar; las demás generan una versión nueva."), { status: 400 });
      if (existente.cliente_id !== cliente.id) throw Object.assign(new Error("No se puede cambiar el cliente de un borrador."), { status: 400 });
      folio = existente.folio;
    } else {
      const consecutivo = await siguienteConsecutivo(pool, cliente.id, yy);
      folio = folioNuevo({ yy, codigoCliente: cliente.codigo, herramienta, consecutivo });
    }
  } catch (err) {
    if (err.status) {
      context.res = { status: err.status, headers: JSON_HEADERS, body: { error: err.message } };
      return;
    }
    context.log.error("Error calculando el folio:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo calcular el folio: " + err.message } };
    return;
  }

  // la propuesta se guarda ANTES del insert: si el insert falla, queda un snapshot huérfano que nadie abre (inofensivo)
  let blobPath;
  let codigoPropuesta;
  const tablaPropuestas = getPropuestasTable();
  try {
    const proyectos = temarioTipo === "estandar" ? await proyectosParaPropuesta(herramienta, temarioNombre) : await proyectosPorIds(herramienta, proyectosElegidos);
    // al editar un Borrador se conserva su link; si era una cotización vieja (PDF) se le crea código
    codigoPropuesta = existente ? codigoDePropuesta(existente.blob_path) : null;
    if (!codigoPropuesta) {
      codigoPropuesta = await codigoCortoUnico(async (c) => {
        try { await tablaPropuestas.getEntity("propuesta", c); return true; } catch (e) { return false; }
      });
    }
    const snapshot = armarSnapshot({
      folio,
      cliente: cliente.nombre,
      contacto: contactoNombre,
      herramienta,
      programa: temarioTipo === "estandar" && temarioNombre ? temarioNombre : "Programa personalizado",
      temas,
      horas,
      modalidad,
      participantes,
      ciudadSede,
      fechaTentativa,
      objetivo,
      dirigidoA,
      alcance,
      proyectos,
      precioManual: precioFinalBody != null && esPrecioManual({ precioSugerido, descuentoPct, precioFinal }),
      tarifaHora: precioHora,
      precioSugerido,
      precioFinal,
      emitida: new Date(),
      vigencia: fechaVigencia,
    });
    await guardarPropuesta(tablaPropuestas, { codigo: codigoPropuesta, snapshot });
    blobPath = blobPathDePropuesta(codigoPropuesta);
  } catch (err) {
    context.log.error("Error guardando la propuesta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar la propuesta: " + err.message } };
    return;
  }

  try {
    if (existente) {
      await pool
        .request()
        .input("id", sql.Int, existente.id)
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
        .input("blobPath", sql.NVarChar, blobPath)
        .input("fechaTentativa", sql.NVarChar, fechaTentativa)
        .input("ciudadSede", sql.NVarChar, ciudadSede)
        .input("participantes", sql.NVarChar, participantes)
        .input("modalidad", sql.NVarChar, modalidad)
        .query(
          `UPDATE Cotizacion SET contacto_id = @contactoId, herramienta = @herramienta, temario_tipo = @temarioTipo,
             temario_nombre = @temarioNombre, temas_json = @temasJson, horas = @horas, precio_sugerido = @precioSugerido,
             descuento_pct = @descuentoPct, precio_final = @precioFinal, fecha_vigencia = @fechaVigencia, blob_path = @blobPath,
             fecha_tentativa = @fechaTentativa, ciudad_sede = @ciudadSede, participantes = @participantes, modalidad = @modalidad
           WHERE id = @id AND estatus = 'Borrador'`
        );
      context.res = {
        status: 200,
        headers: JSON_HEADERS,
        body: { id: existente.id, folio, cliente, precioSugerido, descuentoPct, precioFinal, propuesta_codigo: codigoPropuesta, actualizada: true },
      };
      return;
    }
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
      const vieja = await pool.request().input("folio", sql.NVarChar, reemplazaAFolio).query("UPDATE Cotizacion SET estatus = 'Reemplazada', fecha_estatus = SYSUTCDATETIME() OUTPUT INSERTED.blob_path WHERE folio = @folio");
      // el link ya compartido de la versión anterior sigue abriendo, con un aviso de que existe una más nueva
      const codigoViejo = vieja.recordset.length ? codigoDePropuesta(vieja.recordset[0].blob_path) : null;
      if (codigoViejo) await marcarReemplazada(tablaPropuestas, codigoViejo, codigoPropuesta, folio);
    }
    if (solicitudId) {
      await pool.request().input("id", sql.Int, solicitudId).query("UPDATE Solicitud SET fecha_estatus = CASE WHEN estatus <> 'Cotizada' THEN SYSUTCDATETIME() ELSE fecha_estatus END, estatus = 'Cotizada' WHERE id = @id");
    }

    context.res = {
      status: 200,
      headers: JSON_HEADERS,
      body: { id: insert.recordset[0].id, folio, cliente, precioSugerido, descuentoPct, precioFinal, propuesta_codigo: codigoPropuesta },
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
