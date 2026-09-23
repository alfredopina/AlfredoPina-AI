// api/src/diploma-folio.js
// Folio de un diploma: consecutivo por Cliente + Año, sin importar
// herramienta (un diploma ya admite 1 a 3). Formato "AP{codigoCliente}-{AA}{NN}"
// (ej. "APACM-2601") — año y consecutivo van pegados sin separador, por eso al
// parsear folios existentes se busca "-{AA}" como prefijo fijo y el resto son
// puros dígitos del consecutivo (puede crecer más de 2 dígitos, el padStart
// del que llama solo garantiza un mínimo). Se calcula leyendo los folios ya
// usados por ese cliente en el año actual y tomando el máximo N + 1.
const { sql } = require("./backoffice-db");

async function siguienteConsecutivo(pool, clienteId, yy) {
  const r = await pool.request().input("clienteId", sql.Int, clienteId).query("SELECT folio FROM Diploma WHERE cliente_id = @clienteId");
  const patron = new RegExp(`-${yy}(\\d+)$`);
  let max = 0;
  for (const row of r.recordset) {
    const m = patron.exec(row.folio || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

function anioCorto() {
  return String(new Date().getFullYear()).slice(-2);
}

const NIVEL_TEXTO = ["", "Básico", "Intermedio", "Avanzado"];

// niveles llega como JSON de Grupo.niveles (ej. "[1,3]") — con varios se toma
// el más alto, el diploma no distingue nivel por herramienta.
function nivelTexto(nivelesJson) {
  let niveles = [];
  try { niveles = JSON.parse(nivelesJson || "[]"); } catch (e) { niveles = []; }
  const max = niveles.length ? Math.max(...niveles.map(Number)) : 1;
  return NIVEL_TEXTO[max] || "Básico";
}

module.exports = { siguienteConsecutivo, anioCorto, nivelTexto };
