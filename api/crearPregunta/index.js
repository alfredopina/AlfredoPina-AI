// crearPregunta/index.js
// Function protegida (rol "admin"): upsert de una pregunta — si el body trae
// id, edita; si no, da de alta una nueva.
const { getPool, sql } = require("../src/backoffice-db");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

const SECCIONES = ["Instructor", "Curso y Materiales"];
const TIPOS = ["escala", "texto"];

module.exports = async function (context, req) {
  const body = req.body || {};
  const id = body.id ? Number(body.id) : null;
  const seccion = (body.seccion || "").trim();
  const texto = (body.texto || "").trim();
  const tipo = (body.tipo || "").trim();
  const orden = Number.isFinite(Number(body.orden)) ? Number(body.orden) : 0;
  const activa = body.activa === false ? 0 : 1;

  if (!SECCIONES.includes(seccion)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Sección inválida." } };
    return;
  }
  if (!TIPOS.includes(tipo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Tipo inválido." } };
    return;
  }
  if (!texto) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el texto de la pregunta." } };
    return;
  }

  try {
    const pool = await getPool();
    if (id) {
      await pool
        .request()
        .input("id", sql.Int, id)
        .input("seccion", sql.NVarChar, seccion)
        .input("texto", sql.NVarChar, texto)
        .input("tipo", sql.NVarChar, tipo)
        .input("orden", sql.Int, orden)
        .input("activa", sql.Bit, activa)
        .query("UPDATE EncuestaPregunta SET seccion=@seccion, texto=@texto, tipo=@tipo, orden=@orden, activa=@activa WHERE id=@id");
      context.res = { status: 200, headers: JSON_HEADERS, body: { id } };
    } else {
      const insert = await pool
        .request()
        .input("seccion", sql.NVarChar, seccion)
        .input("texto", sql.NVarChar, texto)
        .input("tipo", sql.NVarChar, tipo)
        .input("orden", sql.Int, orden)
        .input("activa", sql.Bit, activa)
        .query(
          "INSERT INTO EncuestaPregunta (seccion, texto, tipo, orden, activa) OUTPUT INSERTED.id VALUES (@seccion, @texto, @tipo, @orden, @activa)"
        );
      context.res = { status: 200, headers: JSON_HEADERS, body: { id: insert.recordset[0].id } };
    }
  } catch (err) {
    context.log.error("Error guardando la pregunta:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar: " + err.message } };
  }
};
