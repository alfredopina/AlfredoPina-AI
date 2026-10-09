// Borrado REAL de una Cotización (excepción pedida por Alfredo 2026-10-08, con confirmación fuerte en el front).
// Reglas: (1) si ya nació un Grupo de ella (Grupo.cotizacion_id) NO se borra: 409 diciendo cuál; (2) las versiones que
// la "reemplazan" dejan de apuntarla (reemplaza_a_folio = NULL), no se borran; (3) si era la única cotización de su
// Solicitud y esa Solicitud estaba Cotizada, la Solicitud vuelve a Nueva (si no, quedaría "Cotizada" sin cotización).
// `nuevaRequest` = () => Request ligado a la transacción; la propuesta web (Table Storage) la borra la Function después.
const { sql } = require("./backoffice-db");

const falla = (status, mensaje) => Object.assign(new Error(mensaje), { status, safe: true });

async function eliminarCotizacionDe(nuevaRequest, id) {
  if (!id) throw falla(400, "Falta el id de la cotización.");
  const c = await nuevaRequest().input("id", sql.Int, id).query("SELECT id, folio, solicitud_id, blob_path FROM Cotizacion WHERE id = @id");
  if (!c.recordset.length) throw falla(404, "Esa cotización ya no existe.");
  const cot = c.recordset[0];

  const grupos = await nuevaRequest().input("id", sql.Int, id).query("SELECT TOP 3 grupo_codigo, nombre_curso FROM Grupo WHERE cotizacion_id = @id");
  if (grupos.recordset.length) {
    const lista = grupos.recordset.map((g) => g.grupo_codigo || g.nombre_curso || "grupo").join(", ");
    throw falla(409, `No se puede eliminar ${cot.folio}: ya nació el grupo ${lista} de esta cotización. Elimina o desliga el grupo primero.`);
  }

  await nuevaRequest().input("folio", sql.NVarChar, cot.folio).query("UPDATE Cotizacion SET reemplaza_a_folio = NULL WHERE reemplaza_a_folio = @folio");
  await nuevaRequest().input("id", sql.Int, id).query("DELETE FROM Cotizacion WHERE id = @id");

  let solicitudReabierta = false;
  if (cot.solicitud_id) {
    const otras = await nuevaRequest().input("s", sql.Int, cot.solicitud_id).query("SELECT COUNT(*) AS n FROM Cotizacion WHERE solicitud_id = @s");
    if (otras.recordset[0].n === 0) {
      const r = await nuevaRequest()
        .input("s", sql.Int, cot.solicitud_id)
        .query("UPDATE Solicitud SET estatus = 'Nueva', fecha_estatus = SYSUTCDATETIME() WHERE id = @s AND estatus = 'Cotizada'");
      solicitudReabierta = !!(r.rowsAffected && r.rowsAffected[0]);
    }
  }
  return { folio: cot.folio, blobPath: cot.blob_path, solicitudReabierta };
}

module.exports = { eliminarCotizacionDe };
