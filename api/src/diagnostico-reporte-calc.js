// Cálculo del snapshot de un Reporte de Diagnóstico — corre UNA sola vez
// cuando Alfredo da clic a "Generar reporte" en el admin (generarReporteDiagnostico),
// nunca al abrir la página pública (ver diagnostico-reporte-tables.js). Todo
// en porcentajes, nunca puntos crudos (decisión explícita de Alfredo).
//
// Segmentación (Grupos): "Recomendado: Iniciar en Básico" si %general está
// debajo de la mediana de la muestra O %Básico < 80% (4/5) — es un OR:
// alguien con buen total pero Básico débil igual conviene reforzarlo antes de
// avanzar. Todos los demás van a "Recomendado: Iniciar en Intermedio".
//
// Duración en 4 categorías por minutos de tiempo_respuesta_seg: Exprés (<10),
// Ritmo normal (10-20), Ritmo pausado (20-30), Atípico (30+).
const NIVEL_NOMBRE = { 1: "basico", 2: "intermedio", 3: "avanzado" };
const NIVEL_LABEL = { basico: "Básico", intermedio: "Intermedio", avanzado: "Avanzado" };
const UMBRAL_BASICO_PCT = 80;
const UMBRAL_BENCHMARK_MIN_N = 10;

function pct(aciertos, total) {
  return total > 0 ? Math.round((aciertos / total) * 100) : null;
}

function mediana(numeros) {
  if (!numeros.length) return null;
  const s = numeros.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function promedio(numeros) {
  const validos = numeros.filter((n) => n != null);
  if (!validos.length) return null;
  return Math.round(validos.reduce((a, b) => a + b, 0) / validos.length);
}

function bucketDuracion(seg) {
  if (seg == null) return null;
  const min = seg / 60;
  if (min < 10) return "expres";
  if (min < 20) return "normal";
  if (min < 30) return "pausado";
  return "atipico";
}

const DURACION_LABEL = { expres: "Exprés", normal: "Ritmo normal", pausado: "Ritmo pausado", atipico: "Atípico" };

function labelsUnidos(labels) {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return labels.join(" y ");
  return labels.slice(0, -1).join(", ") + " y " + labels[labels.length - 1];
}

// Frase de nivel fuerte/débil — compartida entre el insight del GRUPO
// (contra promedioPorNivel) y el de cada PERSONA (contra sus propios
// pctBasico/Intermedio/Avanzado). Antes el insight de cada persona reusaba
// por error el nivel fuerte/débil calculado del GRUPO completo, con el valor
// de esa persona metido a la fuerza — sonaba incongruente en cuanto la
// persona no seguía ese mismo patrón (ej. alguien parejo 100/100/100, donde
// el grupo tenía a Avanzado como el más débil en promedio). Cubre además:
// empate en el nivel más alto/más bajo (uno o varios niveles), desempeño
// parejo (alto/bajo/medio) y el caso donde el "más débil" sigue siendo un
// buen puntaje (≥80%) — ahí no tiene sentido presentarlo como una debilidad.
function fraseNiveles(pctBasico, pctIntermedio, pctAvanzado, sujeto) {
  const niveles = [
    { label: "Básico", val: pctBasico },
    { label: "Intermedio", val: pctIntermedio },
    { label: "Avanzado", val: pctAvanzado },
  ].filter((n) => n.val != null);
  if (!niveles.length) return "";

  const max = Math.max(...niveles.map((n) => n.val));
  const min = Math.min(...niveles.map((n) => n.val));
  const todos3 = niveles.length === 3 ? "los 3 niveles" : "los niveles evaluados";
  const esGrupo = sujeto === "grupo";

  if (max === min) {
    if (max >= 80) {
      return esGrupo
        ? `El grupo tiene un desempeño sólido y parejo en ${todos3} (${max}%).`
        : `Tiene un desempeño sólido y parejo en ${todos3} (${max}%).`;
    }
    if (max <= 20) {
      return esGrupo
        ? `El grupo tuvo dificultad pareja en ${todos3} (${max}%) — conviene reforzar desde la base.`
        : `Tuvo dificultad pareja en ${todos3} (${max}%) — conviene reforzar desde la base.`;
    }
    return esGrupo
      ? `El grupo tiene un desempeño parejo en ${todos3} (${max}%), con oportunidad de mejora repartida por igual.`
      : `Tiene un desempeño parejo en ${todos3} (${max}%), con oportunidad de mejora repartida por igual.`;
  }

  const fuertes = labelsUnidos(niveles.filter((n) => n.val === max).map((n) => n.label));
  const debiles = labelsUnidos(niveles.filter((n) => n.val === min).map((n) => n.label));

  // El nivel "más bajo" sigue siendo un buen puntaje — no se presenta como
  // debilidad, solo como la relativa (más honesto que forzar un tono de alarma).
  if (min >= 80) {
    return esGrupo
      ? `El grupo tiene un desempeño fuerte en general — destaca en ${fuertes} (${max}%), con ${debiles} (${min}%) como su área de mayor oportunidad relativa.`
      : `Tiene un desempeño fuerte en general — destaca en ${fuertes} (${max}%), con ${debiles} (${min}%) como su área de mayor oportunidad relativa.`;
  }
  return esGrupo
    ? `El grupo domina ${fuertes} (${max}%); tiene más oportunidad de mejora en ${debiles} (${min}%).`
    : `Su nivel más fuerte es ${fuertes} (${max}%); tiene más oportunidad de mejora en ${debiles} (${min}%).`;
}

// Comparación contra la mediana — siempre su propia oración, separada de
// fraseNiveles (antes iba pegada con un guion largo en una sola oración
// densa; separarlas es más fácil de leer, pedido explícito de Alfredo).
function fraseMediana(pctGeneral, medianaGeneral) {
  if (pctGeneral == null || medianaGeneral == null) return "";
  const delta = pctGeneral - medianaGeneral;
  if (delta > 0) return `Está ${delta} puntos porcentuales arriba de la mediana de su grupo (${medianaGeneral}%).`;
  if (delta < 0) return `Está ${Math.abs(delta)} puntos porcentuales debajo de la mediana de su grupo (${medianaGeneral}%).`;
  return `Está justo en la mediana de su grupo (${medianaGeneral}%).`;
}

// Agrupa las filas planas (1 fila por pregunta contestada) en 1 registro por
// persona, con tallies por nivel — mismo patrón que listRespuestasDiagnosticoAdmin
// pero sin resolver el banco de preguntas (aquí no hace falta el detalle).
function agruparPorPersona(filas) {
  const porId = new Map();
  for (const row of filas) {
    if (!porId.has(row.respuesta_id)) {
      porId.set(row.respuesta_id, {
        id: row.respuesta_id,
        nombre: row.nombre,
        correo: row.correo,
        area: row.area,
        fechaEnvio: row.fecha_envio,
        tiempoSeg: row.tiempo_respuesta_seg,
        tallies: { basico: { aciertos: 0, total: 0 }, intermedio: { aciertos: 0, total: 0 }, avanzado: { aciertos: 0, total: 0 } },
      });
    }
    const p = porId.get(row.respuesta_id);
    const banda = NIVEL_NOMBRE[row.nivel];
    if (banda) {
      p.tallies[banda].total++;
      if (row.fue_correcta) p.tallies[banda].aciertos++;
    }
  }
  return Array.from(porId.values());
}

async function consultarFilas(pool, sql, { herramienta, clienteId, clienteIdExcluir, desde, hasta }) {
  const request = pool.request();
  const condiciones = ["r.herramienta = @herramienta"];
  request.input("herramienta", sql.VarChar, herramienta);
  if (clienteId) {
    condiciones.push("r.cliente_id = @clienteId");
    request.input("clienteId", sql.Int, Number(clienteId));
  }
  if (clienteIdExcluir) {
    condiciones.push("r.cliente_id <> @clienteIdExcluir");
    request.input("clienteIdExcluir", sql.Int, Number(clienteIdExcluir));
  }
  if (desde) {
    condiciones.push("CAST(r.fecha_envio AS DATE) >= @desde");
    request.input("desde", sql.Date, new Date(desde));
  }
  if (hasta) {
    condiciones.push("CAST(r.fecha_envio AS DATE) <= @hasta");
    request.input("hasta", sql.Date, new Date(hasta));
  }
  const result = await request.query(`
    SELECT r.id AS respuesta_id, r.nombre, r.correo, r.area, r.fecha_envio, r.tiempo_respuesta_seg,
           d.nivel, d.fue_correcta
    FROM DiagnosticoRespuesta r
    JOIN DiagnosticoRespuestaDetalle d ON d.respuesta_id = r.id
    WHERE ${condiciones.join(" AND ")}
  `);
  return result.recordset;
}

// Benchmark: promedio histórico de %general de Alfredo para esa herramienta,
// contra TODOS los clientes salvo el de este reporte, sin acotar por fecha —
// es "el mercado" completo hasta hoy, no solo la ventana del reporte.
async function calcularBenchmark(pool, sql, { herramienta, clienteIdExcluir }) {
  const filas = await consultarFilas(pool, sql, { herramienta, clienteIdExcluir });
  const personas = agruparPorPersona(filas);
  const pcts = personas
    .map((p) => {
      const tot = p.tallies.basico.total + p.tallies.intermedio.total + p.tallies.avanzado.total;
      const ac = p.tallies.basico.aciertos + p.tallies.intermedio.aciertos + p.tallies.avanzado.aciertos;
      return pct(ac, tot);
    })
    .filter((v) => v != null);
  if (!pcts.length) return null;
  return { promedio: promedio(pcts), n: pcts.length };
}

async function calcularReporte(pool, sql, { herramienta, clienteId, clienteNombre, desde, hasta }) {
  const filas = await consultarFilas(pool, sql, { herramienta, clienteId, desde, hasta });
  const personasRaw = agruparPorPersona(filas);

  const participantes = personasRaw.map((p) => {
    const pctBasico = pct(p.tallies.basico.aciertos, p.tallies.basico.total);
    const pctIntermedio = pct(p.tallies.intermedio.aciertos, p.tallies.intermedio.total);
    const pctAvanzado = pct(p.tallies.avanzado.aciertos, p.tallies.avanzado.total);
    const totalAciertos = p.tallies.basico.aciertos + p.tallies.intermedio.aciertos + p.tallies.avanzado.aciertos;
    const totalPreguntas = p.tallies.basico.total + p.tallies.intermedio.total + p.tallies.avanzado.total;
    const pctGeneral = pct(totalAciertos, totalPreguntas);
    return {
      id: p.id,
      nombre: p.nombre,
      correo: p.correo,
      area: p.area,
      fechaEnvio: p.fechaEnvio,
      tiempoSeg: p.tiempoSeg,
      duracionBucket: bucketDuracion(p.tiempoSeg),
      pctBasico,
      pctIntermedio,
      pctAvanzado,
      pctGeneral,
    };
  });

  const n = participantes.length;
  const medianaGeneral = mediana(participantes.map((p) => p.pctGeneral).filter((v) => v != null));

  // segmentación — OR entre "debajo de la mediana" y "Básico débil"
  for (const p of participantes) {
    const criterios = [];
    const cumpleMediana = medianaGeneral != null && p.pctGeneral != null && p.pctGeneral < medianaGeneral;
    const cumpleBasico = p.pctBasico != null && p.pctBasico < UMBRAL_BASICO_PCT;
    if (cumpleMediana) criterios.push("Debajo de mediana");
    if (cumpleBasico) criterios.push("Básico bajo");
    p.grupo = cumpleMediana || cumpleBasico ? "basico" : "intermedio";
    p.criterios = criterios;
  }

  const promedioPorNivel = {
    basico: promedio(participantes.map((p) => p.pctBasico)),
    intermedio: promedio(participantes.map((p) => p.pctIntermedio)),
    avanzado: promedio(participantes.map((p) => p.pctAvanzado)),
  };

  const duracion = { expres: 0, normal: 0, pausado: 0, atipico: 0 };
  for (const p of participantes) {
    if (p.duracionBucket) duracion[p.duracionBucket]++;
  }

  const fraseNivelGrupo = fraseNiveles(promedioPorNivel.basico, promedioPorNivel.intermedio, promedioPorNivel.avanzado, "grupo");
  const necesitanAtencionN = participantes.filter((p) => p.grupo === "basico").length;

  // Regla de negocio (pedida por Alfredo): el benchmark solo se muestra con
  // más de 10 respuestas históricas de otros clientes — con menos, comparar
  // "vs. el mercado" es más ruido que señal. Con poco historial, el reporte
  // simplemente no muestra comparación (el gauge ya muestra el promedio
  // propio del cliente sin marcador de mercado — ver reporte-diagnostico.html).
  const benchmarkCrudo = clienteId ? await calcularBenchmark(pool, sql, { herramienta, clienteIdExcluir: clienteId }) : null;
  const benchmark = benchmarkCrudo && benchmarkCrudo.n > UMBRAL_BENCHMARK_MIN_N ? benchmarkCrudo : null;
  const promedioGeneral = promedio(participantes.map((p) => p.pctGeneral));

  // insight por persona — a partir de SUS PROPIOS niveles (nunca del
  // grupo, ver fraseNiveles), prefijado por el tag de grupo en la vista
  // Individual. Se guarda ya armado para no repetir la lógica de texto en
  // el front (pantalla e impresión leen el mismo string).
  for (const p of participantes) {
    const frases = [fraseNiveles(p.pctBasico, p.pctIntermedio, p.pctAvanzado, "persona"), fraseMediana(p.pctGeneral, medianaGeneral)].filter(Boolean);
    p.insight = frases.join(" ");
  }

  return {
    meta: { herramienta, clienteId: clienteId || null, clienteNombre: clienteNombre || null, desde: desde || null, hasta: hasta || null },
    general: {
      n,
      promedioGeneral,
      medianaGeneral,
      tiempoPromedioSeg: Math.round(promedio(participantes.map((p) => p.tiempoSeg)) || 0) || null,
      promedioPorNivel,
      benchmark: benchmark ? { ...benchmark, delta: promedioGeneral != null ? promedioGeneral - benchmark.promedio : null } : null,
      insights: {
        fraseNivel: fraseNivelGrupo,
        necesitanAtencion: { n: necesitanAtencionN, pct: n > 0 ? Math.round((necesitanAtencionN / n) * 100) : 0 },
      },
      duracion,
    },
    participantes,
  };
}

module.exports = { calcularReporte, calcularBenchmark, DURACION_LABEL, NIVEL_LABEL, bucketDuracion, mediana, promedio, fraseNiveles, fraseMediana };
