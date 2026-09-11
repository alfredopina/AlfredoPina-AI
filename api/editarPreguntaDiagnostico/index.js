// editarPreguntaDiagnostico/index.js
// Function protegida (rol "admin"): edita una pregunta existente. A
// diferencia de crearPreguntaDiagnostico, la imagen es OPCIONAL — si no viene
// imagenBase64, se conserva la imagen_url ya guardada (mismo patrón dual que
// editarRecurso/uploadRecurso: aquí no vale la pena separar en 2 Functions
// porque no hay upload sin datos, siempre se manda el formulario completo).
const { getPool, sql } = require("../src/backoffice-db");
const { subirImagenPregunta } = require("../src/diagnostico-storage");
const { JSON_HEADERS } = require("../src/http");

const HERRAMIENTAS = ["excel", "powerbi"];
const OPCIONES = ["A", "B", "C", "D"];

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = Number(body.id);
  const herramienta = (body.herramienta || "").trim().toLowerCase();
  const nivel = Number(body.nivel);
  const texto = (body.texto || "").trim();
  const opcionA = (body.opcionA || "").trim();
  const opcionB = (body.opcionB || "").trim();
  const opcionC = (body.opcionC || "").trim();
  const opcionD = (body.opcionD || "").trim();
  const opcionCorrecta = (body.opcionCorrecta || "").trim().toUpperCase();
  const orden = Number.isFinite(Number(body.orden)) ? Number(body.orden) : 0;
  const activa = body.activa === false ? 0 : 1;
  const imagenBase64 = body.imagenBase64 || "";
  const contentType = body.imagenContentType || "image/png";

  if (!id) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el id de la pregunta." } };
    return;
  }
  if (!HERRAMIENTAS.includes(herramienta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Herramienta inválida." } };
    return;
  }
  if (![1, 2, 3].includes(nivel)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Nivel inválido." } };
    return;
  }
  if (!texto || !opcionA || !opcionB || !opcionC || !opcionD) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (texto o alguna de las 4 opciones)." } };
    return;
  }
  if (!OPCIONES.includes(opcionCorrecta)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta marcar cuál opción es la correcta." } };
    return;
  }

  try {
    const pool = await getPool();

    let imagenUrl = null;
    if (imagenBase64) {
      const buffer = Buffer.from(imagenBase64, "base64");
      imagenUrl = await subirImagenPregunta(require("crypto").randomUUID(), buffer, contentType);
    }

    const request = pool
      .request()
      .input("id", sql.Int, id)
      .input("herramienta", sql.VarChar, herramienta)
      .input("nivel", sql.TinyInt, nivel)
      .input("texto", sql.NVarChar, texto)
      .input("opcionA", sql.NVarChar, opcionA)
      .input("opcionB", sql.NVarChar, opcionB)
      .input("opcionC", sql.NVarChar, opcionC)
      .input("opcionD", sql.NVarChar, opcionD)
      .input("opcionCorrecta", sql.Char, opcionCorrecta)
      .input("orden", sql.Int, orden)
      .input("activa", sql.Bit, activa);

    let setImagen = "";
    if (imagenUrl) {
      request.input("imagenUrl", sql.NVarChar, imagenUrl);
      setImagen = "imagen_url = @imagenUrl, ";
    }

    const result = await request.query(
      `UPDATE DiagnosticoPregunta
       SET herramienta=@herramienta, nivel=@nivel, texto=@texto, ${setImagen}
           opcion_a=@opcionA, opcion_b=@opcionB, opcion_c=@opcionC, opcion_d=@opcionD,
           opcion_correcta=@opcionCorrecta, orden=@orden, activa=@activa
       WHERE id=@id`
    );
    if (!result.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa pregunta ya no existe." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { id, imagenUrl } };
  } catch (err) {
    context.log.error("Error editando la pregunta del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar: " + err.message } };
  }
};
