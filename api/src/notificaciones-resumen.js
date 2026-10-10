// api/src/notificaciones-resumen.js
// Resumen semanal por correo (lunes 7:00, hora de Monterrey). Dos partes:
//   · "Cómo está todo ahora": una FOTO del momento (solicitudes sin atender, cotizaciones en pipeline, sin respuesta,
//     por vencer, aceptadas por confirmar, grupos que inician esta semana). No es un periodo ni toca las tarjetas de los
//     Tracking (esas son acumuladas y nunca se reinician solas).
//   · "Lo nuevo desde el último resumen": respuestas de Encuestas y Diagnósticos y aperturas de reportes de
//     calificaciones y de diplomas. El punto de comparación vive en notificaciones-ajustes (ultimoResumen), no en los Tracking.
// Este módulo junta los datos (recolectar) y arma el correo (armarResumen, función pura probada sin Azure).
const { armarAviso, fechaLocal, esc } = require("./notificaciones-correo");

const dinero = (n) => Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Diferencia de un contador acumulado contra el del resumen anterior. null = no hay con qué comparar (primer resumen).
function nuevos(actual, anterior) {
  if (anterior === undefined || anterior === null || isNaN(anterior)) return null;
  return Math.max(0, Number(actual || 0) - Number(anterior));
}

// d = { desde (ISO|null), solicitudes:{ nuevas, sinAtender, rojas, enCola }, cotizaciones:{ n, monto, rojas, diasRojo,
//   porVencer, vencidas, sinAbrir, aceptadas:[{folio,cliente}] }, grupos:[{codigo,curso,cliente,fecha}],
//   encuestas:[{cliente,n}], diagnosticos:[{cliente,herramienta,n}], aperturas:{ reportes:null|n, diplomas:null|n,
//   desdeLinkedin:null|n } }
function armarResumen(d) {
  const secciones = []; // [{ titulo, lineas:[string] }]
  const s = d.solicitudes, c = d.cotizaciones;

  const sol = [
    s.sinAtender
      ? `${plural(s.sinAtender, "solicitud sin atender", "solicitudes sin atender")}` + (s.rojas ? ` (${plural(s.rojas, "lleva", "llevan")} más tiempo del límite)` : "")
      : "Ninguna solicitud sin atender.",
  ];
  if (s.enCola) sol.push(`${plural(s.enCola, "solicitud espera", "solicitudes esperan")} en la cola del sitio; se procesan al abrir el admin.`);
  if (s.nuevas) sol.push(`${plural(s.nuevas, "solicitud nueva", "solicitudes nuevas")} desde el resumen anterior.`);
  secciones.push({ titulo: "Solicitudes", lineas: sol });

  const cot = [`${plural(c.n, "cotización", "cotizaciones")} en pipeline por ${dinero(c.monto)}.`];
  if (c.rojas) cot.push(`${plural(c.rojas, "lleva", "llevan")} ${c.diasRojo} días o más sin respuesta.`);
  if (c.sinAbrir) cot.push(`${plural(c.sinAbrir, "no ha sido abierta", "no han sido abiertas")} por el cliente.`);
  if (c.porVencer) cot.push(`${plural(c.porVencer, "vence", "vencen")} en los próximos 7 días.`);
  if (c.vencidas) cot.push(`${plural(c.vencidas, "ya venció", "ya vencieron")}: extiéndela o ciérrala.`);
  for (const a of c.aceptadas || []) cot.push(`Aceptada por confirmar: ${a.folio} — ${a.cliente}.`);
  secciones.push({ titulo: "Cotizaciones", lineas: cot });

  secciones.push({
    titulo: "Grupos que inician esta semana",
    lineas: d.grupos.length ? d.grupos.map((g) => `${g.fecha}: ${[g.codigo, g.curso].filter(Boolean).join(" · ")} — ${g.cliente}`) : ["Ninguno."],
  });

  const nuevo = [];
  const totEnc = d.encuestas.reduce((a, x) => a + x.n, 0);
  nuevo.push(totEnc ? `Encuestas: ${plural(totEnc, "respuesta", "respuestas")} (${d.encuestas.map((x) => `${x.cliente} ${x.n}`).join(", ")}).` : "Encuestas: sin respuestas nuevas.");
  const totDia = d.diagnosticos.reduce((a, x) => a + x.n, 0);
  nuevo.push(totDia ? `Diagnósticos: ${plural(totDia, "respuesta", "respuestas")} (${d.diagnosticos.map((x) => `${x.cliente} ${x.herramienta === "powerbi" ? "Power BI" : "Excel"} ${x.n}`).join(", ")}).` : "Diagnósticos: sin respuestas nuevas.");
  const ap = d.aperturas;
  if (ap.reportes === null && ap.diplomas === null) {
    nuevo.push("Aperturas de reportes y diplomas: a partir de este resumen empiezo a contarlas.");
  } else {
    nuevo.push(`Reportes de calificaciones abiertos: ${ap.reportes === null ? "—" : ap.reportes}.`);
    nuevo.push(`Diplomas verificados (QR o folio): ${ap.diplomas === null ? "—" : ap.diplomas}` + (ap.desdeLinkedin ? `, ${ap.desdeLinkedin} desde LinkedIn.` : "."));
  }
  secciones.push({ titulo: "Lo nuevo desde el último resumen" + (d.desde ? ` (${fechaLocal(d.desde)})` : ""), lineas: nuevo });

  const texto = secciones.map((x) => `${x.titulo.toUpperCase()}\n` + x.lineas.map((l) => "- " + l).join("\n")).join("\n\n") + "\n\nAbre el admin: https://www.alfredopina.ai/admin";
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#181c24;max-width:560px"><h2 style="margin:0 0 4px;font-size:18px">Resumen de la semana</h2>` +
    secciones.map((x) => `<h3 style="margin:18px 0 6px;font-size:14px;color:#1f5fe0">${esc(x.titulo)}</h3><ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.5">` + x.lineas.map((l) => `<li>${esc(l)}</li>`).join("") + `</ul>`).join("") +
    `<p style="margin:20px 0 0"><a href="https://www.alfredopina.ai/admin" style="color:#1f5fe0">Abrir el admin</a></p></div>`;
  const hoy = new Date().toLocaleDateString("es-MX", { timeZone: "America/Monterrey", day: "numeric", month: "long" });
  return { asunto: `Resumen de la semana — ${hoy}`, texto, html };
}

// Junta los datos con la base ya despierta. `pool`/`sql` de backoffice-db; `tablas` = { propuestas, calificacionesReportes,
// diplomasVerif } (Table Storage); `umbrales` = getUmbrales(); `previo` = ultimoResumen ({ en, contadores }) o null.
// Regresa { datos, contadores } — `contadores` es lo que se guarda para el siguiente resumen.
async function recolectar({ pool, sql, tablas, umbrales, previo, ahora = new Date(), listarEstadisticasPropuestas, listarReportesCalificaciones, listarEstadisticasDiplomas, contarCola }) {
  const desde = previo && previo.en ? previo.en : new Date(ahora.getTime() - 7 * 86400000).toISOString();
  const q = async (consulta, params = {}) => {
    const r = pool.request();
    for (const [k, [tipo, v]] of Object.entries(params)) r.input(k, tipo, v);
    return (await r.query(consulta)).recordset;
  };

  const [sol] = await q(
    `SELECT COUNT(*) AS sinAtender,
            SUM(CASE WHEN DATEDIFF(MINUTE, fecha_creacion, SYSUTCDATETIME()) > @urgente THEN 1 ELSE 0 END) AS rojas,
            SUM(CASE WHEN fecha_creacion >= @desde THEN 1 ELSE 0 END) AS nuevas
     FROM Solicitud WHERE estatus = 'Nueva'`,
    { urgente: [sql.Int, umbrales.solicitudesHoras * 60], desde: [sql.DateTime2, new Date(desde)] }
  );

  const cotRows = await q(
    `SELECT s.folio, c.nombre AS cliente, s.precio_final, s.fecha_vigencia, s.blob_path,
            DATEDIFF(day, s.fecha_estatus, GETUTCDATE()) AS dias,
            DATEDIFF(day, CAST(GETUTCDATE() AS DATE), s.fecha_vigencia) AS dias_vigencia
     FROM Cotizacion s JOIN Cliente c ON c.id = s.cliente_id
     WHERE s.estatus IN ('Enviada', 'En negociación')`
  );
  const stats = await listarEstadisticasPropuestas();
  const { codigoDePropuesta } = require("./propuestas");
  let monto = 0, rojas = 0, porVencer = 0, vencidas = 0, sinAbrir = 0;
  const aceptadas = [];
  for (const r of cotRows) {
    monto += Number(r.precio_final || 0);
    if (r.dias >= umbrales.cotizacionesDias) rojas++;
    if (r.dias_vigencia !== null && r.dias_vigencia < 0) vencidas++;
    else if (r.dias_vigencia !== null && r.dias_vigencia <= 7) porVencer++;
    const st = stats[codigoDePropuesta(r.blob_path)];
    if (st) {
      if (st.aceptadaEn) aceptadas.push({ folio: r.folio, cliente: r.cliente });
      else if (!st.vistas) sinAbrir++;
    }
  }

  const grupos = (await q(
    `SELECT g.grupo_codigo, g.nombre_curso, c.nombre AS cliente, CONVERT(VARCHAR(10), g.fecha_inicio, 23) AS fecha
     FROM Grupo g JOIN Cliente c ON c.id = g.cliente_id
     WHERE g.estatus_curso = 'Por iniciar' AND g.fecha_inicio >= CAST(GETUTCDATE() AS DATE) AND g.fecha_inicio < DATEADD(day, 8, CAST(GETUTCDATE() AS DATE))
     ORDER BY g.fecha_inicio`
  )).map((g) => ({ codigo: g.grupo_codigo, curso: g.nombre_curso, cliente: g.cliente, fecha: g.fecha }));

  const desdeParam = { desde: [sql.DateTime2, new Date(desde)] };
  const encuestas = await q(`SELECT c.nombre AS cliente, COUNT(*) AS n FROM EncuestaRespuesta r JOIN Cliente c ON c.id = r.cliente_id WHERE r.fecha_envio >= @desde GROUP BY c.nombre ORDER BY COUNT(*) DESC`, desdeParam);
  const diagnosticos = await q(`SELECT c.nombre AS cliente, r.herramienta, COUNT(*) AS n FROM DiagnosticoRespuesta r JOIN Cliente c ON c.id = r.cliente_id WHERE r.fecha_envio >= @desde GROUP BY c.nombre, r.herramienta ORDER BY COUNT(*) DESC`, desdeParam);

  const repCal = await listarReportesCalificaciones();
  const vistasReportes = repCal.reduce((a, r) => a + (r.vistas || 0), 0);
  const est = await listarEstadisticasDiplomas();
  let vistasDiplomas = 0, linkedin = 0;
  for (const g of Object.values(est.porGrupo || {})) { vistasDiplomas += g.vistas || 0; linkedin += g.desdeLinkedin || 0; }
  const prev = (previo && previo.contadores) || {};
  const contadores = { reportesCalificaciones: vistasReportes, verificacionesDiplomas: vistasDiplomas, desdeLinkedin: linkedin };

  const datos = {
    desde: previo && previo.en ? previo.en : null,
    solicitudes: { nuevas: sol.nuevas || 0, sinAtender: sol.sinAtender || 0, rojas: sol.rojas || 0, enCola: await contarCola() },
    cotizaciones: { n: cotRows.length, monto, rojas, diasRojo: umbrales.cotizacionesDias, porVencer, vencidas, sinAbrir, aceptadas },
    grupos,
    encuestas: encuestas.map((e) => ({ cliente: e.cliente, n: e.n })),
    diagnosticos: diagnosticos.map((e) => ({ cliente: e.cliente, herramienta: e.herramienta, n: e.n })),
    aperturas: {
      reportes: nuevos(vistasReportes, prev.reportesCalificaciones),
      diplomas: nuevos(vistasDiplomas, prev.verificacionesDiplomas),
      desdeLinkedin: nuevos(linkedin, prev.desdeLinkedin),
    },
  };
  return { datos, contadores };
}

module.exports = { armarResumen, recolectar, nuevos };
