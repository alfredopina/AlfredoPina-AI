// api/src/grupo-fase.js
// Única fuente de verdad para la "fase" operativa de un Grupo (derivada de
// estatus_curso/estatus_cierre) y para loguear sus cambios en
// GrupoFaseHistorial. crearGrupo, editarGrupo, avanzarFaseGrupo y
// listGruposAdmin pasan siempre por aquí — nunca reimplementan la regla.
const { sql } = require("./backoffice-db");

const FASES = ["Por iniciar", "En curso", "Proyecto", "Calificaciones", "Diplomas", "Cerrado"];

function derivarFase(estatusCurso, estatusCierre) {
  if (estatusCurso === "Por iniciar") return "Por iniciar";
  if (estatusCurso === "En proceso") return "En curso";
  // Terminado — sin cierre capturado todavía cuenta como "Proyecto" (la
  // primera parada de cierre), igual que cuando el cierre ya dice "Proyecto".
  if (!estatusCierre || estatusCierre === "Proyecto") return "Proyecto";
  return estatusCierre; // 'Calificaciones' | 'Diplomas' | 'Cerrado'
}

// Mapeo inverso — usado por avanzarFaseGrupo para traducir la fase elegida en
// el stepper de vuelta a los campos reales de la tabla.
function estatusDeFase(fase) {
  if (fase === "Por iniciar") return { estatusCurso: "Por iniciar", estatusCierre: null };
  if (fase === "En curso") return { estatusCurso: "En proceso", estatusCierre: null };
  return { estatusCurso: "Terminado", estatusCierre: fase }; // Proyecto/Calificaciones/Diplomas/Cerrado
}

async function insertarFila(transaction, grupoId, fase, fecha) {
  const request = new sql.Request(transaction).input("grupoId", sql.Int, grupoId).input("fase", sql.NVarChar, fase);
  if (fecha) {
    request.input("fecha", sql.DateTime2, new Date(fecha));
    await request.query("INSERT INTO GrupoFaseHistorial (grupo_id, fase, fecha) VALUES (@grupoId, @fase, @fecha)");
  } else {
    await request.query("INSERT INTO GrupoFaseHistorial (grupo_id, fase) VALUES (@grupoId, @fase)");
  }
}

// Registra un cambio de fase real (avanzarFaseGrupo, o un editarGrupo que
// terminó moviendo la fase) — siempre con la fecha de "ahora", nunca inventa
// una fecha pasada. No hace nada si la fase no cambió.
async function registrarCambioFase(transaction, grupoId, faseNueva, faseAnterior) {
  if (faseNueva === faseAnterior) return;
  await insertarFila(transaction, grupoId, faseNueva, null);
}

// Solo para alta de un Grupo (crearGrupo). Si nace en "Por iniciar" (el caso
// normal, curso que todavía no arranca) siembra un solo renglón con la fecha
// real de alta — no con fecha_inicio, que suele ser una fecha futura. Si nace
// ya avanzado (carga retroactiva de un Excel viejo) infiere la fecha real de
// cada parada ya cruzada a partir de fecha_inicio/fecha_fin/fecha_cierre;
// Calificaciones/Diplomas no tienen un campo de fecha propio en Grupo, así
// que si la fase inicial las rebasa se omiten sin inventar nada.
async function sembrarHistorialInicial(transaction, grupoId, { estatusCurso, estatusCierre, fechaInicio, fechaFin, fechaCierre }) {
  const faseInicial = derivarFase(estatusCurso, estatusCierre);
  const idxFinal = FASES.indexOf(faseInicial);

  if (idxFinal === 0) {
    await insertarFila(transaction, grupoId, "Por iniciar", null);
    return;
  }

  const fechaPorFase = { "Por iniciar": fechaInicio, "En curso": fechaInicio, Proyecto: fechaFin, Cerrado: fechaCierre };
  for (let i = 0; i <= idxFinal; i++) {
    const fase = FASES[i];
    if (fase === "Calificaciones" || fase === "Diplomas") continue;
    await insertarFila(transaction, grupoId, fase, fechaPorFase[fase] || null);
  }
}

module.exports = { FASES, derivarFase, estatusDeFase, registrarCambioFase, sembrarHistorialInicial };
