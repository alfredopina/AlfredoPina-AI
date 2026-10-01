// guardarFotoGrupo/index.js
// Function protegida (rol "admin"): guarda si la foto del grupo se muestra
// en el Reporte de Resultados y, si mandan una, la sube/reemplaza. El front
// ya redujo la imagen (ancho máximo, conserva proporción — una foto de grupo
// es horizontal, a diferencia del recorte cuadrado de foto de instructor)
// antes de mandarla en base64 — ver fotoGrupoReducida() en admin/index.html.
const { getPool, sql } = require("../src/backoffice-db");
const { subirFotoGrupo } = require("../src/grupo-foto-storage");
const { JSON_HEADERS } = require("../src/http");

const MAX_FOTO_BYTES = 1.5 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

module.exports = async function (context, req) {
  const body = req.body || {};
  const grupoId = Number(body.grupoId);
  if (!grupoId) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el grupo." } };
    return;
  }
  const visible = body.visible === false ? 0 : 1;

  try {
    if (body.fileBase64) {
      const tipo = String(body.contentType || "");
      const buffer = Buffer.from(String(body.fileBase64), "base64");
      if (!TIPOS.includes(tipo) || !buffer.length) {
        context.res = { status: 400, headers: JSON_HEADERS, body: { error: "La foto debe ser JPG, PNG o WebP." } };
        return;
      }
      if (buffer.length > MAX_FOTO_BYTES) {
        context.res = { status: 400, headers: JSON_HEADERS, body: { error: "La foto pesa demasiado (máx. 1.5 MB)." } };
        return;
      }
      await subirFotoGrupo(grupoId, buffer, tipo);
    }

    const pool = await getPool();
    const r = await pool.request().input("id", sql.Int, grupoId).input("v", sql.Bit, visible).query("UPDATE Grupo SET foto_grupo_visible = @v WHERE id = @id");
    if (!r.rowsAffected[0]) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese grupo ya no existe." } };
      return;
    }
    context.res = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  } catch (err) {
    context.log.error("Error guardando la foto del grupo:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo guardar: " + err.message } };
  }
};
