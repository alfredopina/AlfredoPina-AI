// generarDiplomas/index.js
// Function protegida (rol "admin"): genera un lote de diplomas. Por cada
// alumno: da de alta o reutiliza Cliente/Alumno, calcula el folio, genera el
// PDF (si el resultado no es "No Aprobado") y sube todo a SQL + Blob. Un error
// en una fila no debe tumbar el resto del lote — se reporta por separado en el
// resultado, igual que cuando "No Aprobado" consume folio pero no genera PDF.
const { getPool, sql } = require("../src/backoffice-db");
const { getDiplomasContainer } = require("../src/diplomas-storage");
const { getFondoBuffer, getFirmaBuffer, slugify } = require("../src/plantillas-storage");
const { generarDiplomaPdf } = require("../src/diploma-pdf");
const { HERRAMIENTAS } = require("../src/herramientas");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

const RESULTADOS_VALIDOS = ["Aprobado", "Participó", "No Aprobado"];

function limpiarCodigo(codigo) {
  return (codigo || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function numeroONull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Da de alta el Cliente si no existe (por código), o reutiliza el que ya
// seleccionaron del autocompletado (por id).
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

// Un Alumno se identifica por nombre completo + cliente (mismo nombre en
// clientes distintos son personas distintas).
async function resolverAlumno(pool, clienteId, nombreCompleto) {
  const existente = await pool
    .request()
    .input("clienteId", sql.Int, clienteId)
    .input("nombre", sql.NVarChar, nombreCompleto)
    .query("SELECT id FROM Alumno WHERE cliente_id = @clienteId AND nombre_completo = @nombre");
  if (existente.recordset.length) return existente.recordset[0].id;

  const insert = await pool
    .request()
    .input("clienteId", sql.Int, clienteId)
    .input("nombre", sql.NVarChar, nombreCompleto)
    .query("INSERT INTO Alumno (nombre_completo, cliente_id) OUTPUT INSERTED.id VALUES (@nombre, @clienteId)");
  return insert.recordset[0].id;
}

// El consecutivo es por Cliente+Año, sin importar herramienta — se calcula
// leyendo los folios ya usados por ese cliente en el año actual (formato
// "..._AA-N") y tomando el máximo N + 1.
async function siguienteConsecutivo(pool, clienteId, yy) {
  const r = await pool.request().input("clienteId", sql.Int, clienteId).query("SELECT folio FROM Diploma WHERE cliente_id = @clienteId");
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
  const instructor = (body.instructor || "").trim();
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const curso = (body.curso || "").trim();
  const nivel = (body.nivel || "").trim();
  const fechaInicio = (body.fechaInicio || "").trim();
  const fechaFin = (body.fechaFin || "").trim();
  const grupo = (body.grupo || "").trim();
  const horas = numeroONull(body.horas);
  const empresa = body.empresa || {};
  const alumnos = Array.isArray(body.alumnos) ? body.alumnos : [];

  if (!instructor || !HERRAMIENTAS.includes(herramienta) || !curso || !nivel || !fechaInicio || !fechaFin || !grupo || !horas) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos del lote (instructor, herramienta, curso, nivel, fechas, horas o grupo)." } };
    return;
  }
  if (!alumnos.length) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "El lote no trae alumnos." } };
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

  const yy = String(new Date().getFullYear()).slice(-2);
  let consecutivo;
  try {
    consecutivo = await siguienteConsecutivo(pool, cliente.id, yy);
  } catch (err) {
    context.log.error("Error calculando el folio:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo calcular el folio: " + err.message } };
    return;
  }

  // el fondo y la firma no cambian entre alumnos de un mismo lote — se piden
  // una sola vez en vez de una vez por alumno
  let fondoBuffer, firmaBuffer;
  try {
    [fondoBuffer, firmaBuffer] = await Promise.all([getFondoBuffer(), getFirmaBuffer(slugify(instructor))]);
  } catch (err) {
    context.log.error("Error cargando la plantilla:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: err.message } };
    return;
  }

  const container = getDiplomasContainer();
  const resultados = [];

  for (const alumno of alumnos) {
    const nombreCompleto = (alumno.nombreCompleto || "").trim();
    const resultado = (alumno.resultado || "").trim();
    const proyecto = numeroONull(alumno.proyecto);
    const asistencia = numeroONull(alumno.asistencia);
    const participacion = numeroONull(alumno.participacion);

    if (!nombreCompleto) {
      resultados.push({ nombre: "(sin nombre)", error: "Falta el nombre del alumno." });
      continue;
    }
    if (!RESULTADOS_VALIDOS.includes(resultado)) {
      resultados.push({ nombre: nombreCompleto, error: `Resultado inválido: "${resultado}".` });
      continue;
    }

    const folio = `AP_${herramienta.toUpperCase()}_${cliente.codigo}_${yy}-${consecutivo}`;
    consecutivo += 1;

    try {
      const alumnoId = await resolverAlumno(pool, cliente.id, nombreCompleto);

      let blobPath = null;
      if (resultado !== "No Aprobado") {
        const pdfBuffer = await generarDiplomaPdf({
          alumno: nombreCompleto,
          curso,
          resultado,
          fechaInicio,
          fechaFin,
          horas,
          instructor,
          folio,
          fondoBuffer,
          firmaBuffer,
        });
        blobPath = `${folio}.pdf`;
        await container.getBlockBlobClient(blobPath).uploadData(pdfBuffer, {
          blobHTTPHeaders: { blobContentType: "application/pdf" },
        });
      }

      await pool
        .request()
        .input("folio", sql.NVarChar, folio)
        .input("alumnoId", sql.Int, alumnoId)
        .input("clienteId", sql.Int, cliente.id)
        .input("herramienta", sql.NVarChar, herramienta)
        .input("curso", sql.NVarChar, curso)
        .input("nivel", sql.NVarChar, nivel)
        .input("fechaInicio", sql.Date, new Date(fechaInicio))
        .input("fechaFin", sql.Date, new Date(fechaFin))
        .input("resultado", sql.NVarChar, resultado)
        .input("instructor", sql.NVarChar, instructor)
        .input("grupo", sql.NVarChar, grupo)
        .input("horas", sql.Int, horas)
        .input("proyecto", sql.Int, proyecto)
        .input("asistencia", sql.Int, asistencia)
        .input("participacion", sql.Int, participacion)
        .input("blobPath", sql.NVarChar, blobPath)
        .query(
          `INSERT INTO Diploma
            (folio, alumno_id, cliente_id, herramienta, curso, nivel, fecha_inicio, fecha_fin, resultado, instructor, grupo, horas, proyecto, asistencia, participacion, blob_path)
           VALUES
            (@folio, @alumnoId, @clienteId, @herramienta, @curso, @nivel, @fechaInicio, @fechaFin, @resultado, @instructor, @grupo, @horas, @proyecto, @asistencia, @participacion, @blobPath)`
        );

      resultados.push({ folio, nombre: nombreCompleto, resultado, pdfGenerado: blobPath !== null });
    } catch (err) {
      context.log.error(`Error generando el diploma de ${nombreCompleto}:`, err.message);
      resultados.push({ folio, nombre: nombreCompleto, resultado, error: err.message });
    }
  }

  context.res = { status: 200, headers: JSON_HEADERS, body: { cliente, resultados } };
};
