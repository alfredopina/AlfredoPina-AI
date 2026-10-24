// Cotizaciones alternativas (2026-10-24): varias cotizaciones de UNA misma oportunidad (p. ej. 1 grupo vs 2 grupos del mismo curso).
// Se vinculan con el mismo Cotizacion.alternativa_grupo. Reglas:
//   · Al ganarse una, las demás abiertas pasan solas a "Descartada" (no es pérdida: no entra a conversión ni a pipeline).
//   · Una cotización con alternativas abiertas NO se marca Perdida (se descarta); la última que queda abierta sí puede perderse, y
//     así la oportunidad cuenta como UNA pérdida.
//   · Pipeline: el grupo cuenta una vez, con el monto más alto de sus cotizaciones en Enviada / En negociación.
const { sql } = require("./backoffice-db");

const ABIERTAS = ["Borrador", "Enviada", "En negociación"];

// De una lista de cotizaciones del pipeline deja una por grupo de alternativas (la de monto más alto; empate = la más antigua).
function representantes(filas) {
  const mejor = new Map();
  const sueltas = [];
  for (const f of filas) {
    if (f.alternativa_grupo == null) { sueltas.push(f); continue; }
    const m = mejor.get(f.alternativa_grupo);
    const a = Number(f.precio_final) || 0, b = m ? Number(m.precio_final) || 0 : 0;
    if (!m || a > b || (a === b && f.id < m.id)) mejor.set(f.alternativa_grupo, f);
  }
  return sueltas.concat([...mejor.values()]);
}

// `nuevaRequest` = () => Request (del pool o de una transacción). Cuántas alternativas ABIERTAS tiene la cotización (sin contarse a sí misma).
async function contarHermanasAbiertas(nuevaRequest, id) {
  const r = await nuevaRequest().input("id", sql.Int, id).query(
    `SELECT COUNT(*) AS n FROM Cotizacion h JOIN Cotizacion g ON g.alternativa_grupo = h.alternativa_grupo AND g.id = @id
     WHERE h.id <> @id AND h.estatus IN ('Borrador', 'Enviada', 'En negociación')`
  );
  return r.recordset[0].n;
}

// Al ganarse `id`: sus alternativas abiertas pasan a Descartada (con nota de cuál se ganó). Regresa cuántas descartó.
async function descartarAlternativasAbiertas(nuevaRequest, id) {
  const r = await nuevaRequest().input("id", sql.Int, id).query(
    `UPDATE h SET estatus = 'Descartada', fecha_estatus = SYSUTCDATETIME(), motivo_perdida = NULL, fecha_cierre = NULL,
                  nota_cierre = LEFT('Se ganó la alternativa ' + g.folio, 500)
     FROM Cotizacion h JOIN Cotizacion g ON g.alternativa_grupo = h.alternativa_grupo AND g.id = @id
     WHERE h.id <> @id AND g.alternativa_grupo IS NOT NULL AND h.estatus IN ('Borrador', 'Enviada', 'En negociación')`
  );
  return r.rowsAffected[0] || 0;
}

module.exports = { ABIERTAS, representantes, contarHermanasAbiertas, descartarAlternativasAbiertas };
