// editarPreguntaDiagnostico/index.js
// Function protegida (rol "admin"): edita una pregunta existente. A
// diferencia de crearPreguntaDiagnostico, la imagen es OPCIONAL — si no viene
// imagenBase64, se conserva la imagen_url ya guardada.
//
// Vive en Table Storage, no en SQL (2026-09-13) — ver diagnostico-tables.js.
// herramienta se trata como fija por la vida de la pregunta (el formulario
// del admin nunca la deja cambiar, siempre se edita dentro del contexto de
// una herramienta) — si no calza con el PartitionKey real, se trata igual
// que "id no encontrado" en vez de intentar mover la entidad de partición.
const crypto = require("crypto");
const { getDiagnosticoPreguntasTable, listarPreguntas, HERRAMIENTAS } = require("../src/diagnostico-tables");
const { subirImagenPregunta, eliminarImagenPorUrl } = require("../src/diagnostico-storage");
const { JSON_HEADERS } = require("../src/http");

const MAX_POR_NIVEL = 5;

const OPCIONES = ["A", "B", "C", "D"];

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = (body.id || "").trim();
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
    const table = getDiagnosticoPreguntasTable();

    let existente;
    try {
      existente = await table.getEntity(herramienta, id);
    } catch (err) {
      if (err.statusCode === 404) {
        context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa pregunta ya no existe." } };
        return;
      }
      throw err;
    }

    // Si el nivel cambia, hay que revalidar el tope de 5 contra el nivel
    // DESTINO (el de origen se libera con este mismo cambio) — nunca contra
    // el propio id, que ya no debe contarse dos veces.
    if (nivel !== existente.nivel) {
      const todas = await listarPreguntas(table, herramienta);
      const enNivelDestino = todas.filter((e) => e.nivel === nivel && e.rowKey !== id).length;
      if (enNivelDestino >= MAX_POR_NIVEL) {
        context.res = {
          status: 400,
          headers: JSON_HEADERS,
          body: { error: `Ya hay ${MAX_POR_NIVEL} preguntas en el nivel ${nivel} — es el máximo.` },
        };
        return;
      }
    }

    let imagenUrl = existente.imagen_url;
    if (imagenBase64) {
      const buffer = Buffer.from(imagenBase64, "base64");
      imagenUrl = await subirImagenPregunta(crypto.randomUUID(), buffer, contentType);
      // La imagen vieja ya no la usa nadie — antes se quedaba huérfana en
      // Storage para siempre, ver CLAUDE.md → Diagnóstico.
      await eliminarImagenPorUrl(existente.imagen_url);
    }

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
    context.log.error("Error editando la pregunta del diagnóstico:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar: " + err.message } };
  }
};
