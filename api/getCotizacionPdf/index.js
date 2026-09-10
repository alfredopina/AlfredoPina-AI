// getCotizacionPdf/index.js
// Function protegida (rol "admin"): regresa el PDF de una cotización desde el
// contenedor privado "cotizaciones" — nunca se expone por link directo,
// siempre pasa por aquí (que valida el rol antes de tocar el blob). Mismo
// patrón que getDiplomaPdf.
const { getPool, sql } = require("../src/backoffice-db");
const { getCotizacionPdfBuffer } = require("../src/cotizaciones-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const folio = (req.query.folio || "").trim();
  if (!folio) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el folio." } };
    return;
  }

  try {
    const pool = await getPool();
    const r = await pool.request().input("folio", sql.NVarChar, folio).query("SELECT blob_path FROM Cotizacion WHERE folio = @folio");
    const blobPath = r.recordset.length ? r.recordset[0].blob_path : null;
    if (!blobPath) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "No hay PDF para ese folio." } };
      return;
    }

    const buffer = await getCotizacionPdfBuffer(folio);
    if (!buffer) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "No se encontró el PDF." } };
      return;
    }

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${folio}.pdf"`,
        "Cache-Control": "no-store",
      },
      body: buffer,
    };
  } catch (err) {
    context.log.error("Error descargando la cotización:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo descargar el PDF: " + err.message } };
  }
};
