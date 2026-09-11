// crearGrupo/index.js
// Function protegida (rol "admin"): alta de un Grupo — instancia real de curso
// que Alfredo está impartiendo/impartió a un Cliente (equivalente operativo de
// su Excel de control). cliente_id es quien contrató; cliente_final_id es
// opcional, solo se llena en el caso de reventa/intermediario (ej.
// Capacitanet vende, Clarios recibe el curso) — ambos se resuelven con el
// mismo patrón resolverCliente que ya usa el proyecto (clienteId existente, o
// nombre+código para dar de alta uno nuevo), duplicado a propósito.
// contacto_id (si viene) se valida contra el Cliente correcto: el final si
// existe, si no el que contrató — nunca se confía en lo que mande el front
// para esto. herramientas/niveles son JSON arrays validados contra listas
// fijas. Sin borrado — un Grupo mal capturado se corrige con editarGrupo.
// El INSERT del Grupo y la siembra del historial de fase (ver
// src/grupo-fase.js) van en una sola transacción — o quedan ambos, o ninguno.
const { getPool, sql } = require("../src/backoffice-db");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");
const { sembrarHistorialInicial } = require("../src/grupo-fase");

const MODALIDADES = ["Online", "Presencial", "Híbrido"];
const NIVELES = [1, 2, 3];
const ESTATUS_CURSO = ["Por iniciar", "En proceso", "Terminado"];
const ESTATUS_CIERRE = ["Proyecto", "Calificaciones", "Diplomas", "Cerrado"];

async function resolverCliente(pool, empresa) {
  if (!empresa) return null;
  const clienteId = empresa.clienteId ? Number(empresa.clienteId) : null;

  if (clienteId) {
    const r = await pool.request().input("id", sql.Int, clienteId).query("SELECT id, nombre, codigo FROM Cliente WHERE id = @id");
    if (!r.recordset.length) throw new Error("El cliente seleccionado ya no existe.");
    return r.recordset[0];
  }

  const nombre = (empresa.nombre || "").trim();
  const codigo = (empresa.codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
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

function validarCuerpo(body) {
  const herramientas = Array.isArray(body.herramientas) ? body.herramientas : [];
  const niveles = Array.isArray(body.niveles) ? body.niveles.map(Number) : [];
  const modalidad = (body.modalidad || "").trim() || null;
  const estatusCurso = (body.estatus_curso || "Por iniciar").trim();
  const estatusCierre = (body.estatus_cierre || "").trim() || null;

  if (!herramientas.length || herramientas.some((h) => !HERRAMIENTAS.includes(h))) {
    throw new Error("Selecciona al menos una herramienta válida.");
  }
  if (!niveles.length || niveles.some((n) => !NIVELES.includes(n))) {
    throw new Error("Selecciona al menos un nivel válido.");
  }
  if (modalidad && !MODALIDADES.includes(modalidad)) {
    throw new Error("Modalidad inválida.");
  }
  if (!ESTATUS_CURSO.includes(estatusCurso)) {
    throw new Error("Estatus del curso inválido.");
  }
  if (estatusCierre && !ESTATUS_CIERRE.includes(estatusCierre)) {
    throw new Error("Estatus de cierre inválido.");
  }

  const horas = body.horas != null && body.horas !== "" ? Number(body.horas) : null;
  if (horas != null && !Number.isFinite(horas)) throw new Error("Las horas no son válidas.");
  const sesiones = body.sesiones != null && body.sesiones !== "" ? Number(body.sesiones) : null;
  if (sesiones != null && !Number.isInteger(sesiones)) throw new Error("Las sesiones no son válidas.");

  return {
    herramientas,
    niveles,
    modalidad,
    grupoCodigo: (body.grupo_codigo || "").trim() || null,
    nombreCurso: (body.nombre_curso || "").trim() || null,
    horas,
    sesiones,
    fechaInicio: body.fecha_inicio || null,
    fechaFin: body.fecha_fin || null,
    instructor: (body.instructor || "").trim() || null,
    estatusCurso,
    estatusCierre,
    cotizacionId: body.cotizacion_id ? Number(body.cotizacion_id) : null,
    fotosRs: body.fotos_rs ? 1 : 0,
    correosMl: body.correos_ml ? 1 : 0,
    pagado: body.pagado ? 1 : 0,
    fechaCierre: body.fecha_cierre || null,
    notas: (body.notas || "").trim() || null,
  };
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const contactoId = body.contacto_id ? Number(body.contacto_id) : null;

  let datos;
  try {
    datos = validarCuerpo(body);
  } catch (err) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: err.message } };
    return;
  }

  let pool, cliente, clienteFinal;
  try {
    pool = await getPool();
    cliente = await resolverCliente(pool, body.cliente);
    if (!cliente) throw new Error("Falta el cliente.");
    clienteFinal = body.cliente_final ? await resolverCliente(pool, body.cliente_final) : null;
  } catch (err) {
    context.log.error("Error resolviendo el cliente:", err.message);
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: err.message } };
    return;
  }

  try {
    if (contactoId) {
      const clienteEsperado = (clienteFinal || cliente).id;
      const r = await pool.request().input("id", sql.Int, contactoId).query("SELECT cliente_id FROM Contacto WHERE id = @id");
      if (!r.recordset.length || r.recordset[0].cliente_id !== clienteEsperado) {
        context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El contacto no pertenece al cliente correcto." } };
        return;
      }
    }
    if (datos.cotizacionId) {
      const r = await pool.request().input("id", sql.Int, datos.cotizacionId).query("SELECT id FROM Cotizacion WHERE id = @id");
      if (!r.recordset.length) {
        context.res = { status: 400, headers: JSON_HEADERS, body: { error: "La cotización de origen ya no existe." } };
        return;
      }
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const insert = await new sql.Request(transaction)
        .input("clienteId", sql.Int, cliente.id)
        .input("clienteFinalId", sql.Int, clienteFinal ? clienteFinal.id : null)
        .input("contactoId", sql.Int, contactoId)
        .input("modalidad", sql.NVarChar, datos.modalidad)
        .input("grupoCodigo", sql.NVarChar, datos.grupoCodigo)
        .input("herramientas", sql.NVarChar, JSON.stringify(datos.herramientas))
        .input("nombreCurso", sql.NVarChar, datos.nombreCurso)
        .input("niveles", sql.NVarChar, JSON.stringify(datos.niveles))
        .input("horas", sql.Decimal(6, 1), datos.horas)
        .input("sesiones", sql.Int, datos.sesiones)
        .input("fechaInicio", sql.Date, datos.fechaInicio ? new Date(datos.fechaInicio) : null)
        .input("fechaFin", sql.Date, datos.fechaFin ? new Date(datos.fechaFin) : null)
        .input("instructor", sql.NVarChar, datos.instructor)
        .input("estatusCurso", sql.NVarChar, datos.estatusCurso)
        .input("estatusCierre", sql.NVarChar, datos.estatusCierre)
        .input("cotizacionId", sql.Int, datos.cotizacionId)
        .input("fotosRs", sql.Bit, datos.fotosRs)
        .input("correosMl", sql.Bit, datos.correosMl)
        .input("pagado", sql.Bit, datos.pagado)
        .input("fechaCierre", sql.Date, datos.fechaCierre ? new Date(datos.fechaCierre) : null)
        .input("notas", sql.NVarChar, datos.notas)
        .query(
          `INSERT INTO Grupo
            (cliente_id, cliente_final_id, contacto_id, modalidad, grupo_codigo, herramientas, nombre_curso, niveles,
             horas, sesiones, fecha_inicio, fecha_fin, instructor, estatus_curso, estatus_cierre, cotizacion_id,
             fotos_rs, correos_ml, pagado, fecha_cierre, notas)
           OUTPUT INSERTED.id
           VALUES
            (@clienteId, @clienteFinalId, @contactoId, @modalidad, @grupoCodigo, @herramientas, @nombreCurso, @niveles,
             @horas, @sesiones, @fechaInicio, @fechaFin, @instructor, @estatusCurso, @estatusCierre, @cotizacionId,
             @fotosRs, @correosMl, @pagado, @fechaCierre, @notas)`
        );
      const grupoId = insert.recordset[0].id;
      await sembrarHistorialInicial(transaction, grupoId, {
        estatusCurso: datos.estatusCurso,
        estatusCierre: datos.estatusCierre,
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        fechaCierre: datos.fechaCierre,
      });
      await transaction.commit();
      context.res = { status: 200, headers: JSON_HEADERS, body: { id: grupoId, cliente, clienteFinal } };
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        context.log.error("Error haciendo rollback:", rollbackErr.message);
      }
      throw err;
    }
  } catch (err) {
    context.log.error("Error creando el grupo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo crear el grupo." } };
  }
};
