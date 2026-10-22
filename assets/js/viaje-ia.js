// assets/js/viaje-ia.js
// Viaje de IA Aplicada (scrollytelling GSAP) para cursos.html. Se registra en window.ViajeEscenas (ver viaje.js: expone el
// motor compartido ViajeEngine con rel/cen/tipea/morph). Mismo método que Power BI y Ofimática: cáscara fija + UN dato que
// viaja + un lienzo de 1100×620 con UN pin y UNA línea de tiempo maestra. Recorre los tres cursos de IA de Alfredo:
//   Pedir (la conferencia: un buen prompt) → Copilot en tus apps (Productividad con Copilot) → Proteger (privacidad de
//   datos) → Construir (Dashboards con Claude).
//
// Decisiones que NO hay que repetir si esto se toca:
//   - La cáscara es "la caja del prompt": todo empieza con un prompt, así que el prompt de cada escena se escribe en un
//     compositor fijo abajo (el mismo gesto en las 4 escenas). Arriba, el asistente activo y el sello "Revisado por ti n/4"
//     (pensamiento crítico: cada resultado se revisa antes de confiar; cada escena termina con su sello).
//   - El dato que viaja: el resumen del T3 (escena 1) se vuelve el informe de Copilot (2); la tabla de Excel se vuelve la
//     tabla que se protege (3); la estructura sin datos se vuelve lo que se le da a Claude (4). Cifras de Power BI y
//     Ofimática ($2.40M, 18%, 34%) a propósito.
//   - La escena 1 usa un "asistente" sin marca (no se vende un modelo); Copilot y Claude aparecen donde el curso los usa.
//     Sin Gemini a propósito (no se da).
//   - Móvil táctil: sin pin ni compositor; cada escena fluye en vertical y muestra su prompt arriba (.ia-pflow). Estático
//     (reduced-motion o GSAP caído): todo en su estado final (ia-final + estadoFinal()).
(function () {
  "use strict";
  const E = window.ViajeEngine;
  if (!E || !window.ViajeEscenas || !E.morph) return;
  const { rel, cen, tipea, morph } = E;

  // ---- constantes de la animación (unidades de la línea de tiempo maestra) ----
  const V = "167,139,250";                 // violeta IA (--c) en rgb, para tweens de color
  const S = { c: 0, a: 108, p: 216, k: 324 };          // inicio de cada escena
  const TR = { ca: 92, ap: 200, pk: 308 };             // inicio de cada transición
  const TOTAL = 430;
  const UMBRAL = [100, 208, 316];                      // unidades donde cambia la escena activa
  const IR_A = { 1: 88, 2: 196, 3: 304, 4: 422 };      // a dónde aterriza cada pestaña (todo ya dibujado)
  const SELLOS = [90, 198, 306, 410];                  // unidades donde cada escena pone su sello "Revisado por ti"

  const MSGS = [
    "Un buen prompt vale más que mil intentos.",
    "Tus apps ya traen un asistente: aprende a dirigirlo.",
    "Aprovecha la IA sin regalar tus datos.",
    "Construye tus propias herramientas, sin empezar de cero.",
  ];
  const PROMPTS = [
    "Como analista de ventas, resume el T3 para Dirección en 3 puntos con cifras.",
    "Con este resumen: redacta el informe, crea la presentación y analiza las ventas.",
    "Prepara solo la estructura de la tabla, sin nombres ni montos reales.",
    "Con esta estructura, crea un dashboard HTML con un botón para importar datos.",
  ];
  const ASIST = ["IA Aplicada", "Asistente de IA", "Copilot", "Filtro de privacidad", "Claude"];
  const TAGS = ["", "Asistente", "Copilot", "Copilot protegido", "Claude"];
  const ESTADOS = ["Pedir · Copilot · Proteger · Construir", "1 prompt · 1 resumen", "3 apps · 1 asistente", "5 columnas · datos protegidos", "1 dashboard · datos locales"];
  const RIEL = [null, "pedir", "apps", "proteger", "construir"];

  // ---- íconos de línea (propios) ----
  const svg = (d, w) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const I = {
    chispa: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>', 1.6),
    pedir: svg('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
    apps: svg('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>'),
    proteger: svg('<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>'),
    construir: svg('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'),
    flecha: svg('<path d="M12 5v14M5 12l7 7 7-7"/>', 2.2),
    enviar: svg('<path d="M12 19V5M5 12l7-7 7 7"/>', 2.4),
    check: svg('<path d="M5 13l4 4L19 7"/>', 3),
    candado: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 1.9),
    escudo: svg('<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/>', 1.7),
    carpeta: svg('<path d="M3 6h6l2 2h10v11H3z"/>'),
    archivo: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 16.5h7"/>'),
    word: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 15.5h7M9 19h4"/>'),
    ppt: svg('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M8 12l3-3 2 2 3-4"/>'),
    excel: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 14.5h18M9 4v16M15 4v16"/>'),
    chat: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
    cursor: '<svg class="cursor-ico reveal ia-cur no-final" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l15 7-6.2 1.6L11 17z"/></svg>',
  };

  function msgBloque(n) {
    return '<div class="viaje-msg"><div class="formula-msg"><span class="formula-msg-fx">fx</span><span class="formula-msg-text">' + MSGS[n - 1] + '<span class="formula-msg-cursor"></span></span></div></div>';
  }
  // el prompt de cada escena en móvil (en escritorio vive en el compositor fijo de la cáscara)
  function pflow(n) { return '<div class="ia-pflow"><span class="ia-tag">' + TAGS[n] + '</span><span class="ia-pt cl">' + PROMPTS[n - 1] + "</span></div>"; }

  // =====================  ESCENA 1 · PEDIR  =====================
  function sceneC() {
    const guia = [["1", "Rol", "quién eres"], ["2", "Tarea", "qué necesitas"], ["3", "Contexto", "para quién y para qué"], ["4", "Formato", "cómo lo quieres"]]
      .map((g) => '<div class="g reveal"><i>' + g[0] + "</i><b>" + g[1] + "</b><span>" + g[2] + "</span></div>").join("");
    return '<div class="bi-escena" id="iaC">' + msgBloque(1) + pflow(1) +
      '<div class="c-win ia-win reveal" id="cWin">' +
      '<div class="c-bar"><span class="ik">' + I.chispa + "</span><b>Asistente de IA</b><span class=\"c-new\">Nuevo chat</span></div>" +
      '<div class="c-body"><div class="c-thread">' +
      '<div class="c-u reveal" id="cU1"><span>Hazme un reporte de ventas</span></div>' +
      '<div class="c-a reveal" id="cA1"><span class="c-av">' + I.chispa + '</span><div><p>Claro. Un reporte de ventas es un documento que resume las ventas de una empresa durante un periodo, e incluye gráficas, tablas y conclusiones…</p><em class="c-tag">✕ Respuesta genérica: sin cifras ni formato</em></div></div>' +
      '<div class="c-u reveal" id="cU2"><span>Como <u>analista de ventas</u><sup>1</sup>, <u>resume el T3</u><sup>2</sup> <u>para Dirección</u><sup>3</sup> <u>en 3 puntos con cifras</u><sup>4</sup>.</span></div>' +
      '<div class="c-a reveal" id="cA2"><span class="c-av">' + I.chispa + '</span><div class="c-res" id="iResumen"><h5>Resumen del T3</h5><ul>' +
      '<li class="cl">Ventas de $2.40M, 18% arriba del año anterior.</li><li class="cl">El Norte concentra 44% de los ingresos.</li><li class="cl">Margen de 34%, 2 pts bajo la meta.</li></ul>' +
      '<span class="ia-stamp reveal" id="cStamp"><span class="ik">' + I.check + "</span>Revisado por ti</span></div></div>" +
      '</div><aside class="c-guide reveal" id="cGuide"><div class="g-h">Un buen prompt tiene 4 partes</div>' + guia + "</aside></div></div></div>";
  }

  // =====================  ESCENA 2 · COPILOT EN TUS APPS  =====================
  const TABLA = [
    ["Constructora Acme", "Licencias Pro", "Norte", "$182,400", "41%"],
    ["Grupo Delta SA", "Soporte Anual", "Centro", "$97,100", "28%"],
    ["Hospital San José", "Consultoría", "Norte", "$120,300", "35%"],
    ["Cadena Orbe", "Diagnóstico", "Centro", "$42,300", "22%"],
    ["Banco Nova", "Licencias Pro", "Norte", "$95,200", "39%"],
  ];
  const REGIONES = [["Norte", 100, "$1.05M"], ["Centro", 59, "$0.62M"], ["Sur", 41, "$0.43M"], ["Noreste", 29, "$0.30M"]];

  function sceneA() {
    const fila = (r, i) => '<div class="x-r x-d reveal"><span>' + (i + 2) + "</span>" + r.map((c) => "<span>" + c + "</span>").join("") + "</div>";
    const set = (n, user, ai, chips) => '<div class="a-set" id="aSet' + n + '"><div class="cp-u reveal"><b>Tú</b>' + user + '</div><div class="cp-a reveal"><span class="cp-av">' + I.chispa + "</span><div><p>" + ai + "</p>" + (chips || "") + "</div></div></div>";
    const th = [["1", "Informe del trimestre T3"], ["2", "Resumen"], ["3", "Resultados"], ["4", "Próximos pasos"]].map((t) => '<div class="t reveal"><em>' + t[0] + '</em><div class="m"><b>' + t[1] + "</b><i></i><i></i></div></div>").join("");
    const barras = REGIONES.map((r) => '<div class="x-b"><div class="x-bp"><i style="height:' + r[1] + '%"></i></div><b>' + r[2] + "</b><span>" + r[0] + "</span></div>").join("");
    return '<div class="bi-escena" id="iaA">' + msgBloque(2) + pflow(2) +
      '<div class="a-win ia-win reveal" id="aWin">' +
      '<div class="a-bar" id="aBar"><span class="a-ico">' + I.apps + '</span><span class="a-an"><b>Word</b><b>PowerPoint</b><b>Excel</b></span><span class="a-arch">Informe T3 · Guardado en OneDrive</span>' +
      '<div class="a-tabs"><span style="background-color:rgba(255,255,255,.26)">Word</span><span>PowerPoint</span><span>Excel</span></div></div>' +
      '<div class="a-body"><div class="a-canvas">' +
      // Word
      '<div class="a-l" id="aWord"><span class="a-lab">Word</span><div class="a-page"><span class="a-bor reveal" id="aBor">' + I.chispa + 'Borrador de Copilot</span>' +
      '<h3 class="cl" id="aTt">Informe del trimestre T3</h3>' +
      '<div class="a-sum reveal" id="aSum"><h4>Resumen</h4><ul><li>Ventas de $2.40M, 18% arriba del año anterior.</li><li>El Norte concentra 44% de los ingresos.</li><li>Margen de 34%, 2 pts bajo la meta.</li></ul></div>' +
      '<h4 class="cl" id="aH2">Resultados</h4><p class="cl" id="aP2">Licencias Pro lideró con 38% de las ventas. Consultoría y Soporte completan el 44% restante.</p>' +
      '<h4 class="cl" id="aH3">Próximos pasos</h4><p class="cl" id="aP3">Cerrar el margen contra la meta del 36%.</p><p class="cl" id="aP4">Ampliar la cobertura en el Sur.</p></div></div>' +
      // PowerPoint
      '<div class="a-l a-ppt" id="aPpt"><span class="a-lab">PowerPoint</span><aside class="a-th">' + th + '</aside><div class="a-sl"><div class="a-slide reveal" id="aSlide">' +
      '<div class="i-head reveal"><b>Resumen T3</b><span>Dirección</span></div><div class="i-body"><div class="i-ks">' +
      '<div class="i-k reveal"><b>$2.40M</b><span>Ventas</span></div><div class="i-k reveal"><b>+18%</b><span>vs. año anterior</span></div><div class="i-k reveal"><b>34%</b><span>Margen</span></div></div>' +
      '<div class="i-low"><div class="i-ch reveal"><i style="height:38%"></i><i style="height:52%"></i><i style="height:46%"></i><i style="height:64%"></i><i style="height:58%"></i><i class="hi" style="height:78%"></i></div><div class="i-cc reveal"><h5>Conclusiones</h5><p>Ventas arriba del año anterior.</p><p>El margen necesita atención.</p></div></div></div></div></div></div>' +
      // Excel
      '<div class="a-l a-xls" id="aXls"><span class="a-lab">Excel</span><div class="x-sheet" id="xTable"><div class="x-r x-l"><span></span><span>A</span><span>B</span><span>C</span><span>D</span><span>E</span></div>' +
      '<div class="x-r x-t"><span>1</span><span>Cliente</span><span>Producto</span><span>Región</span><span>Importe</span><span>Margen</span></div>' + TABLA.map(fila).join("") + "</div>" +
      '<div class="x-chart reveal" id="xChart"><h5>Ventas por región</h5><div class="x-bars">' + barras + '</div><div class="x-ins reveal"><span>▲ Norte lidera con 44%</span><span>▼ Margen 2 pts bajo la meta</span></div></div></div>' +
      '</div><aside class="a-cop"><div class="cp-h"><span class="ik">' + I.chispa + "</span>Copilot</div><div class=\"cp-sets\">" +
      set(1, "Redacta el informe con este resumen", "Listo: creé un borrador con 3 secciones.", '<div class="cp-b" id="cpKeep"><span class="cp-keep">Conservar</span><span class="cp-no">Descartar</span></div>') +
      set(2, "Crea una presentación de 4 diapositivas", "Listo: 4 diapositivas con diseño y notas del orador.", '<div class="cp-b"><span class="cp-keep on">Conservar</span></div>') +
      set(3, "Analiza y grafica las ventas por región", "El Norte concentra 44% de los ingresos y el margen está 2 pts bajo la meta.", '<div class="cp-b"><span class="cp-keep on">Insertar gráfica</span></div>') +
      "</div></aside></div>" +
      I.cursor.replace('class="', 'id="curA" class="') + '<div class="click-ripple" id="ripA"></div></div></div>';
  }

  // =====================  ESCENA 3 · PROTEGER  =====================
  function sceneP() {
    const cab = [["Cliente", 1, "Dato personal"], ["Producto", 0], ["Región", 0], ["Importe", 1, "Confidencial"], ["Margen", 0]]
      .map((c) => "<span>" + c[0] + (c[1] ? '<span class="p-fl reveal"><span class="ik">' + I.candado + "</span>" + c[2] + "</span>" : "") + "</span>").join("");
    const filas = TABLA.map((r, i) => '<div class="p-r"><span class="cl-c">' + '<span class="dl"><span class="d">' + r[0] + '</span><span class="l">Cliente ' + "ABCDE"[i] + "</span></span></span><span>" + r[1] + "</span><span>" + r[2] + '</span><span class="im-c"><span class="dl"><span class="d">' + r[3] + '</span><span class="l">██████</span></span></span><span>' + r[4] + "</span></div>").join("");
    const esq = [["Cliente", "texto · anónimo"], ["Producto", "texto"], ["Región", "texto"], ["Importe", "número · oculto"], ["Margen", "porcentaje"]]
      .map((s) => '<div class="p-sc reveal"><b>' + s[0] + "</b><span>" + s[1] + "</span></div>").join("");
    const regla = ["Nombres → Cliente A", "Montos → ocultos", "Solo la estructura sale"].map((t) => '<div class="p-ru reveal"><span class="ik">' + I.check + "</span>" + t + "</div>").join("");
    return '<div class="bi-escena" id="iaP">' + msgBloque(3) + pflow(3) +
      '<div class="p-card p-left reveal" id="pLeft"><div class="p-ch"><span class="ik">' + I.carpeta + '</span>Tus datos reales<span class="p-lock reveal" id="pLock"><span class="ik">' + I.candado + '</span>Se quedan en tu equipo</span></div>' +
      '<div class="p-tbl reveal" id="pTable"><div class="p-r p-th">' + cab + "</div>" + filas + "</div></div>" +
      '<div class="p-arr p-a1" id="pA1"><i></i></div>' +
      '<div class="p-shield reveal" id="pShield"><span class="p-sh">' + I.escudo + '</span><b>Filtro de privacidad</b><div class="p-rus">' + regla + "</div></div>" +
      '<div class="p-arr p-a2" id="pA2"><i></i></div>' +
      '<div class="p-card p-right reveal" id="pRight"><div class="p-ch"><span class="ik">' + I.chispa + '</span>Lo que ve la IA<span class="p-note">Copilot protegido por tu organización</span></div>' +
      '<div class="p-sch" id="pSchema">' + esq + '</div><span class="ia-stamp reveal" id="pStamp"><span class="ik">' + I.check + "</span>Revisado por ti</span></div></div>";
  }

  // =====================  ESCENA 4 · CONSTRUIR (CLAUDE)  =====================
  const CODIGO = [
    ["<header>", "Dashboard de ventas", "</header>"],
    ['<div class="kpis">', "", ""],
    ['  <div class="kpi" data-m="ventas">', "", ""],
    ['  <div class="kpi" data-m="margen">', "", ""],
    ["</div>", "", ""],
    ['<canvas id="barras"></canvas>', "", ""],
    ['<button id="importar">', "Importar datos", "</button>"],
    ["<script>", "", ""],
    ["  importar.onclick = pedirCSV;", "", ""],
    ["  guardar(localStorage, datos);", "", ""],
    ["</script>", "", ""],
  ];
  function sceneK() {
    const esc = (s) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const lineas = CODIGO.map((l, i) => '<span class="cl k-l" id="kL' + i + '"><em>' + (i + 1) + "</em>" + esc(l[0]) + (l[1] ? "<b>" + l[1] + "</b>" : "") + esc(l[2]) + "</span>").join("");
    const pasos = ["Estructura leída", "Diseño y animaciones", "Botón para importar datos", "Guardado local"].map((p) => '<div class="k-st reveal"><span class="ik">' + I.check + "</span>" + p + "</div>").join("");
    const adj = ["Cliente", "Producto", "Región", "Importe", "Margen"].map((c) => "<span>" + c + "</span>").join("");
    const kpi = (id, lb) => '<div class="k-kpi reveal"><span>' + lb + '</span><b id="' + id + '">—</b></div>';
    const barras = REGIONES.map((r) => '<div class="k-bc"><div class="k-bp"><i data-h="' + r[1] + '"></i></div><span>' + r[0] + "</span></div>").join("");
    return '<div class="bi-escena" id="iaK">' + msgBloque(4) + pflow(4) +
      '<div class="k-win ia-win reveal" id="kWin">' +
      '<div class="k-bar"><span class="ik">' + I.chispa + "</span><b>Claude</b><span class=\"k-t\">Dashboard de ventas</span></div>" +
      '<div class="k-body"><div class="k-chat">' +
      '<div class="k-u reveal" id="kU"><span class="cl" id="kUt">Con esta estructura, crea un dashboard HTML con un botón para importar datos.</span><div class="k-att reveal" id="kAttach">' + adj + "</div></div>" +
      '<div class="k-a reveal" id="kA"><span class="c-av">' + I.chispa + '</span><div><p>Listo. Armé tu dashboard:</p>' + pasos + "</div></div>" +
      '</div><div class="k-code reveal" id="kCode"><div class="k-fn">dashboard.html</div>' + lineas + "</div>" +
      '<div class="k-prev reveal" id="kPrev"><div class="k-ph reveal" id="kPh"><b>Ventas T3</b><span class="k-imp" id="kImp"><span class="ik">' + I.archivo + '</span>Importar datos</span></div>' +
      '<div class="k-ks">' + kpi("kV", "Ventas") + kpi("kG", "Crecimiento") + kpi("kM", "Margen") + '</div><div class="k-bars reveal" id="kBars">' + barras + "</div>" +
      '<span class="k-file reveal" id="kFile"><span class="ik">' + I.archivo + '</span>ventas_t3.csv</span>' +
      '<div class="k-loc reveal" id="kLoc"><span class="ik">' + I.carpeta + '</span>Guardado en tu equipo · sin servidor</div>' +
      '<span class="ia-stamp reveal" id="kStamp"><span class="ik">' + I.check + "</span>Revisado por ti</span></div></div>" +
      I.cursor.replace('class="', 'id="curK" class="') + '<div class="click-ripple" id="ripK"></div></div></div>';
  }

  function heroHtml() {
    return '<section class="viaje-hero" id="iaHero"><span class="viaje-hero-eyebrow">Curso de IA Aplicada</span>' +
      '<h1 class="viaje-hero-title">Aprende IA como un <span class="accent">Máster<span class="selector-box"><span class="selector-label">Prompt</span></span></span>.</h1>' +
      '<div class="viaje-hero-chips"><span class="scope-chip">Copilot · Claude</span><span class="scope-chip">Con privacidad de datos</span><span class="scope-chip">Español</span></div>' +
      '<div class="viaje-hero-actions"><a href="#iaC" class="viaje-btn ghost" data-viaje-next>Baja para conocer el programa' + I.flecha + '</a><a href="#programas" class="viaje-btn solid">Ver programas' + I.flecha + "</a></div></section>";
  }

  function shellHtml() {
    const tabs = [["Pedir", 1], ["Copilot en tus apps", 2], ["Proteger", 3], ["Construir", 4]].map((t) => '<button type="button" class="bi-tab" data-scene="' + t[1] + '"><b>' + t[1] + "</b>" + t[0] + "</button>").join("");
    const rail = [["pedir", "Pedir", 1], ["apps", "Apps", 2], ["proteger", "Proteger", 3], ["construir", "Construir", 4]].map((r) => '<button type="button" class="bi-rv" data-v="' + r[0] + '" data-scene="' + r[2] + '" aria-label="' + r[1] + '">' + I[r[0]] + "<span>" + r[1] + "</span></button>").join("");
    const msgs = MSGS.map((m, i) => '<span class="bi-txt" id="iaMsg' + (i + 1) + '">' + m + '<span class="formula-msg-cursor"></span></span>').join("");
    const pr = PROMPTS.map((p, i) => '<span class="ia-pt" id="iaP' + (i + 1) + '">' + p + "</span>").join("");
    return '<div class="bi-shell ia-shell" id="iaShell">' +
      '<div class="bi-top"><div class="bi-file ia-file"><span class="ia-spark">' + I.chispa + '</span><b id="iaAsist">' + ASIST[0] + '</b><span class="ia-sello" id="iaSello"><span class="ik">' + I.check + '</span><span id="iaSelloT">Revisado por ti 0/4</span></span></div>' +
      '<div class="bi-fx"><span class="bi-fx-ico">fx</span><div class="bi-fx-stack">' + msgs + "</div></div>" +
      '<a href="#programas" class="bi-ver">Ver programas' + I.flecha + "</a></div>" +
      '<div class="bi-rail">' + rail + "</div>" +
      '<div class="ia-comp"><div class="ia-box"><span class="ia-tag" id="iaTag">' + TAGS[1] + '</span><div class="ia-prompt">' + pr + '</div><span class="ia-send" id="iaSend">' + I.enviar + "</span></div></div>" +
      '<div class="bi-steps" id="iaRail">' + tabs + '<span class="bi-status mono" id="iaEstado">' + ESTADOS[0] + "</span></div></div>";
  }

  function ctx(root, desk) {
    const $ = (s) => root.querySelector(s);
    const qa = (s) => Array.prototype.slice.call(root.querySelectorAll(s));
    return { $: $, qa: qa, desk: desk, msg: (i) => $("#iaMsg" + i), pr: (i) => $("#iaP" + i) };
  }

  // =====================  TIMELINES  =====================
  const sinColor = { backgroundColor: "rgba(255,255,255,0)" };
  function escC(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x;
    tl.fromTo($("#cWin"), { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 6 }, at(0));
    tipea(tl, R.msg(1), at(2), 10);
    tl.fromTo($("#cU1"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 4 }, at(8));
    tl.fromTo($("#cA1"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 5 }, at(13));
    // el prompt bien armado se escribe en el compositor (escritorio) y se envía
    tipea(tl, R.pr(1), at(24), 20);
    if (R.desk) { tl.to($("#iaSend"), { scale: 1.25, duration: 2 }, at(45)); tl.to($("#iaSend"), { scale: 1, duration: 3 }, at(47)); }
    tl.fromTo($("#cU2"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 4 }, at(48));
    tl.to($("#cGuide"), { opacity: 1, duration: 4 }, at(52));
    tl.fromTo(qa("#cGuide .g"), { x: 12 }, { opacity: 1, x: 0, duration: 4, stagger: 3.5 }, at(54));
    tl.to(["#cU1", "#cA1"].map((s) => $(s)), { opacity: 0.38, duration: 5 }, at(68));
    tl.fromTo($("#cA2"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 5 }, at(68));
    qa("#cA2 li").forEach((li, i) => tipea(tl, li, at(73 + i * 5), 5));
    tl.to($("#cStamp"), { opacity: 1, duration: 3 }, at(89));
  }

  function escA(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, wrap = $("#aWin");
    if (!R.desk) { tl.fromTo($("#aWin"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 6 }, at(0)); tl.to($("#aSum"), { opacity: 1, duration: 4 }, at(2)); }
    tipea(tl, R.msg(2), at(4), 10);
    tipea(tl, R.pr(2), at(2), 24);
    const set = (n, t) => { qa("#aSet" + n + " .reveal").forEach((el, i) => tl.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 4 }, t + i * 8)); };
    // Word: Copilot redacta el informe
    set(1, at(6));
    tl.to($("#aBor"), { opacity: 1, duration: 3 }, at(10));
    tipea(tl, $("#aTt"), at(12), 4);
    tipea(tl, $("#aH2"), at(17), 3); tipea(tl, $("#aP2"), at(20), 8);
    tipea(tl, $("#aH3"), at(29), 3); tipea(tl, $("#aP3"), at(32), 4); tipea(tl, $("#aP4"), at(36), 4);
    const cur = $("#curA"), rip = $("#ripA"), keep = $("#cpKeep .cp-keep");
    const px = (el) => () => cen(el, wrap)[0] - 4, py = (el) => () => cen(el, wrap)[1] - 2;
    tl.fromTo(cur, { opacity: 0, x: () => cen($("#aWord"), wrap)[0], y: () => cen($("#aWord"), wrap)[1] }, { opacity: 1, duration: 3, immediateRender: false }, at(30));
    tl.to(cur, { x: px(keep), y: py(keep), duration: 8 }, at(32));
    tl.fromTo(rip, { x: () => cen(keep, wrap)[0] - 13, y: () => cen(keep, wrap)[1] - 13, scale: 0, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 4, immediateRender: false }, at(40));
    tl.to(keep, { backgroundColor: "#0b7a6b", color: "#ffffff", borderColor: "#0b7a6b", duration: 3 }, at(41));
    tl.to(cur, { opacity: 0, duration: 3 }, at(46));
    // PowerPoint: la presentación
    const barra = $("#aBar"), nombres = qa("#aBar .a-an b"), tabs = qa("#aBar .a-tabs span"), ico = $("#aBar .a-ico");
    const cambia = (n, color, t) => {
      tl.to(barra, { backgroundColor: color, duration: 4 }, t);
      nombres.forEach((el, i) => tl.to(el, { opacity: i === n ? 1 : 0, duration: 3 }, t));
      tabs.forEach((el, i) => tl.to(el, { backgroundColor: i === n ? "rgba(255,255,255,.26)" : "rgba(255,255,255,0)", duration: 3 }, t));
    };
    cambia(1, "#c43e1c", at(46));
    tl.to($("#aWord"), { opacity: 0, duration: 4 }, at(46));
    tl.to($("#aPpt"), { opacity: 1, duration: 4 }, at(48));
    tl.to($("#aSet1"), { opacity: 0, duration: 4 }, at(46));
    tl.to($("#aSet2"), { opacity: 1, duration: 3 }, at(48));
    set(2, at(48));
    tl.to(qa("#aPpt .a-th .t"), { opacity: 1, duration: 3, stagger: 2 }, at(52));
    tl.to($("#aSlide"), { opacity: 1, duration: 4 }, at(54));
    tl.to(qa("#aSlide .reveal"), { opacity: 1, duration: 3, stagger: 2 }, at(58));
    // Excel: el análisis (la tabla es lo que viaja a la siguiente escena)
    cambia(2, "#107c41", at(70));
    tl.to($("#aPpt"), { opacity: 0, duration: 4 }, at(70));
    tl.to($("#aXls"), { opacity: 1, duration: 4 }, at(72));
    tl.to($("#aSet2"), { opacity: 0, duration: 4 }, at(70));
    tl.to($("#aSet3"), { opacity: 1, duration: 3 }, at(72));
    set(3, at(72));
    tl.to(qa("#xTable .x-d"), { opacity: 1, duration: 3, stagger: 1.5 }, at(74));
    tl.to($("#xChart"), { opacity: 1, duration: 4 }, at(80));
    tl.fromTo(qa("#xChart .x-b i"), { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 6, stagger: 2 }, at(82));
    tl.to($("#xChart .x-ins"), { opacity: 1, duration: 4 }, at(88));
  }

  function escP(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x;
    if (!R.desk) { tl.to($("#pLeft"), { opacity: 1, duration: 5 }, at(0)); tl.to($("#pTable"), { opacity: 1, duration: 4 }, at(0)); }
    tipea(tl, R.msg(3), at(4), 10);
    tipea(tl, R.pr(3), at(2), 22);
    tl.to(qa("#pTable .p-fl"), { opacity: 1, duration: 4, stagger: 4 }, at(8));
    tl.to($("#pShield"), { opacity: 1, duration: 5 }, at(14));
    tl.to(qa("#pShield .p-ru"), { opacity: 1, duration: 3, stagger: 3 }, at(18));
    // los datos sensibles se enmascaran
    tl.to(qa("#pTable .cl-c .d, #pTable .im-c .d"), { opacity: 0, duration: 4, stagger: 1 }, at(32));
    tl.to(qa("#pTable .cl-c .l, #pTable .im-c .l"), { opacity: 1, duration: 4, stagger: 1 }, at(32));
    tl.to(qa("#pTable .p-fl"), { opacity: 0.35, duration: 4 }, at(40));
    tl.to($("#pLock"), { opacity: 1, duration: 4 }, at(42));
    // solo la estructura viaja a la IA
    tl.fromTo(qa(".p-arr i"), { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 8, stagger: 6, ease: "none" }, at(36));
    tl.to($("#pRight"), { opacity: 1, duration: 5 }, at(44));
    tl.to(qa("#pSchema .p-sc"), { opacity: 1, duration: 3, stagger: 2.5 }, at(48));
    tl.to($("#pStamp"), { opacity: 1, duration: 3 }, at(66));
  }

  function escK(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, wrap = $("#kWin");
    if (!R.desk) { tl.fromTo($("#kWin"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 6 }, at(0)); tl.to($("#kAttach"), { opacity: 1, duration: 3 }, at(2)); }
    tipea(tl, R.msg(4), at(4), 10);
    tipea(tl, R.pr(4), at(2), 24);
    tl.to($("#kU"), { opacity: 1, duration: 3 }, at(4));
    tipea(tl, $("#kUt"), at(6), 8);
    tl.to($("#kA"), { opacity: 1, duration: 4 }, at(14));
    tl.to(qa("#kA .k-st"), { opacity: 1, duration: 3, stagger: 12 }, at(18));
    // el código se escribe y el dashboard aparece al mismo tiempo
    tl.to($("#kCode"), { opacity: 1, duration: 4 }, at(14));
    CODIGO.forEach((l, i) => tipea(tl, $("#kL" + i), at(18 + i * 3.4), 3));
    tl.to($("#kPrev"), { opacity: 1, duration: 4 }, at(16));
    tl.to($("#kPh"), { opacity: 1, duration: 3 }, at(20));
    tl.to(qa("#kPrev .k-kpi"), { opacity: 1, duration: 3, stagger: 2 }, at(26));
    tl.to($("#kBars"), { opacity: 1, duration: 4 }, at(36));
    // importar datos: el archivo local llena todo
    const cur = $("#curK"), rip = $("#ripK"), btn = $("#kImp");
    const px = (el) => () => cen(el, wrap)[0] - 4, py = (el) => () => cen(el, wrap)[1] - 2;
    tl.fromTo(cur, { opacity: 0, x: () => cen($("#kCode"), wrap)[0], y: () => cen($("#kCode"), wrap)[1] + 60 }, { opacity: 1, duration: 3, immediateRender: false }, at(52));
    tl.to(cur, { x: px(btn), y: py(btn), duration: 8 }, at(54));
    tl.fromTo(rip, { x: () => cen(btn, wrap)[0] - 13, y: () => cen(btn, wrap)[1] - 13, scale: 0, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 4, immediateRender: false }, at(62));
    tl.fromTo($("#kFile"), { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 4 }, at(63));
    const cuenta = (id, fin, fmt, t) => { const o = { v: 0 }, el = $(id); tl.to(o, { v: fin, duration: 9, onUpdate: () => { el.textContent = o.v <= 0.001 ? "—" : fmt(o.v); } }, t); };
    cuenta("#kV", 2.4, (v) => "$" + v.toFixed(2) + "M", at(68));
    cuenta("#kG", 18, (v) => "▲ " + Math.round(v) + "%", at(70));
    cuenta("#kM", 34, (v) => Math.round(v) + "%", at(72));
    tl.to(qa("#kBars .k-bc i"), { height: (i, el) => el.dataset.h + "%", duration: 9, stagger: 2 }, at(70));
    tl.to($("#kFile"), { opacity: 0, duration: 3 }, at(80));
    tl.to($("#kLoc"), { opacity: 1, duration: 4 }, at(82));
    tl.to(cur, { opacity: 0, duration: 3 }, at(80));
    tl.to($("#kStamp"), { opacity: 1, duration: 3 }, at(88));
  }

  // =====================  CONTENIDO  =====================
  const IA = {
    renderHtml() {
      return '<div class="viaje-root bi-root ia-root" id="viajeIA">' + shellHtml() + heroHtml() +
        '<section class="bi-pin" id="iaPin"><div class="bi-canvas" id="iaCanvas">' + sceneC() + sceneA() + sceneP() + sceneK() + "</div></section></div>";
    },

    iniciar() {
      const root = document.getElementById("viajeIA");
      if (!root) return;
      const NAV = E.navOffset(root);
      document.documentElement.style.setProperty("--viaje-nav-h", NAV + "px");

      // "Ver programas" aterriza en el título (instantáneo); sin tocar el hash: cursos.html lo usa para cambiar de herramienta
      root.querySelectorAll('a[href="#programas"]').forEach((a) => a.addEventListener("click", (e) => {
        e.preventDefault();
        const t = document.getElementById("programas");
        if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - (NAV + 24), behavior: "instant" });
      }));
      const siguiente = root.querySelector("[data-viaje-next]");
      if (siguiente) siguiente.addEventListener("click", (e) => {
        e.preventDefault();
        if (!root.classList.contains("bi-flujo")) return;   // en escritorio lo maneja irA() (más abajo)
        const q = document.getElementById("iaC");
        if (q) window.scrollTo({ top: q.getBoundingClientRect().top + window.scrollY - (NAV + 8), behavior: "smooth" });
      });

      const { simple, telefono } = E.esSimpleMode();
      if (simple) { estadoFinal(root); return; }
      if (telefono) { root.classList.add("viaje-flujo", "bi-flujo", "viaje-movil"); flujo(root); ScrollTrigger.refresh(); window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true }); return; }

      gsap.registerPlugin(ScrollTrigger);
      const R = ctx(root, true), $ = R.$, qa = R.qa;
      const pin = $("#iaPin"), canvas = $("#iaCanvas");

      // ---- línea de tiempo maestra: cuatro actos y tres transiciones ----
      const m = gsap.timeline({ defaults: { ease: "power1.out" } });
      escC(m, S.c, R);
      // Pedir → Copilot: el resumen que devolvió el asistente se vuelve el informe de Word
      m.to($("#cWin"), { opacity: 0, duration: 8 }, TR.ca + 2);
      morph(m, $("#iResumen"), $("#aSum"), canvas, TR.ca, 16, true);
      m.fromTo($("#aWin"), { opacity: 0 }, { opacity: 1, duration: 8 }, TR.ca + 4);
      m.to([R.msg(1), R.pr(1)], { opacity: 0, duration: 6 }, TR.ca + 2);
      escA(m, S.a, R);
      // Copilot → Proteger: la tabla de Excel es la que se protege
      m.to($("#aWin"), { opacity: 0, duration: 8 }, TR.ap + 2);
      morph(m, $("#xTable"), $("#pTable"), canvas, TR.ap, 16, true);
      m.to($("#pLeft"), { opacity: 1, duration: 8 }, TR.ap + 4);
      m.to([R.msg(2), R.pr(2)], { opacity: 0, duration: 6 }, TR.ap + 2);
      escP(m, S.p, R);
      // Proteger → Construir: la estructura sin datos es lo que se le da a Claude
      m.to(["#pLeft", "#pShield", "#pRight", "#pA1", "#pA2"].map((s) => $(s)), { opacity: 0, duration: 8 }, TR.pk + 2);
      morph(m, $("#pSchema"), $("#kAttach"), canvas, TR.pk, 16, true);
      m.fromTo($("#kWin"), { opacity: 0 }, { opacity: 1, duration: 8 }, TR.pk + 4);
      m.to([R.msg(3), R.pr(3)], { opacity: 0, duration: 6 }, TR.pk + 2);
      escK(m, S.k, R);
      m.to({}, { duration: 1 }, TOTAL - 1);   // la duración total es exactamente TOTAL

      // ---- cáscara: riel/pestañas = actos; asistente, etiqueta del compositor, sello y estado cambian con la escena ----
      const tabs = qa(".bi-tab"), vistas = qa(".bi-rv");
      const asist = $("#iaAsist"), tag = $("#iaTag"), sello = $("#iaSelloT"), estado = $("#iaEstado");
      let activa = -1, nSello = -1;
      function setActive(n) {
        if (n === activa) return;
        activa = n;
        tabs.forEach((t) => t.classList.toggle("active", t.dataset.scene === String(n)));
        vistas.forEach((t) => t.classList.toggle("active", t.dataset.v === RIEL[n]));
        asist.textContent = ASIST[n]; tag.textContent = TAGS[n] || TAGS[1]; estado.textContent = ESTADOS[n];
      }
      function setSello(u) {
        const n = SELLOS.filter((t) => u > t).length;
        if (n !== nSello) { nSello = n; sello.textContent = "Revisado por ti " + n + "/4"; }
      }
      setActive(0); setSello(0);

      const st = ScrollTrigger.create({
        trigger: pin, start: "top " + NAV + "px", end: "+=" + Math.round(TOTAL * 1.75) + "%", scrub: 1, pin: true, animation: m, invalidateOnRefresh: true,
        onUpdate: (self) => { const u = self.progress * TOTAL; setActive(u < UMBRAL[0] ? 1 : u < UMBRAL[1] ? 2 : u < UMBRAL[2] ? 3 : 4); setSello(u); },
      });
      ScrollTrigger.create({ trigger: $("#iaHero"), start: "top center", end: "bottom center", onToggle: (s) => s.isActive && setActive(0) });

      // scroll a un punto de la línea de tiempo (el pin mueve el layout: el ancla nativa no sirve)
      function irA(u) { window.scrollTo({ top: st.start + (st.end - st.start) * (u / TOTAL), behavior: "smooth" }); }
      tabs.concat(vistas).forEach((t) => t.addEventListener("click", () => irA(IR_A[t.dataset.scene])));
      if (siguiente) siguiente.addEventListener("click", () => irA(8));

      // la cáscara aparece a los 30 px de scroll y dura hasta el final del pin
      document.body.classList.add("bi-on");
      ScrollTrigger.create({
        trigger: $("#iaHero"), start: () => "top " + (NAV - 30) + "px", end: () => st.end,
        onToggle: (s) => document.body.classList.toggle("bi-hoja", s.isActive),
      });

      // el lienzo (1100×620) se escala completo al espacio libre entre cáscara, compositor y bordes
      function escalar() {
        const W = pin.clientWidth, H = pin.clientHeight;
        const rw = W - 56 - 12, rh = H - 48 - 36 - 58 - 8;
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
    root.querySelectorAll(".viaje-msg .formula-msg-text").forEach((el, i) => { el.id = "iaMsg" + (i + 1); });
    root.querySelectorAll(".ia-pflow .ia-pt").forEach((el, i) => { el.id = "iaP" + (i + 1); });
    const R = ctx(root, false), K = 12;
    const una = (trigger, start) => gsap.timeline({ defaults: { ease: "power1.out" }, scrollTrigger: { trigger: trigger, start: start || "top 72%", once: true } });
    [["#iaC", escC], ["#iaA", escA], ["#iaP", escP], ["#iaK", escK]].forEach((e) => { const tl = una(e[0]); e[1](tl, 0, R); tl.timeScale(K); });
  }

  // estado final (reduced-motion o GSAP caído): todo visible, escenas apiladas
  function estadoFinal(root) {
    root.classList.add("viaje-simple", "viaje-flujo", "bi-flujo", "ia-flujo", "ia-final");
    const sh = root.querySelector(".bi-shell"); if (sh) sh.remove();
    root.querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
    root.querySelectorAll(".formula-msg-text, .cl").forEach((el) => { el.style.clipPath = "inset(0 0% 0 0)"; });
    root.querySelectorAll(".a-l").forEach((el) => { el.style.opacity = 1; });
    root.querySelectorAll(".x-b i").forEach((el) => { el.style.transform = "none"; });
    root.querySelectorAll(".k-bc i").forEach((el) => { el.style.height = el.dataset.h + "%"; });
    root.querySelectorAll(".p-arr i").forEach((el) => { el.style.transform = "none"; });
    const val = { kV: "$2.40M", kG: "▲ 18%", kM: "34%" };
    Object.keys(val).forEach((k) => { const el = root.querySelector("#" + k); if (el) el.textContent = val[k]; });
  }

  window.ViajeEscenas.ia = IA;
})();
