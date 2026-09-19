// crearPregunta/index.js
// Function protegida (rol "admin"): alta/edición de una pregunta de la
// estructura FIJA de la encuesta (ver encuesta-tables.js): cada categoría
// tiene un tope de preguntas de escala 1-5 (4/4/4/2), que se valida AQUÍ en
// el servidor además del candado del admin. La pregunta de comentarios es
// fija (id "comentarios"): solo se puede editar su texto. Sin Activa/Inactiva
// (todas nacen activas) ni tipo elegible (siempre escala, salvo el
// comentario) — con una estructura fija no hay nada más que decidir.
//
// El "orden" lo calcula el servidor al crear (última + 10) — el admin ya no
// lo manda, así dos altas seguidas nunca se pisan. Editar solo cambia el
// texto (Merge), conserva orden y demás.
//
// Vive en Table Storage, no en SQL (2026-09-16) — ver encuesta-tables.js.
const crypto = require("crypto");
const {
  getEncuestaPreguntasTable, ensureTable, asegurarComentario, listarPreguntas,
  CATEGORIAS, COMENTARIO_ID, COMENTARIO_CATEGORIA,
} = require("../src/encuesta-tables");
const { cabeOtraEscala } = require("../src/encuesta-logic");
const { JSON_HEADERS } = require("../src/http");

const TEXTO_MAX = 300;
const NOMBRE_CORTO_MAX = 16;

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = (body.id || "").trim() || null;
  const categoria = (body.seccion || "").trim();
  const texto = (body.texto || "").trim();
  // "nombre corto" = encabezado de columna en Resultados; solo tiene sentido
  // para las 2 preguntas de escala de Globales (las otras 12 se promedian por
  // categoría), en cualquier otra se ignora.
  const nombreCorto = categoria === COMENTARIO_CATEGORIA ? String(body.nombreCorto || "").trim().slice(0, NOMBRE_CORTO_MAX) : "";

  if (!CATEGORIAS.includes(categoria)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Categoría inválida." } };
    return;
  }
  if (!texto) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el texto de la pregunta." } };
    return;
  }
  if (texto.length > TEXTO_MAX) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: `El texto es muy largo (máximo ${TEXTO_MAX} caracteres).` } };
    return;
  }

  try {
    const table = getEncuestaPreguntasTable();
    await ensureTable(table);

    // el comentario es fijo: solo su texto, y solo en Globales
    if (id === COMENTARIO_ID) {
      if (categoria !== COMENTARIO_CATEGORIA) {
        context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Categoría inválida para el comentario." } };
        return;
      }
      await asegurarComentario(table);
      await table.updateEntity({ partitionKey: COMENTARIO_CATEGORIA, rowKey: COMENTARIO_ID, texto }, "Merge");
      context.res = { status: 200, headers: JSON_HEADERS, body: { id: COMENTARIO_ID } };
      return;
    }

    const existentes = await listarPreguntas(table, categoria);

    if (id) {
      const actual = existentes.find((e) => e.rowKey === id);
      if (!actual) {
        context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Esa pregunta ya no existe." } };
        return;
      }
      const cambios = { partitionKey: categoria, rowKey: id, texto };
      if (categoria === COMENTARIO_CATEGORIA) cambios.nombreCorto = nombreCorto;
      await table.updateEntity(cambios, "Merge");
      context.res = { status: 200, headers: JSON_HEADERS, body: { id } };
      return;
    }

    if (!cabeOtraEscala(categoria, existentes, null)) {
      context.res = { status: 409, headers: JSON_HEADERS, body: { error: "Esta categoría ya tiene todas las preguntas permitidas — edita o elimina una existente." } };
      return;
    }

    const ordenes = existentes.filter((e) => e.rowKey !== COMENTARIO_ID).map((e) => (typeof e.orden === "number" ? e.orden : 0));
    const orden = ordenes.length ? Math.max(...ordenes) + 10 : 0;
    const idNuevo = crypto.randomUUID();
    const nueva = { partitionKey: categoria, rowKey: idNuevo, texto, tipo: "escala", orden, activa: true };
    if (categoria === COMENTARIO_CATEGORIA) nueva.nombreCorto = nombreCorto;
    await table.upsertEntity(nueva, "Replace");
    context.res = { status: 200, headers: JSON_HEADERS, body: { id: idNuevo } };
  } catch (err) {
    context.log.error("Error guardando la pregunta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar: " + err.message } };
  }
};
