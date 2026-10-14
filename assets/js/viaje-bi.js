// assets/js/viaje-bi.js
// Viaje de Power BI (scrollytelling GSAP) para cursos.html. Se registra en window.ViajeEscenas
// (ver viaje.js, que expone el motor compartido ViajeEngine). Contenido en 4 actos sobre UN solo dato:
//   Transformar (Power Query) → Modelar (estrella) → Medir (DAX) → Visualizar (informe).
//
// Decisiones que NO hay que repetir si esto se toca:
//   - La cáscara es la ventana de Power BI Desktop (archivo + barra fx con el mensaje, riel de vistas,
//     tira de pasos), como la hoja de cálculo lo es para Excel. Es fija; solo cambia el contenido.
//   - Las 4 escenas viven en UN solo lienzo de 1100×620 con UN solo pin y UNA línea de tiempo maestra
//     (no una por escena, como Excel): así un objeto de una escena se vuelve el de la siguiente
//     (la ventana de Power Query se encoge hasta ser la tabla de hechos; las 3 tarjetas de medidas
//     se vuelven los KPI del tablero). El lienzo se escala completo al espacio disponible.
//   - Un solo dataset ("Ventas") y los mismos colores/cifras de principio a fin.
//   - Móvil (teléfono táctil): sin pin ni lienzo fijo; cada escena fluye en vertical y corre su animación
//     una vez (las mismas funciones de escena, con timeScale). Estático (reduced-motion o GSAP caído):
//     todo en su estado final (clase bi-final + estadoFinal()).
//   - Los cursores/ripples viven DENTRO de las escenas D y R (no uno global): en móvil cada escena es
//     un bloque aparte.
(function () {
  "use strict";
  const E = window.ViajeEngine;
  if (!E || !window.ViajeEscenas) return;

  // ---- constantes de la animación (unidades de la línea de tiempo maestra) ----
  const Y = "242,201,76";                 // amarillo Power BI (--c) en rgb, para tweens de color
  const HL = "rgba(" + Y + ",.14)", HL0 = "rgba(" + Y + ",0)";
  const RH = 34;                          // alto de fila de la tabla (px; igual en CSS: --rh)
  const S = { q: 0, m: 108, d: 186, r: 298 };          // inicio de cada escena
  const TR = { qm: 92, md: 170, dr: 282 };             // inicio de cada transición
  const TOTAL = 440;
  const UMBRAL = [100, 178, 290];                      // unidades donde cambia la escena activa
  const IR_A = { 1: 88, 2: 166, 3: 278, 4: 432 };      // a dónde aterriza cada pestaña (todo ya dibujado)

  const MSGS = [
    "Limpia datos sucios sin tocar una celda.",
    "Conecta tus tablas en un modelo estrella.",
    "Calcula con DAX lo que Excel no alcanza.",
    "Cuenta la historia con tus datos.",
  ];
  const VISTAS = ["Obtener datos", "Editor de Power Query", "Vista de modelo", "Medidas DAX", "Vista de informe"];
  const ESTADOS = ["Origen: Ventas.csv", "1 tabla · 8 → 5 filas", "5 tablas · 4 relaciones", "5 tablas · 3 medidas", "5 tablas · 3 medidas · 1 informe"];
  const RIEL = [null, "datos", "modelo", "datos", "informe"];

  // ---- íconos ----
  const svg = (d, w) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const I = {
    informe: svg('<path d="M5 21V11M12 21V4M19 21v-8"/>'),
    datos: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>'),
    modelo: svg('<rect x="3" y="3" width="7" height="6" rx="1"/><rect x="14" y="3" width="7" height="6" rx="1"/><rect x="8.5" y="15" width="7" height="6" rx="1"/><path d="M6.5 9v3h5M17.5 9v3h-5M12 12v3"/>'),
    pbi: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="14" width="5" height="7"/><rect x="9.5" y="8" width="5" height="13"/><rect x="16" y="2" width="5" height="19"/></svg>',
    flecha: svg('<path d="M12 5v14M5 12l7 7 7-7"/>', 2.2),
    check: svg('<path d="M5 13l4 4L19 7"/>', 3),
    filtro: svg('<path d="M4 5h16M7 12h10M10 19h4"/>', 2.4),
    tabla: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M9 9.5V20"/>', 1.8),
    llave: svg('<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H21M18 12v4"/>', 2),
    calc: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2M16 16h0"/>', 1.8),
    chev: svg('<path d="M9 6l6 6-6 6"/>', 2),
    brillo: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>', 1.6),
    embudo: svg('<path d="M3 5h18l-7 8v6l-4-2v-4z"/>', 1.8),
    cursor: '<svg class="cursor-ico reveal bi-cur" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l15 7-6.2 1.6L11 17z"/></svg>',
  };

  // ---- el dato: Ventas sucias (muestra de 8 filas). Se quitan c y e (nulos) y d (año 2023) ----
  const FILAS = [
    { k: "a", f: "12/03/24", c: "Acme", p: "Licencias Pro", r: ["norte", "Norte"], i: "182,400", m: "41%" },
    { k: "b", f: "05/02/24", c: "Delta", p: "Soporte Anual", r: ["CENTRO", "Centro"], i: "97,100", m: "28%" },
    { k: "c", f: "20/01/24", c: "Orbe", p: null, r: "Sur", i: "54,900", quitar: 1 },
    { k: "d", f: "14/11/23", c: "Nova", p: "Consultoría", r: "Norte", i: "120,300", m: "31%", quitar: 1 },
    { k: "e", f: "02/04/24", c: "Zeta", p: "Capacitación", r: ["sur", "Sur"], i: null, quitar: 1 },
    { k: "f", f: "28/03/24", c: "Delta", p: "Consultoría", r: "Norte", i: "120,300", m: "35%" },
    { k: "g", f: "09/05/24", c: "Acme", p: "Diagnóstico", r: "Centro", i: "42,300", m: "22%" },
    { k: "h", f: "17/02/24", c: "Orbe", p: "Licencias Pro", r: ["NORTE", "Norte"], i: "95,200", m: "39%" },
  ];
  const PASOS = ["Origen", "Se quitaron nulos", "Texto capitalizado", "Tipo cambiado", "Columna Margen agregada", "Filas filtradas (2024)"];
  const CODIGO_M = [
    '= Csv.Document(File.Contents("Ventas.csv"))',
    "= Table.SelectRows(Origen, each [Producto] <> null and [Importe] <> null)",
    '= Table.TransformColumns(Filas, {{"Región", Text.Proper}})',
    '= Table.TransformColumnTypes(Texto, {{"Importe", type number}})',
    '= Table.AddColumn(Tipo, "Margen", each [Utilidad] / [Importe])',
    "= Table.SelectRows(Margen, each Date.Year([Fecha]) = 2024)",
  ];

  const dual = (cls, a, b) => '<span class="dl ' + cls + '"><span class="d">' + a + '</span><span class="l">' + b + "</span></span>";
  const glifo = (t) => '<em class="g">' + t + "</em>";

  function msgBloque(n) {
    return '<div class="viaje-msg"><div class="formula-msg"><span class="formula-msg-fx">fx</span><span class="formula-msg-text">' + MSGS[n - 1] + '<span class="formula-msg-cursor"></span></span></div></div>';
  }

  function filaHtml(f) {
    const reg = Array.isArray(f.r) ? dual("rg", f.r[0], f.r[1]) : f.r;
    const imp = f.i == null ? '<span class="q-null">null</span>' : dual("im", f.i, "$" + f.i);
    const prod = f.p == null ? '<span class="q-null">null</span>' : f.p;
    return '<div class="q-row reveal' + (f.quitar ? " bi-quitar" : "") + '" data-k="' + f.k + '">' +
      '<span class="q-c">' + f.f + '</span><span class="q-c q-cli">' + f.c + '</span><span class="q-c">' + prod + '</span>' +
      '<span class="q-c">' + reg + '</span><span class="q-c q-r">' + imp + '</span>' +
      '<span class="q-c q-r q-mar reveal">' + (f.m || "") + "</span></div>";
  }

  function sceneQ() {
    const cabecera = '<div class="q-row q-head reveal" id="qHead">' +
      '<span class="q-c" id="qHFecha">' + glifo("31") + "Fecha<span class=\"q-filt reveal\">" + I.filtro + "</span></span>" +
      '<span class="q-c q-cli">' + glifo("ABC") + "Cliente</span>" +
      '<span class="q-c">' + glifo("ABC") + "Producto</span>" +
      '<span class="q-c">' + glifo("ABC") + "Región</span>" +
      '<span class="q-c q-r">' + '<em class="g dl ig"><span class="d">ABC</span><span class="l">1.2</span></em>' + "Importe</span>" +
      '<span class="q-c q-r q-mar-h reveal" id="qHMargen">' + glifo("ƒx") + "Margen</span></div>";
    const pasos = PASOS.map((p) => '<div class="q-step reveal"><i>' + I.check + "</i><span>" + p + "</span></div>").join("");
    const codigo = CODIGO_M.map((c) => '<span class="m">' + c + "</span>").join("");
    return '<div class="bi-escena" id="biQ">' + msgBloque(1) +
      '<div class="q-win bi-win reveal" id="qWin">' +
      '<div class="q-bar"><span class="q-dots"><i></i><i></i><i></i></span><b>Editor de Power Query</b><span class="q-sub">Ventas</span>' +
      '<div class="q-tabs"><span class="on">Inicio</span><span>Transformar</span><span>Agregar columna</span></div></div>' +
      '<div class="q-m"><span class="q-m-fx">fx</span>' + codigo + "</div>" +
      '<div class="q-body"><div class="q-table">' + cabecera + FILAS.map(filaHtml).join("") + "</div>" +
      '<aside class="q-steps"><div class="q-steps-h">Pasos aplicados</div>' + pasos + "</aside></div></div></div>";
  }

  function nodo(id, nombre, color, campos, l, t, w, h, fact) {
    const li = campos.map((c) => "<li>" + (c.k ? '<span class="ik">' + I.llave + "</span>" : '<span class="ik"></span>') + "<span>" + c.n + "</span>" + (c.s ? "<em>Σ</em>" : "") + "</li>").join("");
    return '<div class="m-node' + (fact ? " fact" : "") + '" id="' + id + '" style="--tc:' + color + ";left:" + l + "px;top:" + t + "px;width:" + w + "px;height:" + h + 'px">' +
      '<div class="m-node-h"><span class="ik">' + I.tabla + "</span>" + nombre + "</div><ul class=\"m-fields\">" + li + "</ul>" +
      (fact ? "" : '<span class="m-rel">1 → * Ventas</span>') + "</div>";
  }

  function sceneM() {
    const ch = (l, t, txt) => '<span class="m-chip reveal" style="left:' + l + "px;top:" + t + 'px">' + txt + "</span>";
    return '<div class="bi-escena" id="biM">' + msgBloque(2) +
      '<div class="m-board" id="mBoard">' +
      '<div class="m-cap reveal" id="mCap"><b>Esquema en estrella</b><span>Los hechos al centro, las dimensiones alrededor.</span><span class="mono">1 = uno · * = muchos</span></div>' +
      '<i class="m-line" id="mlT" style="left:499px;top:124px;width:2px;height:64px"></i>' +
      '<i class="m-line" id="mlL" style="left:200px;top:279px;width:190px;height:2px"></i>' +
      '<i class="m-line" id="mlR" style="left:610px;top:279px;width:190px;height:2px"></i>' +
      '<i class="m-line" id="mlB" style="left:499px;top:372px;width:2px;height:64px"></i>' +
      ch(506, 128, "1") + ch(506, 164, "*") + ch(204, 253, "1") + ch(362, 253, "*") + ch(612, 253, "*") + ch(774, 253, "1") + ch(506, 376, "*") + ch(506, 412, "1") +
      nodo("nCal", "Calendario", "#14b8a6", [{ n: "Fecha", k: 1 }, { n: "Año" }, { n: "Mes" }, { n: "Trimestre" }], 400, 0, 200, 124) +
      nodo("nProd", "Producto", "#6b9fff", [{ n: "Producto", k: 1 }, { n: "Categoría" }, { n: "Línea" }, { n: "Marca" }], 0, 218, 200, 124) +
      nodo("nReg", "Región", "#a78bfa", [{ n: "Región", k: 1 }, { n: "Zona" }, { n: "País" }, { n: "Gerente" }], 800, 218, 200, 124) +
      nodo("nCli", "Cliente", "#38bdf8", [{ n: "Cliente", k: 1 }, { n: "Segmento" }, { n: "Ciudad" }, { n: "Sector" }], 400, 436, 200, 124) +
      nodo("nFact", "Ventas", "#f2c94c", [{ n: "Fecha", k: 1 }, { n: "Cliente", k: 1 }, { n: "Producto", k: 1 }, { n: "Región", k: 1 }, { n: "Importe", s: 1 }, { n: "Margen", s: 1 }], 390, 188, 220, 184, true) +
      "</div></div>";
  }

  function sceneD() {
    const tabs = [["Ventas", "#f2c94c"], ["Calendario", "#14b8a6"], ["Producto", "#6b9fff"], ["Región", "#a78bfa"], ["Cliente", "#38bdf8"]]
      .map((t) => '<li class="t" style="--tc:' + t[1] + '"><span class="ch">' + I.chev + '</span><span class="ik">' + I.tabla + "</span>" + t[0] + "</li>").join("");
    const code = (txt) => txt;
    const fn = (s) => '<i class="fn">' + s + "</i>", ref = (s) => '<i class="ref">' + s + "</i>", kw = (s) => '<i class="kw">' + s + "</i>";
    const tarjeta = (id, lb, a, b, sa, sb) => '<div class="d-card reveal" id="' + id + '"><span class="lb">' + lb + '</span><span class="v xf"><b class="a">' + a + '</b><b class="b">' + b + '</b></span><span class="s">' + sa + "</span></div>";
    return '<div class="bi-escena" id="biD">' + msgBloque(3) +
      '<div class="d-wrap" id="dWrap">' +
      '<aside class="d-fields reveal" id="dFields"><div class="d-fields-h">Campos</div><div class="d-search">Buscar</div><ul class="d-tree">' + tabs +
      '<li class="t open med"><span class="ch down">' + I.chev + '</span><span class="ik">' + I.calc + "</span>Medidas</li>" +
      '<li class="m reveal" id="dm1">Ventas</li><li class="m reveal" id="dm2">Ventas YTD</li><li class="m reveal" id="dm3">Crecimiento %</li></ul></aside>' +
      '<div class="d-main">' +
      '<div class="d-editor reveal" id="dEditor"><div class="d-edtab"><span class="on">' + I.calc + 'Nueva medida</span><span class="dax">DAX</span></div><div class="d-code">' +
      '<div class="cb"><span class="cl" id="dc1">' + code("Ventas = " + fn("SUM") + "( " + ref("Ventas[Importe]") + " )") + "</span></div>" +
      '<div class="cb"><span class="cl" id="dc2">' + code("Ventas YTD = " + fn("CALCULATE") + "( " + ref("[Ventas]") + ", " + fn("DATESYTD") + "( " + ref("Calendario[Fecha]") + " ) )") + "</span></div>" +
      '<div class="cb"><span class="cl" id="dc3a">Crecimiento % =</span>' +
      '<span class="cl" id="dc3b">  ' + kw("VAR") + " AA = " + fn("CALCULATE") + "( " + ref("[Ventas]") + ", " + fn("SAMEPERIODLASTYEAR") + "( " + ref("Calendario[Fecha]") + " ) )</span>" +
      '<span class="cl" id="dc3c">  ' + kw("RETURN") + " " + fn("DIVIDE") + "( " + ref("[Ventas]") + " - AA, AA )</span></div>" +
      "</div></div>" +
      '<div class="d-ctl reveal" id="dCtl"><span class="lb">Región</span><span class="pills" id="dPills"><span class="p on" data-p="t">Todas</span><span class="p" data-p="n">Norte</span><span class="p">Centro</span><span class="p">Sur</span></span>' +
      '<span class="d-ctx reveal" id="dCtx"><b>ƒ</b> Contexto de filtro: Región = Norte</span></div>' +
      '<div class="d-cards">' +
      tarjeta("dCard1", "Ventas", "$2.40M", "$1.05M", "Suma de Importe") +
      tarjeta("dCard2", "Ventas YTD", "$1.62M", "$0.71M", "Acumulado del año") +
      tarjeta("dCard3", "Crecimiento %", "▲ 18%", "▲ 24%", "vs. año anterior") +
      "</div></div>" + I.cursor.replace('class="', 'id="curD" class="') + '<div class="click-ripple" id="ripD"></div></div></div>';
  }

  // ---- datos del tablero (dos estados: Todas / Norte) ----
  const MESES = [["Ene", 62, 27, 0, 0], ["Feb", 70, 31, 0, 0], ["Mar", 84, 37, 1, 1], ["Abr", 58, 26, 0, 0], ["May", 76, 33, 1, 0], ["Jun", 90, 40, 1, 1]]; // mes, alto Todas, alto Norte, ok Todas, ok Norte
  const PRODS = [["Licencias", 38, 52, "#f2c94c"], ["Consultoría", 24, 22, "#6b9fff"], ["Soporte", 20, 12, "#14b8a6"], ["Capacitación", 11, 8, "#a78bfa"], ["Diagnóstico", 7, 6, "#64748b"]];
  const MATRIZ = [
    ["Norte", 100, "$1.05M", "✓", "38%", "ok", [14, 11, 12, 7, 5, 2]],
    ["Centro", 59, "$0.62M", "●", "33%", "mid", [12, 13, 9, 10, 6, 5]],
    ["Sur", 41, "$0.43M", "▼", "27%", "bad", [6, 8, 7, 11, 12, 14]],
    ["Noreste", 29, "$0.30M", "●", "35%", "mid", [10, 9, 11, 8, 9, 7]],
  ];

  function sceneR() {
    const xf = (a, b, cls) => '<span class="xf ' + (cls || "") + '"><b class="a">' + a + '</b><b class="b">' + b + "</b></span>";
    const kpi = (id, lb, a, b, sa, sb, ca, cb) => '<div class="r-kpi reveal" id="' + id + '"><span class="lb">' + lb + '</span><span class="v xf"><b class="a">' + a + '</b><b class="b">' + b + '</b></span><span class="st xf"><b class="a ' + ca + '">' + sa + '</b><b class="b ' + cb + '">' + sb + "</b></span></div>";
    const barras = MESES.map((m) => {
      const tip = m[0] === "Mar" ? '<div class="r-tip reveal no-final" id="rTip"><b>Mar 2024</b><span>Ventas <strong>$412k</strong></span><span class="ok">▲ +6% vs. meta</span></div>' : "";
      return '<div class="r-bar"><div class="r-bar-plot"><u class="r-meta" data-a="72" data-n="36"></u><i class="fill" data-ha="' + m[1] + '" data-hn="' + m[2] + '"><s class="sol" style="opacity:' + m[3] + '" data-n="' + m[4] + '"></s><s class="hat" style="opacity:' + (1 - m[3]) + '" data-n="' + (1 - m[4]) + '"></s>' +
        '<span class="mk reveal xf"><b class="a ' + (m[3] ? "ok" : "warn") + '">' + (m[3] ? "▲" : "▼") + '</b><b class="b ' + (m[4] ? "ok" : "warn") + '">' + (m[4] ? "▲" : "▼") + "</b></span>" + tip + '</i></div><span class="r-bar-tag">' + m[0] + "</span></div>";
    }).join("");
    const donut = PRODS.map((p, i) => '<circle class="seg" cx="21" cy="21" r="15.9155" fill="none" stroke="' + p[3] + '" stroke-width="5" data-pa="' + p[1] + '" data-pn="' + p[2] + '" data-i="' + i + '" stroke-dasharray="0 100"/>').join("");
    const leyenda = PRODS.map((p) => '<li class="reveal"><i style="background-color:' + p[3] + '"></i><span>' + p[0] + "</span>" + xf(p[1] + "%", p[2] + "%", "pc") + "</li>").join("");
    const filas = MATRIZ.map((m, i) => {
      const pts = m[6].map((y, j) => j * 12 + "," + y).join(" ");
      return '<div class="r-mrow reveal" data-r="' + m[0] + '"><span class="n">' + m[0] + '</span><span class="vb"><i class="r-db" data-w="' + m[1] + '"></i><b>' + m[2] + '</b></span><span class="mg ' + m[5] + '">' + m[3] + " " + m[4] + '</span><svg class="spark" viewBox="0 -2 60 20"><polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg></div>';
    }).join("");
    const nl = (a, b) => '<p class="r-nl xf">' + '<span class="a">' + a + '</span><span class="b">' + b + "</span></p>";
    return '<div class="bi-escena" id="biR">' + msgBloque(4) +
      '<div class="r-dash" id="rDash"><div class="r-main">' +
      '<div class="r-kpis">' +
      kpi("rK1", "Ventas", "$2.40M", "$1.05M", "▲ +12% vs. meta", "▲ +9% vs. meta", "ok", "ok") +
      kpi("rK2", "Ventas YTD", "$1.62M", "$0.71M", "● 94% de la meta", "● 91% de la meta", "warn", "warn") +
      kpi("rK3", "Crecimiento %", "▲ 18%", "▲ 24%", "▲ sobre la meta (10%)", "▲ sobre la meta (10%)", "ok", "ok") +
      kpi("rK4", "Margen %", "34%", "38%", "▼ bajo la meta (36%)", "✓ en meta (36%)", "bad", "ok") +
      "</div>" +
      '<div class="r-mid"><div class="r-panel reveal" id="rPBars"><div class="r-ph">' + I.informe + 'Ventas por mes<span class="r-leg"><u></u> Meta · ▲ en meta · ▼ bajo la meta</span></div><div class="r-bars">' + barras + "</div></div>" +
      '<div class="r-panel reveal" id="rPDona"><div class="r-ph">' + I.tabla + 'Ventas por producto</div><div class="r-dona"><div class="r-donut"><svg viewBox="0 0 42 42">' + donut + '</svg><div class="r-dtot reveal">' + xf("$2.40M", "$1.05M") + '<span>Ventas</span></div></div><ul>' + leyenda + "</ul></div></div></div>" +
      '<div class="r-bot"><div class="r-panel reveal" id="rPMat"><div class="r-ph">' + I.datos + 'Ventas por región<span class="r-leg">✓ en meta · ● cerca · ▼ bajo</span></div><div class="r-mhead"><span>Región</span><span>Ventas</span><span>Margen %</span><span>Tendencia</span></div>' + filas +
      '<div class="r-mrow tot reveal"><span class="n">Total</span><span class="vb"><b>$2.40M</b></span><span class="mg bad">▼ 34%</span><span></span></div></div>' +
      '<div class="r-panel r-nar reveal" id="rPNar"><div class="r-ph">' + I.brillo + 'Resumen automático</div>' +
      nl("Las ventas crecieron <b>18%</b> frente al año anterior.", "El Norte creció <b>24%</b> frente al año anterior.") +
      nl("El <b>Norte</b> concentra 44% de los ingresos.", "El <b>Norte</b> es el 44% de los ingresos.") +
      nl("Capacitación en el Sur está <b>bajo la meta</b>: requiere atención.", "Todos los productos del Norte están <b>en meta</b>.") + "</div></div></div>" +
      '<aside class="r-filt reveal" id="rFilt"><div class="r-filt-h">' + I.embudo + 'Filtros<span>Esta página</span></div>' +
      '<div class="r-fs"><span class="lb">Año</span><div class="r-chips"><span class="r-chip on">2024</span><span class="r-chip">2023</span></div></div>' +
      '<div class="r-fs"><span class="lb">Región</span><div class="r-chips" id="rReg"><span class="r-chip" data-r="Norte">Norte</span><span class="r-chip">Centro</span><span class="r-chip">Sur</span><span class="r-chip">Noreste</span></div></div>' +
      '<div class="r-fs"><span class="lb">Producto</span><div class="r-sel">Todos<span>▾</span></div></div>' +
      '<div class="r-fs"><span class="lb">Fechas</span><div class="r-range"><i></i><u></u><u></u></div><div class="r-rt"><span>Ene</span><span>Jun</span></div></div>' +
      '<div class="r-fstat reveal" id="rFstat">Filtro aplicado:<br><b>Región = Norte</b></div></aside>' +
      I.cursor.replace('class="', 'id="curR" class="') + '<div class="click-ripple" id="ripR"></div></div></div>';
  }

  function heroHtml() {
    return '<section class="viaje-hero" id="biHero"><span class="viaje-hero-eyebrow">Curso de Power BI</span>' +
      '<h1 class="viaje-hero-title">Aprende Power BI como un <span class="accent">Máster<span class="selector-box"><span class="selector-label">Visual</span></span></span>.</h1>' +
      '<div class="viaje-hero-chips"><span class="scope-chip">Desktop y Service</span><span class="scope-chip">Español e Inglés</span><span class="scope-chip">Modelado y DAX</span></div>' +
      '<div class="viaje-hero-actions"><a href="#biQ" class="viaje-btn ghost" data-viaje-next>Baja para conocer el programa' + I.flecha + '</a><a href="#programas" class="viaje-btn solid">Ver programas' + I.flecha + "</a></div></section>";
  }

  function shellHtml() {
    const tabs = [["Transformar", 1], ["Modelar", 2], ["Medir", 3], ["Visualizar", 4]].map((t) => '<button type="button" class="bi-tab" data-scene="' + t[1] + '"><b>' + t[1] + "</b>" + t[0] + "</button>").join("");
    const rail = [["datos", "Datos", 1], ["modelo", "Modelo", 2], ["informe", "Informe", 4]].map((r) => '<button type="button" class="bi-rv" data-v="' + r[0] + '" data-scene="' + r[2] + '" aria-label="' + r[1] + '">' + I[r[0]] + "<span>" + r[1] + "</span></button>").join("");
    const msgs = MSGS.map((m, i) => '<span class="bi-txt" id="biMsg' + (i + 1) + '">' + m + '<span class="formula-msg-cursor"></span></span>').join("");
    return '<div class="bi-shell" id="biShell">' +
      '<div class="bi-top"><div class="bi-file"><span class="bi-file-ico">' + I.pbi + '</span><span class="bi-file-n">Ventas.pbix</span><b id="biVista">' + VISTAS[0] + "</b></div>" +
      '<div class="bi-fx"><span class="bi-fx-ico">fx</span><div class="bi-fx-stack">' + msgs + "</div></div>" +
      '<a href="#programas" class="bi-ver">Ver programas' + I.flecha + "</a></div>" +
      '<div class="bi-rail">' + rail + "</div>" +
      '<div class="bi-steps" id="biRail">' + tabs + '<span class="bi-status mono" id="biEstado">' + ESTADOS[0] + "</span></div></div>";
  }

  // ---- utilidades de layout (en coordenadas del lienzo, ignoran transforms) ----
  function rel(el, wrap) {
    let x = 0, y = 0, n = el;
    while (n && n !== wrap) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }
  const cen = (el, wrap) => { const r = rel(el, wrap); return [r.x + r.w / 2, r.y + r.h / 2]; };

  function ctx(root, desk) {
    const $ = (s) => root.querySelector(s);
    const qa = (s) => Array.prototype.slice.call(root.querySelectorAll(s));
    return { $: $, qa: qa, desk: desk, msg: (i) => $("#biMsg" + i) };
  }
  const tipea = (tl, el, t, d) => tl.to(el, { clipPath: "inset(0 0% 0 0)", duration: d, ease: "none" }, t);

  // =====================  ESCENA 1 · TRANSFORMAR  =====================
  function escQ(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x;
    const rows = qa("#qWin .q-row"), steps = qa("#qWin .q-step"), codes = qa("#qWin .q-m .m");
    const rowOf = (k) => $('#qWin .q-row[data-k="' + k + '"]');
    const keys = FILAS.map((f) => f.k);
    // desplaza hacia arriba las filas que quedan debajo de las ya quitadas
    const subir = (quitadas, t, d) => keys.forEach((k, i) => {
      if (quitadas.indexOf(k) >= 0) return;
      const n = keys.slice(0, i).filter((x) => quitadas.indexOf(x) >= 0).length;
      if (n) tl.to(rowOf(k), { y: -n * RH, duration: d }, t);
    });

    tl.fromTo($("#qWin"), { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 6 }, at(0));
    tipea(tl, R.msg(1), at(2), 10);
    tl.to(rows, { opacity: 1, duration: 3, stagger: 1.1 }, at(6));

    const T = [14, 22, 40, 52, 62, 78];
    steps.forEach((s, i) => {
      tl.fromTo(s, { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 3 }, at(T[i]));
      tl.fromTo(s, { backgroundColor: HL0 }, { backgroundColor: HL, duration: 3 }, at(T[i]));
      if (i) {
        tl.to(steps[i - 1], { backgroundColor: HL0, duration: 3 }, at(T[i]));
        tl.to(codes[i - 1], { opacity: 0, duration: 2 }, at(T[i]));
      }
      tl.to(codes[i], { opacity: 1, duration: 3 }, at(T[i] + (i ? 1 : 0)));
    });

    // sale una fila: en escritorio se desvanece y las de abajo suben (translate); en móvil el flujo vertical colapsa su alto
    const sacar = (ks, t, tAbajo) => {
      if (R.desk) { tl.to(ks.map(rowOf), { opacity: 0, duration: 4 }, t); subir(ks.concat(sacar.hechas), tAbajo, 6); }
      else tl.to(ks.map(rowOf), { opacity: 0, height: 0, duration: 6 }, t);
      sacar.hechas = sacar.hechas.concat(ks);
    };
    sacar.hechas = [];
    // 2 · nulos: se marcan y salen
    tl.to([rowOf("c"), rowOf("e")], { backgroundColor: "rgba(220,38,38,.2)", duration: 3 }, at(24));
    sacar(["c", "e"], at(29), at(31));
    // 3 · texto capitalizado
    tl.to(qa("#qWin .rg .d"), { opacity: 0, duration: 4, stagger: 0.8 }, at(41));
    tl.to(qa("#qWin .rg .l"), { opacity: 1, duration: 4, stagger: 0.8 }, at(41));
    // 4 · tipo de Importe
    tl.to(qa("#qWin .im .d, #qWin .ig .d"), { opacity: 0, duration: 4 }, at(53));
    tl.to(qa("#qWin .im .l, #qWin .ig .l"), { opacity: 1, duration: 4 }, at(53));
    // 5 · columna calculada
    tl.to($("#qHMargen"), { opacity: 1, duration: 3 }, at(63));
    tl.fromTo($("#qHMargen"), { backgroundColor: HL0 }, { backgroundColor: "rgba(" + Y + ",.24)", duration: 3 }, at(63));
    tl.to(qa("#qWin .q-mar"), { opacity: 1, duration: 3, stagger: 1.4 }, at(66));
    // 6 · filtro de año
    tl.to($("#qWin .q-filt"), { opacity: 1, duration: 3 }, at(79));
    tl.fromTo($("#qHFecha"), { backgroundColor: HL0 }, { backgroundColor: "rgba(" + Y + ",.22)", duration: 3 }, at(79));
    tl.to(rowOf("d"), { backgroundColor: "rgba(" + Y + ",.16)", duration: 2 }, at(82));
    sacar(["d"], at(85), at(87));
  }

  // =====================  ESCENA 2 · MODELAR  =====================
  function escM(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x;
    if (!R.desk) tl.fromTo($("#nFact"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 6 }, at(0));
    tipea(tl, R.msg(2), at(4), 10);
    const dims = ["#nCal", "#nProd", "#nReg", "#nCli"], desde = [{ y: 46 }, { x: 46 }, { x: -46 }, { y: -46 }];
    dims.forEach((id, i) => tl.fromTo($(id), Object.assign({ opacity: 0, scale: 0.85 }, desde[i]), { opacity: 1, scale: 1, x: 0, y: 0, duration: 6 }, at(10 + i * 4)));
    [["#mlT", "scaleY", "50% 0%"], ["#mlL", "scaleX", "0% 50%"], ["#mlR", "scaleX", "100% 50%"], ["#mlB", "scaleY", "50% 100%"]].forEach((l, i) => {
      const a = { transformOrigin: l[2] }, z = { duration: 5, ease: "none" };
      a[l[1]] = 0; z[l[1]] = 1;
      tl.fromTo($(l[0]), a, z, at(26 + i * 4));
    });
    tl.to(qa("#mBoard .m-chip"), { opacity: 1, duration: 3, stagger: 1.4 }, at(34));
    tl.to($("#mCap"), { opacity: 1, duration: 5 }, at(48));
  }

  // =====================  ESCENA 3 · MEDIR (DAX)  =====================
  const NEUTRO = { backgroundColor: "rgba(" + Y + ",0)", borderColor: "#2a3342", color: "#a4acb9" };
  const ACTIVO = { backgroundColor: "rgba(" + Y + ",.16)", borderColor: "#f2c94c", color: "#f6d97a" };

  function escD(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, wrap = $("#dWrap");
    if (!R.desk) tl.fromTo($("#dFields"), { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 8 }, at(0));
    tipea(tl, R.msg(3), at(6), 10);
    tl.to($("#dEditor"), { opacity: 1, duration: 5 }, at(4));
    const tarjeta = (n, t) => { tl.fromTo($("#dCard" + n), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 4 }, t); tl.to($("#dm" + n), { opacity: 1, duration: 3 }, t); };
    tipea(tl, $("#dc1"), at(10), 6); tarjeta(1, at(17));
    tipea(tl, $("#dc2"), at(20), 10); tarjeta(2, at(31));
    tipea(tl, $("#dc3a"), at(34), 4); tipea(tl, $("#dc3b"), at(38), 10); tipea(tl, $("#dc3c"), at(48), 6); tarjeta(3, at(55));
    tl.to($("#dCtl"), { opacity: 1, duration: 4 }, at(58));

    // el cursor elige Norte y las MISMAS medidas cambian (contexto de filtro); luego vuelve a Todas
    const cur = $("#curD"), rip = $("#ripD"), pT = $('#dPills [data-p="t"]'), pN = $('#dPills [data-p="n"]');
    const px = (el) => () => cen(el, wrap)[0] - 4, py = (el) => () => cen(el, wrap)[1] - 2;
    const clic = (el, t) => tl.fromTo(rip, { x: () => cen(el, wrap)[0] - 13, y: () => cen(el, wrap)[1] - 13, scale: 0, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 4, immediateRender: false }, t);
    tl.fromTo(cur, { opacity: 0, x: () => cen($("#dEditor"), wrap)[0] + 150, y: () => cen($("#dEditor"), wrap)[1] + 50 }, { opacity: 1, duration: 3, immediateRender: false }, at(60));
    tl.to(cur, { x: px(pN), y: py(pN), duration: 8 }, at(62));
    clic(pN, at(70));
    tl.to(pT, NEUTRO, at(71)); tl.to(pN, ACTIVO, at(71));
    tl.to(qa(".d-card .a"), { opacity: 0, duration: 4, stagger: 0.8 }, at(73));
    tl.to(qa(".d-card .b"), { opacity: 1, duration: 4, stagger: 0.8 }, at(73));
    tl.to($("#dCtx"), { opacity: 1, duration: 4 }, at(76));
    tl.to(cur, { x: px(pT), y: py(pT), duration: 8 }, at(84));
    clic(pT, at(92));
    tl.to(pN, NEUTRO, at(93)); tl.to(pT, ACTIVO, at(93));
    tl.to(qa(".d-card .b"), { opacity: 0, duration: 4, stagger: 0.8 }, at(94));
    tl.to(qa(".d-card .a"), { opacity: 1, duration: 4, stagger: 0.8 }, at(94));
    tl.to($("#dCtx"), { opacity: 0, duration: 3 }, at(94));
    if (!R.desk) tl.to(cur, { opacity: 0, duration: 2 }, at(100));
  }

  // =====================  ESCENA 4 · VISUALIZAR  =====================
  // partes sueltas para poder dispararlas por separado en móvil (cada panel entra cuando llega a pantalla)
  const R_PARTES = {
    kpis(tl, b, R) {
      const { $ } = R;
      if (!R.desk) tl.to(["#rK1", "#rK2", "#rK3"].map((s) => $(s)), { opacity: 1, duration: 4, stagger: 1.5 }, b);
      tl.to($("#rK4"), { opacity: 1, duration: 4 }, b + 4);
    },
    barras(tl, b, R) {
      const { $, qa } = R;
      tl.to($("#rPBars"), { opacity: 1, duration: 5 }, b);
      tl.to(qa("#rPBars .fill"), { height: (i, el) => el.dataset.ha + "%", duration: 8, stagger: 2 }, b + 3);
      tl.to(qa("#rPBars .r-meta"), { opacity: 1, duration: 4 }, b + 2);
      tl.to(qa("#rPBars .mk"), { opacity: 1, duration: 3, stagger: 2 }, b + 14);
    },
    dona(tl, b, R) {
      const { $, qa } = R;
      tl.to($("#rPDona"), { opacity: 1, duration: 5 }, b);
      let acum = 0;
      qa("#rPDona .seg").forEach((c, i) => {
        const p = +c.dataset.pa, off = -acum; acum += p;
        c.setAttribute("stroke-dashoffset", off);
        tl.to(c, { attr: { "stroke-dasharray": p + " " + (100 - p) }, duration: 6, ease: "power1.out" }, b + 5 + i * 3);
      });
      tl.to(qa("#rPDona .r-dtot, #rPDona li"), { opacity: 1, duration: 3, stagger: 1.5 }, b + 8);
    },
    matriz(tl, b, R) {
      const { $, qa } = R;
      tl.to($("#rPMat"), { opacity: 1, duration: 5 }, b);
      tl.to(qa("#rPMat .r-mrow"), { opacity: 1, duration: 3, stagger: 2 }, b + 3);
      tl.to(qa("#rPMat .r-db"), { width: (i, el) => el.dataset.w + "%", duration: 8, stagger: 2 }, b + 6);
      tl.to(qa("#rPMat .spark polyline"), { attr: { "stroke-dashoffset": 0 }, duration: 8, stagger: 2 }, b + 10);
    },
    narrativa(tl, b, R) {
      const { $, qa } = R;
      tl.to($("#rPNar"), { opacity: 1, duration: 5 }, b);
      qa("#rPNar .r-nl").forEach((p, i) => tipea(tl, p, b + 5 + i * 9, 8));
    },
    filtros(tl, b, R) { tl.fromTo(R.$("#rFilt"), { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 6 }, b); },
    // tooltip y cambio de contexto: solo escritorio
    interaccion(tl, b, R) {
      const { $, qa } = R, wrap = $("#rDash"), cur = $("#curR"), rip = $("#ripR");
      const barra = $("#rPBars .r-bar:nth-child(3) .r-bar-plot"), chip = $('#rReg [data-r="Norte"]');
      const aBarra = () => { const r = rel(barra, wrap); return [r.x + r.w / 2, r.y + r.h * 0.2]; };
      tl.fromTo(cur, { opacity: 0, x: () => cen($("#rPNar"), wrap)[0], y: () => cen($("#rPNar"), wrap)[1] }, { opacity: 1, duration: 3, immediateRender: false }, b);
      tl.to(cur, { x: () => aBarra()[0] - 4, y: () => aBarra()[1] - 2, duration: 8 }, b + 1);
      tl.to($("#rTip"), { opacity: 1, duration: 3 }, b + 9);
      tl.to($("#rTip"), { opacity: 0, duration: 3 }, b + 19);
      tl.to(cur, { x: () => cen(chip, wrap)[0] - 4, y: () => cen(chip, wrap)[1] - 2, duration: 9 }, b + 20);
      tl.fromTo(rip, { x: () => cen(chip, wrap)[0] - 13, y: () => cen(chip, wrap)[1] - 13, scale: 0, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 4, immediateRender: false }, b + 29);
      // el filtro se aplica a TODO el informe
      const u = b + 31;
      tl.to(chip, ACTIVO, u);
      tl.to(qa("#rReg .r-chip:not([data-r])"), { opacity: 0.45, duration: 3 }, u);
      tl.to($("#rFstat"), { opacity: 1, duration: 4 }, u + 2);
      tl.to(qa("#rDash .xf .a"), { opacity: 0, duration: 5 }, u);
      tl.to(qa("#rDash .xf .b"), { opacity: 1, duration: 5 }, u);
      tl.to(qa("#rPBars .fill"), { height: (i, el) => el.dataset.hn + "%", duration: 9, stagger: 1 }, u);
      tl.to(qa("#rPBars .r-meta"), { bottom: "36%", duration: 9 }, u);
      qa("#rPBars s").forEach((s) => tl.to(s, { opacity: +s.dataset.n, duration: 4 }, u + 3));
      PRODS.forEach((p, i) => {
        const acumN = PRODS.slice(0, i).reduce((s, x) => s + x[2], 0);
        tl.to(qa("#rPDona .seg")[i], { attr: { "stroke-dasharray": p[2] + " " + (100 - p[2]), "stroke-dashoffset": -acumN }, duration: 9 }, u);
      });
      tl.to(qa('#rPMat .r-mrow:not([data-r="Norte"])'), { opacity: 0.35, duration: 6 }, u + 3);
      tl.to($('#rPMat .r-mrow[data-r="Norte"]'), { backgroundColor: "rgba(" + Y + ",.12)", duration: 6 }, u + 3);
      tl.to(cur, { opacity: 0, duration: 4 }, u + 14);
    },
  };

  function escR(tl, b, R) {
    const { $ } = R, at = (x) => b + x;
    tipea(tl, R.msg(4), at(2), 10);
    R_PARTES.kpis(tl, at(0), R);
    R_PARTES.filtros(tl, at(4), R);
    R_PARTES.barras(tl, at(8), R);
    R_PARTES.dona(tl, at(14), R);
    R_PARTES.matriz(tl, at(26), R);
    R_PARTES.narrativa(tl, at(44), R);
    R_PARTES.interaccion(tl, at(84), R);
  }

  // un objeto se vuelve otro: el contenido de "desde" se apaga, un marco fantasma viaja de su caja a la de "hacia"
  // (anima left/top/width/height reales: el texto nunca se deforma) y el contenido de "hacia" se enciende al llegar.
  // Coordenadas del lienzo (offsetLeft/Top, sin transforms).
  // clonar=true: el marco lleva una copia del contenido de "desde" (recortada al encogerse) para que no viaje vacío.
  function morph(tl, desde, hacia, canvas, t, d, clonar) {
    const fantasma = document.createElement("div");
    fantasma.className = "bi-ghost";
    if (clonar) {
      const copia = desde.cloneNode(true);
      copia.removeAttribute("id"); copia.classList.remove("reveal"); copia.style.cssText = "position:absolute;left:0;top:0;margin:0;opacity:1;width:" + desde.offsetWidth + "px;height:" + desde.offsetHeight + "px";
      copia.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      fantasma.appendChild(copia);
    }
    canvas.appendChild(fantasma);
    const caja = (el) => () => { const r = rel(el, canvas); return { left: r.x, top: r.y, width: r.w, height: r.h }; };
    const a = caja(desde), c = caja(hacia);
    tl.fromTo(fantasma, { left: () => a().left, top: () => a().top, width: () => a().width, height: () => a().height, opacity: 0 },
      { opacity: 1, duration: 1.5, ease: "none" }, t);
    tl.to(desde, { opacity: 0, duration: 4, ease: "none" }, t);
    tl.to(fantasma, { left: () => c().left, top: () => c().top, width: () => c().width, height: () => c().height, duration: d - 5, ease: "power2.inOut" }, t + 2);
    tl.fromTo(hacia, { opacity: 0 }, { opacity: 1, duration: 4, ease: "none" }, t + d - 5);
    tl.to(fantasma, { opacity: 0, duration: 2, ease: "none" }, t + d - 2);
  }

  // =====================  CONTENIDO  =====================
  const PowerBI = {
    renderHtml() {
      return '<div class="viaje-root bi-root" id="viajeBI">' + shellHtml() + heroHtml() +
        '<section class="bi-pin" id="biPin"><div class="bi-canvas" id="biCanvas">' + sceneQ() + sceneM() + sceneD() + sceneR() + "</div></section></div>";
    },

    iniciar() {
      const root = document.getElementById("viajeBI");
      if (!root) return;
      const NAV = E.navOffset(root);
      document.documentElement.style.setProperty("--viaje-nav-h", NAV + "px");

      // "Ver programas" aterriza en el título (instantáneo: el scroll suave atraviesa todo el recorrido). Sin tocar el hash:
      // cursos.html lo usa para cambiar de herramienta.
      root.querySelectorAll('a[href="#programas"]').forEach((a) => a.addEventListener("click", (e) => {
        e.preventDefault();
        const t = document.getElementById("programas");
        if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - (NAV + 24), behavior: "instant" });
      }));
      const siguiente = root.querySelector("[data-viaje-next]");
      if (siguiente) siguiente.addEventListener("click", (e) => {
        e.preventDefault();
        if (!root.classList.contains("bi-flujo")) return;   // en escritorio lo maneja irA() (más abajo)
        const q = document.getElementById("biQ");
        if (q) window.scrollTo({ top: q.getBoundingClientRect().top + window.scrollY - (NAV + 8), behavior: "smooth" });
      });

      const { simple, telefono } = E.esSimpleMode();
      if (simple) { estadoFinal(root); return; }
      if (telefono) { root.classList.add("viaje-flujo", "bi-flujo", "viaje-movil"); flujo(root); ScrollTrigger.refresh(); window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true }); return; }

      gsap.registerPlugin(ScrollTrigger);
      const R = ctx(root, true), $ = R.$, qa = R.qa;
      const pin = $("#biPin"), canvas = $("#biCanvas");

      // ---- línea de tiempo maestra: cuatro actos y tres transiciones ----
      const m = gsap.timeline({ defaults: { ease: "power1.out" } });
      escQ(m, S.q, R);
      // Q → M: la ventana de Power Query se encoge hasta ser la tabla de hechos
      morph(m, $("#qWin"), $("#nFact"), canvas, TR.qm, 16);
      m.to(R.msg(1), { opacity: 0, duration: 6 }, TR.qm + 2);
      escM(m, S.m, R);
      // M → D: el modelo se recoge hacia el panel de campos
      m.to($("#mBoard"), { opacity: 0, scale: 0.7, x: -260, transformOrigin: "20% 50%", duration: 14 }, TR.md);
      m.to(R.msg(2), { opacity: 0, duration: 6 }, TR.md + 2);
      m.fromTo($("#dFields"), { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 14 }, TR.md + 2);
      escD(m, S.d, R);
      // D → R: las tres medidas se vuelven los KPI del tablero
      m.to(["#dFields", "#dEditor", "#dCtl", "#curD"].map((s) => $(s)), { opacity: 0, duration: 8 }, TR.dr);
      m.to(R.msg(3), { opacity: 0, duration: 6 }, TR.dr + 2);
      [1, 2, 3].forEach((n) => morph(m, $("#dCard" + n), $("#rK" + n), canvas, TR.dr, 16, true));
      m.to({}, { duration: 1 }, TOTAL - 1);   // la duración total es exactamente TOTAL
      escR(m, S.r, R);
      m.to({}, { duration: 1 }, TOTAL - 1);

      // ---- cáscara: pestañas/riel = actos; estado y vista cambian con la escena ----
      const tabs = qa(".bi-tab"), vistas = qa(".bi-rv");
      const vista = $("#biVista"), estado = $("#biEstado");
      let activa = -1;
      function setActive(n) {
        if (n === activa) return;
        activa = n;
        tabs.forEach((t) => t.classList.toggle("active", t.dataset.scene === String(n)));
        vistas.forEach((t) => t.classList.toggle("active", t.dataset.v === RIEL[n]));
        vista.textContent = VISTAS[n]; estado.textContent = ESTADOS[n];
      }
      setActive(0);

      const st = ScrollTrigger.create({
        trigger: pin, start: "top " + NAV + "px", end: "+=" + Math.round(TOTAL * 1.75) + "%", scrub: 1, pin: true, animation: m, invalidateOnRefresh: true,
        onUpdate: (self) => { const u = self.progress * TOTAL; setActive(u < UMBRAL[0] ? 1 : u < UMBRAL[1] ? 2 : u < UMBRAL[2] ? 3 : 4); },
      });
      ScrollTrigger.create({ trigger: $("#biHero"), start: "top center", end: "bottom center", onToggle: (s) => s.isActive && setActive(0) });

      // scroll a un punto de la línea de tiempo (el pin mueve el layout: el ancla nativa no sirve)
      function irA(u) { window.scrollTo({ top: st.start + (st.end - st.start) * (u / TOTAL), behavior: "smooth" }); }
      tabs.concat(vistas).forEach((t) => t.addEventListener("click", () => irA(IR_A[t.dataset.scene])));
      if (siguiente) siguiente.addEventListener("click", () => irA(8));

      // la cáscara aparece a los 30 px de scroll y dura hasta el final del pin
      document.body.classList.add("bi-on");
      ScrollTrigger.create({
        trigger: $("#biHero"), start: () => "top " + (NAV - 30) + "px", end: () => st.end,
        onToggle: (s) => document.body.classList.toggle("bi-hoja", s.isActive),
      });

      // el lienzo (1100×620) se escala completo al espacio libre entre cáscara y bordes
      function escalar() {
        const W = pin.clientWidth, H = pin.clientHeight;
        const rw = W - 56 - 12, rh = H - 48 - 36 - 8;
        const s = Math.max(0.4, Math.min(rw / 1100, rh / 620, 1.35));
        const x = 56 + (rw - 1100 * s) / 2, y = 48 + 4 + (rh - 620 * s) / 2;
        canvas.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + s.toFixed(4) + ")";
      }
      if (window._viajeResize) window.removeEventListener("resize", window._viajeResize);
      window._viajeResize = escalar;
      window.addEventListener("resize", escalar);
      escalar();

      ScrollTrigger.refresh();
      window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
    },
  };

  // TELÉFONO: sin pin ni lienzo fijo. Cada escena fluye en vertical y corre su animación UNA vez al entrar.
  function flujo(root) {
    gsap.registerPlugin(ScrollTrigger);
    const sh = root.querySelector(".bi-shell"); if (sh) sh.remove();
    root.querySelectorAll(".viaje-msg .formula-msg-text").forEach((el, i) => { el.id = "biMsg" + (i + 1); });
    const R = ctx(root, false), K = 12;
    const una = (trigger, start) => gsap.timeline({ defaults: { ease: "power1.out" }, scrollTrigger: { trigger: trigger, start: start || "top 72%", once: true } });
    [["#biQ", escQ], ["#biM", escM], ["#biD", escD]].forEach((e) => { const tl = una(e[0]); e[1](tl, 0, R); tl.timeScale(K); });
    // el tablero es largo: cada panel entra cuando llega a pantalla
    tipea(una("#biR", "top 70%"), R.msg(4), 0, 8).timeScale(K);
    [["#rK1", "kpis"], ["#rPBars", "barras"], ["#rPDona", "dona"], ["#rPMat", "matriz"], ["#rPNar", "narrativa"], ["#rFilt", "filtros"]].forEach((p) => {
      const tl = una(p[0], "top 85%"); R_PARTES[p[1]](tl, 0, R); tl.timeScale(K);
    });
  }

  // estado final (reduced-motion o GSAP caído): todo visible, escenas apiladas
  function estadoFinal(root) {
    root.classList.add("viaje-simple", "viaje-flujo", "bi-flujo", "bi-final");
    const sh = root.querySelector(".bi-shell"); if (sh) sh.remove();
    root.querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
    root.querySelectorAll(".formula-msg-text, .cl, .r-nl").forEach((el) => { el.style.clipPath = "inset(0 0% 0 0)"; });
    root.querySelectorAll(".fill").forEach((el) => { el.style.height = el.dataset.ha + "%"; });
    root.querySelectorAll(".r-db").forEach((el) => { el.style.width = el.dataset.w + "%"; });
    root.querySelectorAll(".r-meta").forEach((el) => { el.style.opacity = 1; });
    root.querySelectorAll(".spark polyline").forEach((el) => { el.setAttribute("stroke-dashoffset", 0); });
    root.querySelectorAll(".seg").forEach((el, i, all) => {
      const p = +el.dataset.pa; let acum = 0; for (let j = 0; j < i; j++) acum += +all[j].dataset.pa;
      el.setAttribute("stroke-dasharray", p + " " + (100 - p)); el.setAttribute("stroke-dashoffset", -acum);
    });
    root.querySelectorAll(".m-line").forEach((el) => { el.style.transform = "none"; });
  }

  window.ViajeEscenas.powerbi = PowerBI;
})();
