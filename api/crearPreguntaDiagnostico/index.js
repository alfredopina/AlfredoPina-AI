// crearPreguntaDiagnostico/index.js
// Function protegida (rol "admin"): alta de una pregunta nueva del
// Diagnóstico. La imagen es obligatoria aquí (a diferencia de
// editarPreguntaDiagnostico, donde es opcional) — viaja como base64 dentro
// del JSON, mismo patrón que uploadRecurso/subirPlantillaAsset.
const crypto = require("crypto");
const { getPool, sql } = require("../src/backoffice-db");
const { subirImagenPregunta } = require("../src/diagnostico-storage");
const { JSON_HEADERS } = require("../src/http");

const HERRAMIENTAS = ["excel", "powerbi"];
const OPCIONES = ["A", "B", "C", "D"];

module.exports = async function (context, req) {
  const body = req.body || {};
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
  if (!imagenBase64) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta la imagen de referencia." } };
    return;
  }

  try {
    const buffer = Buffer.from(imagenBase64, "base64");
    const imagenUrl = await subirImagenPregunta(crypto.randomUUID(), buffer, contentType);

    const pool = await getPool();
    const insert = await pool
      .request()
      .input("herramienta", sql.VarChar, herramienta)
      .input("nivel", sql.TinyInt, nivel)
      .input("texto", sql.NVarChar, texto)
      .input("imagenUrl", sql.NVarChar, imagenUrl)
      .input("opcionA", sql.NVarChar, opcionA)
      .input("opcionB", sql.NVarChar, opcionB)
      .input("opcionC", sql.NVarChar, opcionC)
      .input("opcionD", sql.NVarChar, opcionD)
      .input("opcionCorrecta", sql.Char, opcionCorrecta)
      .input("orden", sql.Int, orden)
      .input("activa", sql.Bit, activa)
      .query(
        `INSERT INTO DiagnosticoPregunta
           (herramienta, nivel, texto, imagen_url, opcion_a, opcion_b, opcion_c, opcion_d, opcion_correcta, orden, activa)
         OUTPUT INSERTED.id
         VALUES (@herramienta, @nivel, @texto, @imagenUrl, @opcionA, @opcionB, @opcionC, @opcionD, @opcionCorrecta, @orden, @activa)`
      );
    context.res = { status: 200, headers: JSON_HEADERS, body: { id: insert.recordset[0].id, imagenUrl } };
  } catch (err) {
    context.log.error("Error guardando la pregunta del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar: " + err.message } };
  }
};
