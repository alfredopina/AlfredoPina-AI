// getCotizacionPdf/index.js
// Function protegida (rol "admin"): "abre" una cotización por su folio. Las cotizaciones NUEVAS ya no tienen PDF, tienen
// propuesta (blob_path = "propuesta/{código}"): aquí se redirige a /propuesta/{código}. Las VIEJAS regresan su PDF desde
// el contenedor privado "cotizaciones" — nunca se expone por link directo, siempre pasa por aquí (que valida el rol
// antes de tocar el blob). Mismo patrón que getDiplomaPdf. Conserva el nombre para no romper los enlaces del admin.
const { getPool, sql } = require("../src/backoffice-db");
const { getCotizacionPdfBuffer } = require("../src/cotizaciones-storage");
const { codigoDePropuesta } = require("../src/propuestas");
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

    const codigo = codigoDePropuesta(blobPath);
    if (codigo) {
      context.res = { status: 302, headers: { Location: "/propuesta/" + codigo, "Cache-Control": "no-store" }, body: "" };
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
