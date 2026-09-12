// editarGrupo/index.js
// Function protegida (rol "admin"): edita un Grupo existente — mismo
// formulario que crearGrupo (a diferencia de Solicitud, aquí Cliente/Cliente
// final SÍ son editables: un Grupo es control operativo propio de Alfredo, no
// hay el mismo riesgo de "cambiar de empresa a una venta ya cerrada" que
// justificaba el candado en editarSolicitud). Mismas validaciones que
// crearGrupo, duplicadas a propósito — UPDATE en vez de INSERT. Si el UPDATE
// cambia la fase derivada (ver src/grupo-fase.js), lo registra en
// GrupoFaseHistorial dentro de la misma transacción — así el Grupo no
// necesita pasar por el stepper interactivo para que su historial quede al
// día, editar los <select> de estatus directamente también lo actualiza.
// `contacto_nuevo` — mismo mecanismo que crearGrupo (ver ese archivo): un
// Cliente/Cliente final que se cambia a uno nuevo aquí mismo puede traer un
// Contacto nuevo consigo, creado en la misma transacción justo antes del
// UPDATE del Grupo.
const { getPool, sql } = require("../src/backoffice-db");
const { HERRAMIENTAS } = require("../src/herramientas");
const { JSON_HEADERS } = require("../src/http");
const { derivarFase, registrarCambioFase } = require("../src/grupo-fase");

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
    fechaCierre: body.fecha_cierre || null,
    notas: (body.notas || "").trim() || null,
  };
}

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = Number(body.id);
  let contactoId = body.contacto_id ? Number(body.contacto_id) : null;
  const contactoNuevo = !contactoId && body.contacto_nuevo && (body.contacto_nuevo.nombre || "").trim() ? body.contacto_nuevo : null;

  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id del grupo." } };
    return;
  }

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

    const actual = await pool.request().input("id", sql.Int, id).query("SELECT estatus_curso, estatus_cierre FROM Grupo WHERE id = @id");
    if (!actual.recordset.length) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese grupo ya no existe." } };
      return;
    }
    const faseAnterior = derivarFase(actual.recordset[0].estatus_curso, actual.recordset[0].estatus_cierre);
    const faseNueva = derivarFase(datos.estatusCurso, datos.estatusCierre);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      if (contactoNuevo) {
        const clienteContactoId = (clienteFinal || cliente).id;
        const insertContacto = await new sql.Request(transaction)
          .input("clienteId", sql.Int, clienteContactoId)
          .input("nombre", sql.NVarChar, contactoNuevo.nombre.trim())
          .input("correo", sql.NVarChar, (contactoNuevo.correo || "").trim() || null)
          .input("telefono", sql.NVarChar, (contactoNuevo.telefono || "").trim() || null)
          .query(
            `INSERT INTO Contacto (cliente_id, nombre, correo, telefono)
             OUTPUT INSERTED.id VALUES (@clienteId, @nombre, @correo, @telefono)`
          );
        contactoId = insertContacto.recordset[0].id;
      }

      await new sql.Request(transaction)
        .input("id", sql.Int, id)
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
        .input("fechaCierre", sql.Date, datos.fechaCierre ? new Date(datos.fechaCierre) : null)
        .input("notas", sql.NVarChar, datos.notas)
        .query(
          `UPDATE Grupo SET
             cliente_id = @clienteId, cliente_final_id = @clienteFinalId, contacto_id = @contactoId,
             modalidad = @modalidad, grupo_codigo = @grupoCodigo, herramientas = @herramientas,
             nombre_curso = @nombreCurso, niveles = @niveles, horas = @horas, sesiones = @sesiones,
             fecha_inicio = @fechaInicio, fecha_fin = @fechaFin, instructor = @instructor,
             estatus_curso = @estatusCurso, estatus_cierre = @estatusCierre, cotizacion_id = @cotizacionId,
             fotos_rs = @fotosRs, fecha_cierre = @fechaCierre,
             notas = @notas
           WHERE id = @id`
        );
      await registrarCambioFase(transaction, id, faseNueva, faseAnterior);
      await transaction.commit();
      context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true, cliente, clienteFinal } };
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        context.log.error("Error haciendo rollback:", rollbackErr.message);
      }
      throw err;
    }
  } catch (err) {
    context.log.error("Error editando el grupo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar la edición." } };
  }
};
