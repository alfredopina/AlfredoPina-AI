// crearPreguntaDiagnostico/index.js
// Function protegida (rol "admin"): alta de una pregunta nueva del
// Diagnóstico. La imagen es obligatoria aquí (a diferencia de
// editarPreguntaDiagnostico, donde es opcional) — viaja como base64 dentro
// del JSON, mismo patrón que uploadRecurso/subirPlantillaAsset.
//
// Vive en Table Storage, no en SQL (2026-09-13) — ver diagnostico-tables.js.
const crypto = require("crypto");
const { getDiagnosticoPreguntasTable, ensureTable, HERRAMIENTAS } = require("../src/diagnostico-tables");
const { subirImagenPregunta } = require("../src/diagnostico-storage");
const { JSON_HEADERS } = require("../src/http");

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
  const activa = body.activa !== false;
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
    const id = crypto.randomUUID();
    const buffer = Buffer.from(imagenBase64, "base64");
    const imagenUrl = await subirImagenPregunta(id, buffer, contentType);

    const table = getDiagnosticoPreguntasTable();
    await ensureTable(table);
    await table.upsertEntity(
      {
        partitionKey: herramienta,
        rowKey: id,
        nivel,
        texto,
        imagen_url: imagenUrl,
        opcion_a: opcionA,
        opcion_b: opcionB,
        opcion_c: opcionC,
        opcion_d: opcionD,
        opcion_correcta: opcionCorrecta,
        orden,
        activa,
      },
      "Replace"
    );
    context.res = { status: 200, headers: JSON_HEADERS, body: { id, imagenUrl } };
  } catch (err) {
    context.log.error("Error guardando la pregunta del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar: " + err.message } };
  }
};
