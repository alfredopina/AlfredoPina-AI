// getDiplomaPdf/index.js
// Function protegida (rol "admin"): regresa el PDF de un diploma desde el
// contenedor privado "diplomas" — nunca se expone por link directo, siempre
// pasa por aquí (que valida el rol antes de tocar el blob).
const { getPool, sql } = require("../src/backoffice-db");
const { getDiplomasContainer } = require("../src/diplomas-storage");
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = async function (context, req) {
  const folio = (req.query.folio || "").trim();
  if (!folio) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el folio." } };
    return;
  }

  try {
    const pool = await getPool();
    const r = await pool.request().input("folio", sql.NVarChar, folio).query("SELECT blob_path FROM Diploma WHERE folio = @folio");
    const blobPath = r.recordset.length ? r.recordset[0].blob_path : null;
    if (!blobPath) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "No hay PDF para ese folio." } };
      return;
    }

    const container = getDiplomasContainer();
    const buffer = await container.getBlockBlobClient(blobPath).downloadToBuffer();

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${folio}.pdf"`,
        "Cache-Control": "no-store",
      },
      body: buffer,
    };
  } catch (err) {
    context.log.error("Error descargando el diploma:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo descargar el PDF: " + err.message } };
  }
};
