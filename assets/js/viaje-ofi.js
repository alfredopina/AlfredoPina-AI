// assets/js/viaje-ofi.js
// Viaje de Ofimática Básica (scrollytelling GSAP) para cursos.html. Se registra en window.ViajeEscenas
// (ver viaje.js: expone el motor compartido ViajeEngine con rel/cen/tipea/morph). Mismo método que Power BI
// (viaje-bi.js): una cáscara fija + UN solo dato que viaja + un lienzo de 1100×620 con UN pin y UNA línea de
// tiempo maestra. El dato es "el informe del trimestre para dirección" y recorre el día de trabajo:
//   Comunicar (Outlook: llega el correo) → Redactar (Word) → Presentar (PowerPoint) → Colaborar (Teams).
//
// Decisiones que NO hay que repetir si esto se toca:
//   - La cáscara es la barra de Microsoft 365 (menú de apps, nombre de archivo con "Guardado en OneDrive", riel con las
//     4 apps, tira Comunicar › Redactar › Presentar › Colaborar). OneDrive es el hilo, no una escena. Íconos de línea
//     propios, nunca logos de Microsoft.
//   - El correo se vuelve el documento, el documento se vuelve la diapositiva, la diapositiva se vuelve la pantalla
//     compartida (ViajeEngine.morph: un marco que viaja, el texto nunca se deforma). Cifras de Power BI ($2.40M, 18%,
//     34%) a propósito: quien vea los viajes las reconoce.
//   - Móvil táctil: sin pin, cada escena fluye en vertical (mismas funciones con timeScale). Estático (reduced-motion o
//     GSAP caído): todo en su estado final (clase of-final + estadoFinal()).
(function () {
  "use strict";
  const E = window.ViajeEngine;
  if (!E || !window.ViajeEscenas || !E.morph) return;
  const { rel, cen, tipea, morph } = E;

  // ---- constantes de la animación (unidades de la línea de tiempo maestra) ----
  const O = "249,115,22";                  // naranja Ofimática (--c) en rgb, para tweens de color
  const HL = "rgba(" + O + ",.16)", HL0 = "rgba(" + O + ",0)";
  const WSEL = "#dbe8fb";                  // selección azul claro de Word (estilo y botón activos)
  const RH = 58;                           // alto de fila de correo (px; igual en CSS)
  const S = { o: 0, w: 108, p: 216, t: 324 };          // inicio de cada escena
  const TR = { ow: 92, wp: 200, pt: 308 };             // inicio de cada transición
  const TOTAL = 430;
  const UMBRAL = [100, 208, 316];                      // unidades donde cambia la escena activa
  const IR_A = { 1: 88, 2: 196, 3: 304, 4: 422 };      // a dónde aterriza cada pestaña (todo ya dibujado)

  const MSGS = [
    "Ordena tu día antes de que te ordene a ti.",
    "Convierte ideas sueltas en documentos profesionales.",
    "Presenta con claridad, no con diapositivas llenas.",
    "Trabaja en equipo sin mandar archivos de ida y vuelta.",
  ];
  const APPS = ["Microsoft 365", "Outlook", "Word", "PowerPoint", "Teams"];
  const ARCHIVOS = ["Inicio", "Bandeja de entrada", "Informe T3.docx", "Informe T3.pptx", "Informe T3 · Reunión"];
  const NUBES = ["", "", "Guardado en OneDrive", "Guardado en OneDrive", "Compartido · todos pueden editar"];
  const ESTADOS = ["12 correos sin ordenar", "12 → 4 correos · 1 por atender", "Informe T3 · 4 secciones", "4 diapositivas", "5 participantes · en vivo"];
  const RIEL = [null, "outlook", "word", "ppt", "teams"];

  // ---- íconos de línea (propios) ----
  const svg = (d, w) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const I = {
    waffle: '<svg viewBox="0 0 24 24" fill="currentColor">' + [5, 12, 19].map((y) => [5, 12, 19].map((x) => '<circle cx="' + x + '" cy="' + y + '" r="1.6"/>').join("")).join("") + "</svg>",
    outlook: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    word: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 15.5h7M9 19h4"/>'),
    ppt: svg('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M8 12l3-3 2 2 3-4"/>'),
    teams: svg('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5"/><circle cx="17.5" cy="9.5" r="2.3"/><path d="M17 14.3c2.4.2 4 1.8 4 4.4"/>'),
    flecha: svg('<path d="M12 5v14M5 12l7 7 7-7"/>', 2.2),
    check: svg('<path d="M5 13l4 4L19 7"/>', 3),
    nube: svg('<path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a4 4 0 0 1 .5 9.5z"/><path d="M9.5 13l2 2 3.5-3.5"/>', 1.8),
    bandeja: svg('<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>'),
    enviar: svg('<path d="M4 12l16-8-6 17-3-7z"/><path d="M11 14l9-10"/>'),
    carpeta: svg('<path d="M3 6h6l2 2h10v11H3z"/>'),
    bandera: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
    calendario: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    campana: svg('<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    cam: svg('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>'),
    compartir: svg('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 13V8M9.5 10.5L12 8l2.5 2.5M8 20h8"/>'),
    chat: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
    colgar: svg('<path d="M3 14c5-5 13-5 18 0l-3 3-3-2v-2a10 10 0 0 0-6 0v2l-3 2z"/>'),
    enlace: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>'),
    mensaje: svg('<path d="M4 6h16v11H8l-4 3z"/>'),
    cursor: '<svg class="cursor-ico reveal of-cur no-final" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l15 7-6.2 1.6L11 17z"/></svg>',
    puntero: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l15 7-6.2 1.6L11 17z"/></svg>',
  };

  const xf = (a, b, cls) => '<span class="xf ' + (cls || "") + '"><b class="a">' + a + '</b><b class="b">' + b + "</b></span>";
  function msgBloque(n) {
    return '<div class="viaje-msg"><div class="formula-msg"><span class="formula-msg-fx">fx</span><span class="formula-msg-text">' + MSGS[n - 1] + '<span class="formula-msg-cursor"></span></span></div></div>';
  }

  // barra de título de cada app (con el color de su app): menú de apps, ícono, nombre, centro y derecha
  const barra = (ico, nombre, medio, der) => '<div class="of-wbar"><span class="of-wi">' + I.waffle + '</span><span class="of-ai">' + I[ico] + "</span><b>" + nombre + "</b>" + (medio || "") + (der || "") + "</div>";
  const tabsBarra = (a) => '<div class="of-tabs">' + a.map((t, i) => "<span" + (i === 0 ? ' class="on"' : "") + ">" + t + "</span>").join("") + "</div>";

  // =====================  ESCENA 1 · OUTLOOK  =====================
  const CORREOS = [
    { k: "key", n: "Dirección", s: "Informe del trimestre para el jueves", p: "Hola, ¿me preparas el informe del trimestre?", h: "9:02", ini: "DI", cat: ["urg", "▲ Urgente"], flag: 1, sel: 1 },
    { k: "n1", n: "Boletín TI", s: "Novedades de la semana", p: "Actualizaciones y avisos de sistemas", h: "8:40", ini: "TI", news: 1 },
    { k: "rh", n: "Recursos Humanos", s: "Calendario de vacaciones", p: "Revisa las fechas disponibles", h: "8:15", ini: "RH", cat: ["int", "◆ Interno"] },
    { k: "n2", n: "Boletín Proveedores", s: "Ofertas del mes", p: "Promociones y listas de precios", h: "7:58", ini: "BP", news: 1 },
    { k: "ac", n: "Cliente Acme", s: "Re: seguimiento de propuesta", p: "Gracias por la información enviada", h: "Ayer", ini: "AC", cat: ["cli", "● Cliente"], leido: 1 },
    { k: "n3", n: "Boletín Finanzas", s: "Cierre de mes", p: "Resumen de movimientos", h: "Ayer", ini: "BF", news: 1 },
  ];
  const ORDEN = CORREOS.map((c) => c.k);

  function correoHtml(c) {
    return '<div class="o-row reveal' + (c.news ? " o-news of-quitar" : "") + (c.sel ? " sel" : "") + (c.leido ? "" : " un") + '" data-k="' + c.k + '">' +
      '<i class="av">' + c.ini + "</i>" +
      '<div class="tx"><b>' + c.n + (c.k === "key" ? '<em class="o-new">Nuevo</em>' : "") + '</b><span class="s">' + c.s + '</span><span class="p">' + c.p + "</span></div>" +
      '<div class="mt"><span class="h">' + c.h + "</span>" +
      (c.flag ? '<span class="o-flag reveal">' + I.bandera + "</span>" : "") +
      (c.cat ? '<span class="o-cat reveal ' + c.cat[0] + '">' + c.cat[1] + "</span>" : "") + "</div></div>";
  }

  function sceneO() {
    const rb = (ico, t) => '<span class="o-rb">' + (ico ? '<span class="ik">' + I[ico] + "</span>" : "") + t + "</span>";
    return '<div class="bi-escena" id="ofO">' + msgBloque(1) +
      '<div class="o-win of-win reveal" id="oWin">' +
      barra("outlook", "Outlook", '<span class="of-search">Buscar</span>', '<span class="of-me">AP</span>') +
      '<div class="o-ribbon"><span class="o-nuevo"><span class="ik">' + I.outlook + "</span>Nuevo correo</span>" + rb("", "Eliminar") + rb("", "Archivar") + '<span class="o-sep"></span>' + rb("enviar", "Responder") + rb("", "Reenviar") + '<span class="o-sep"></span>' + rb("", "Categorizar") + rb("bandera", "Marcar") + "</div>" +
      '<div class="o-body">' +
      '<aside class="o-folders">' +
      '<div class="f on" id="oFInbox"><span class="ik">' + I.bandeja + "</span>Bandeja de entrada" + xf("12", "4", "n") + "</div>" +
      '<div class="f"><span class="ik">' + I.enviar + "</span>Enviados</div>" +
      '<div class="f reveal" id="oFBol"><span class="ik">' + I.carpeta + "</span>Boletines" + xf("0", "3", "n") + "</div>" +
      '<div class="f" id="oFSeg"><span class="ik">' + I.bandera + "</span>Seguimiento" + xf("0", "1", "n") + "</div></aside>" +
      '<section class="o-listwrap"><div class="o-lh"><b>Bandeja de entrada</b><span>Todos ▾</span></div><div class="o-rule reveal" id="oRule"><b>Regla</b> Boletines → carpeta Boletines</div><div class="o-list" id="oList">' + CORREOS.map(correoHtml).join("") + "</div></section>" +
      '<article class="o-read reveal" id="oRead">' +
      '<div class="o-rh"><i class="av">DI</i><div><b>Dirección</b><span>Para: Tú · 9:02</span></div><span class="o-flag reveal">' + I.bandera + "</span></div>" +
      "<h3>Informe del trimestre para el jueves</h3>" +
      '<p class="cl" id="oB1">Hola, ¿me preparas el informe del trimestre para el jueves?</p>' +
      '<p class="cl" id="oB2">Incluye ventas, margen y próximos pasos. Lo presentamos en la reunión de dirección.</p>' +
      '<p class="cl" id="oB3">Gracias. — Dirección</p>' +
      '<span class="o-cat reveal urg">▲ Urgente</span>' +
      '<div class="o-cal reveal" id="oCal"><span class="ik">' + I.calendario + '</span><div><b>Jueves · 10:00</b><span>Entrega del informe T3</span></div><span class="o-bell">' + I.campana + "1 día antes</span></div>" +
      "</article></div></div></div>";
  }

  // =====================  ESCENA 2 · WORD  =====================
  const TEXTOS = {
    p1: "Las ventas cerraron en $2.40M, 18% arriba del año anterior, con un margen de 34%.",
    p2: "Licencias Pro lideró con 38% de las ventas y el Norte concentró 44% de los ingresos.",
    p3: "Cerrar el margen contra la meta y ampliar la cobertura en el Sur.",
  };
  function sceneW() {
    const sec = (id, h, p, extra) => '<h2 class="w-h cl" id="' + id + 'h">' + h + '</h2><p class="w-p cl" id="' + id + 'p">' + p + (extra || "") + "</p>";
    const toc = ["Resumen", "Resultados", "Próximos pasos"].map((t, i) => '<div class="tl reveal"><span>' + t + "</span><i></i><em>" + (i + 1) + "</em></div>").join("");
    const nav = ["Resumen", "Resultados", "Próximos pasos"].map((t, i) => '<div class="ni reveal' + (i === 0 ? " on" : "") + '">' + t + "</div>").join("");
    const kpi = (n, l) => "<div><b>" + n + "</b><span>" + l + "</span></div>";
    return '<div class="bi-escena" id="ofW">' + msgBloque(2) +
      '<div class="w-win of-win reveal" id="wWin">' +
      barra("word", "Word", '<span class="of-arch2">Informe T3.docx · Guardado en OneDrive</span>', tabsBarra(["Inicio", "Insertar", "Revisar"]) + '<span class="of-compartir">Compartir</span>') +
      '<div class="w-ribbon"><span class="w-st"><i>AaBb</i>Normal</span><span class="w-st" id="wStyleT1"><i>AaBb</i>Título 1</span><span class="w-st"><i>AaBb</i>Título 2</span><span class="w-sep"></span><span class="w-btn" id="wBtnToc">Índice</span><span class="w-btn">Comentario</span></div>' +
      '<div class="w-body"><aside class="w-nav reveal" id="wNav"><div class="w-nav-h">Navegación</div>' + nav + "</aside>" +
      '<div class="w-stage"><div class="w-page reveal" id="wPage">' +
      '<div class="w-hd"><span class="w-logo">GD</span><b>Grupo Demo</b><em>Dirección de Operaciones · Confidencial</em></div>' +
      '<div class="w-title"><span class="w-eb">Tercer trimestre</span><h1 class="w-t cl" id="wTt">Informe del trimestre</h1><p class="w-sub cl" id="wSub">Preparado para Dirección · Octubre</p></div>' +
      '<div class="w-toc reveal" id="wToc"><b>Contenido</b>' + toc + "</div>" +
      sec("wR", "Resumen", TEXTOS.p1) +
      '<div class="w-kpi reveal" id="wKpi">' + kpi("$2.40M", "Ventas") + kpi("▲ 18%", "vs. año anterior") + kpi("34%", "Margen") + "</div>" +
      sec("wS", "Resultados", TEXTOS.p2, ' <ins class="w-ins reveal" id="wIns">(meta: 36%)</ins>') + sec("wN", "Próximos pasos", TEXTOS.p3) +
      '</div></div>' +
      '<aside class="w-rev"><div class="w-nav-h">Revisión</div>' +
      '<div class="w-c reveal" id="wC1"><i class="av">DI</i><div><b>Dirección</b><span>¿Podemos incluir la meta de margen?</span></div></div>' +
      '<div class="w-c w-c2 reveal" id="wC2"><i class="av me">AP</i><div><b>Alfredo</b><span>Listo, agregada en Resultados.</span><em>' + I.check + "Resuelto</em></div></div></aside></div></div></div>";
  }

  // =====================  ESCENA 3 · POWERPOINT  =====================
  // contenido de la diapositiva ejecutiva (medidas en cqw: escala sola en escritorio, móvil y Teams); con rev=true sus
  // piezas entran una a una (en PowerPoint), en Teams ya está completa
  function slideLimpia(rev) {
    const r = rev ? " reveal" : "";
    const k = (n, l, e, c) => '<div class="p-kpi' + r + '"><b>' + n + "</b><span>" + l + '</span><em class="' + c + '">' + e + "</em></div>";
    const barras = [38, 52, 46, 64, 58, 78].map((h, i) => '<i class="' + (i === 5 ? "hi" : "") + '" style="height:' + h + '%"></i>').join("");
    return '<div class="s-head' + r + '"><b>Resumen T3</b><span>Dirección · Tercer trimestre</span></div>' +
      '<div class="s-body"><div class="p-kpis">' + k("$2.40M", "Ventas", "▲ +12% vs. meta", "ok") + k("+18%", "vs. año anterior", "▲ sobre la meta (10%)", "ok") + k("34%", "Margen", "▼ 2 pts bajo la meta", "bad") + "</div>" +
      '<div class="s-low"><div class="s-chart' + r + '">' + barras + '</div><div class="s-ccl' + r + '"><h5>Conclusiones</h5><p>Las ventas superan al año anterior.</p><p>El margen necesita atención.</p></div></div></div>';
  }
  function sceneP() {
    const th = (n, t, cls, mini) => '<div class="p-th reveal ' + (cls || "") + '"><em>' + n + '</em><div class="mini">' + (mini || "<b>" + t + "</b><i></i><i></i>") + "</div></div>";
    const idea = (n, cuerpo) => '<div class="p-idea" id="pIdea' + n + '">' + cuerpo + "</div>";
    return '<div class="bi-escena" id="ofP">' + msgBloque(3) +
      '<div class="p-win of-win reveal" id="pWin">' +
      barra("ppt", "PowerPoint", '<span class="of-arch2">Informe T3.pptx · Guardado en OneDrive</span>', tabsBarra(["Inicio", "Diseño", "Transiciones"]) + '<span class="of-compartir" id="pBtnPres">Presentar</span>') +
      '<div class="p-body"><aside class="p-thumbs" id="pThumbs">' +
      th(1, "Informe del trimestre T3") + th(2, "Resumen", "p-th2", '<span class="xf"><span class="a mini-a"><b>Resumen</b><i></i><i></i><i></i></span><span class="b mini-b"><b>Resumen</b><u></u><u></u><u></u></span></span>') + th(3, "Resultados") + th(4, "Próximos pasos") +
      "</aside>" +
      '<div class="p-main"><div class="p-slide reveal" id="pSlide">' +
      '<div class="p-dense"><h4>Resumen</h4><p>Las ventas cerraron en $2.40M, 18% arriba del año anterior, con un margen de 34%. Licencias Pro lideró con 38% de las ventas. El Norte concentró 44% de los ingresos. Cerrar el margen contra la meta (36%) y ampliar la cobertura en el Sur.</p></div>' +
      '<div class="p-clean">' + slideLimpia(true) + "</div>" +
      '<span class="p-badge reveal" id="pBadge">Presentando</span></div>' +
      '<div class="p-notes reveal" id="pNotes"><span>Notas</span><p class="cl" id="pNotesT">Empezar por el resultado: ventas de $2.40M y 18% de crecimiento.</p></div></div>' +
      '<aside class="p-des reveal" id="pDes"><div class="w-nav-h">Diseñador</div>' +
      idea(1, "<i></i><i></i><i></i>") + idea(2, "<b></b><b></b><b></b>") + idea(3, "<u></u><u></u>") + "</aside></div>" +
      I.cursor.replace('class="', 'id="curP" class="') + '<div class="click-ripple" id="ripP"></div></div></div>';
  }

  // =====================  ESCENA 4 · TEAMS  =====================
  const FOTO = "/assets/img/alfredo-headshot.png";   // la misma foto pública de la landing
  function sceneT() {
    const per = (ini, nom) => '<div class="t-tile reveal"><i class="av">' + ini + "</i><span>" + nom + '</span><em class="ik">' + I.mic + "</em></div>";
    const ctl = (ico, txt, cls) => '<span class="t-b' + (cls ? " " + cls : "") + '"><span class="ik">' + I[ico] + "</span>" + txt + "</span>";
    return '<div class="bi-escena" id="ofT">' + msgBloque(4) +
      '<div class="t-win of-win reveal" id="tWin">' +
      barra("teams", "Teams", '<span class="t-title">Revisión T3 · Dirección</span>', '<span class="t-time"><i></i>00:12</span>') +
      '<div class="t-body"><div class="t-left">' +
      '<div class="t-share reveal" id="tShare"><div class="p-clean t-clean">' + slideLimpia(false) + "</div>" +
      '<span class="p-badge t-badge">Presentando: tú</span>' +
      '<span class="t-co reveal" id="tCoA" style="--cc:#7c3aed;left:20%;top:70%">' + I.puntero + "<em>Ana</em></span>" +
      '<span class="t-co reveal" id="tCoL" style="--cc:#0b7a6b;left:78%;top:30%">' + I.puntero + "<em>Luis</em></span></div>" +
      '<div class="t-ctl reveal" id="tCtl">' + ctl("mic", "Micrófono") + ctl("cam", "Cámara") + ctl("compartir", "Compartir", "on") + ctl("chat", "Chat") + ctl("colgar", "Salir", "end") + "</div></div>" +
      '<aside class="t-side"><div class="t-cam reveal"><img src="' + FOTO + '" alt="" decoding="async"><span class="t-name"><span class="ik">' + I.mic + "</span>Alfredo Piña · Presentando</span></div>" +
      '<div class="t-tiles">' + per("DI", "Dirección") + per("AN", "Ana") + per("LU", "Luis") + "</div>" +
      '<div class="t-chat"><div class="w-nav-h">Chat de la reunión</div>' +
      '<div class="t-m reveal" id="tM1"><b>Ana</b><span>Se entiende perfecto el resumen.</span></div>' +
      '<div class="t-m me reveal" id="tM2"><b>Alfredo</b><span>Aquí está la versión final.</span><div class="t-file"><span class="ik">' + I.ppt + '</span><div><b>Informe T3.pptx</b><span>Todos pueden editar · OneDrive</span></div><span class="ik">' + I.enlace + "</span></div></div>" +
      '<div class="t-m reveal" id="tM3"><b>Luis</b><span>Recibido, la reviso hoy.</span></div></div></aside></div>' +
      '<div class="t-toast reveal" id="tToast"><span class="ik">' + I.outlook + '</span><div><b>Outlook</b><span>Seguimiento enviado a 5 personas, con la liga</span></div></div></div></div>';
  }

  function heroHtml() {
    return '<section class="viaje-hero" id="ofHero"><span class="viaje-hero-eyebrow">Curso de Ofimática Básica</span>' +
      '<h1 class="viaje-hero-title">Aprende ofimática como un <span class="accent">Máster<span class="selector-box"><span class="selector-label">Título 1</span></span></span>.</h1>' +
      '<div class="viaje-hero-chips"><span class="scope-chip">Word · PowerPoint</span><span class="scope-chip">Outlook · Teams</span><span class="scope-chip">Microsoft 365</span></div>' +
      '<div class="viaje-hero-actions"><a href="#ofO" class="viaje-btn ghost" data-viaje-next>Baja para conocer el programa' + I.flecha + '</a><a href="#programas" class="viaje-btn solid">Ver programas' + I.flecha + "</a></div></section>";
  }

  function shellHtml() {
    const tabs = [["Comunicar", 1], ["Redactar", 2], ["Presentar", 3], ["Colaborar", 4]].map((t) => '<button type="button" class="bi-tab" data-scene="' + t[1] + '"><b>' + t[1] + "</b>" + t[0] + "</button>").join("");
    const rail = [["outlook", "Outlook", 1], ["word", "Word", 2], ["ppt", "PowerPoint", 3], ["teams", "Teams", 4]].map((r) => '<button type="button" class="bi-rv" data-v="' + r[0] + '" data-scene="' + r[2] + '" aria-label="' + r[1] + '">' + I[r[0]] + "<span>" + r[1] + "</span></button>").join("");
    const msgs = MSGS.map((m, i) => '<span class="bi-txt" id="ofMsg' + (i + 1) + '">' + m + '<span class="formula-msg-cursor"></span></span>').join("");
    return '<div class="bi-shell of-shell" id="ofShell">' +
      '<div class="bi-top"><div class="bi-file of-file"><span class="of-waffle">' + I.waffle + '</span><b id="ofApp">' + APPS[0] + '</b><span class="of-arch" id="ofArch">' + ARCHIVOS[0] + '</span><span class="of-nube" id="ofNube"><span class="ik">' + I.nube + '</span><span id="ofNubeT"></span></span></div>' +
      '<div class="bi-fx"><span class="bi-fx-ico">fx</span><div class="bi-fx-stack">' + msgs + "</div></div>" +
      '<a href="#programas" class="bi-ver">Ver programas' + I.flecha + "</a></div>" +
      '<div class="bi-rail">' + rail + "</div>" +
      '<div class="bi-steps" id="ofRail">' + tabs + '<span class="bi-status mono" id="ofEstado">' + ESTADOS[0] + "</span></div></div>";
  }

  function ctx(root, desk) {
    const $ = (s) => root.querySelector(s);
    const qa = (s) => Array.prototype.slice.call(root.querySelectorAll(s));
    return { $: $, qa: qa, desk: desk, msg: (i) => $("#ofMsg" + i) };
  }

  // =====================  TIMELINES  =====================
  function escO(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x;
    const rows = qa("#oList .o-row"), key = $('#oList .o-row[data-k="key"]'), otros = rows.filter((r) => r !== key);
    const rowOf = (k) => $('#oList .o-row[data-k="' + k + '"]');
    const noticias = qa("#oList .o-news");
    tl.fromTo($("#oWin"), { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 6 }, at(0));
    tipea(tl, R.msg(1), at(2), 10);
    tl.to(otros, { opacity: 1, duration: 3, stagger: 1.4 }, at(6));
    // llega el correo clave y empuja a los demás
    if (R.desk) tl.fromTo(otros, { y: -RH }, { y: 0, duration: 6 }, at(18));
    tl.fromTo(key, { opacity: 0 }, { opacity: 1, duration: 5 }, at(18));
    tl.to($("#oRead"), { opacity: 1, duration: 4 }, at(24));
    tipea(tl, $("#oB1"), at(27), 6); tipea(tl, $("#oB2"), at(33), 7); tipea(tl, $("#oB3"), at(40), 3);
    // categorías (glifo + texto, nunca solo color)
    tl.to(qa("#oList .o-cat, #oRead .o-cat"), { opacity: 1, duration: 3, stagger: 1.5 }, at(46));
    // regla: los boletines se van a su carpeta
    tl.to($("#oRule"), { opacity: 1, duration: 4 }, at(54));
    tl.to(noticias, { backgroundColor: HL, duration: 3 }, at(58));
    tl.to($("#oFBol"), { opacity: 1, duration: 3 }, at(60));
    if (R.desk) {
      tl.to(noticias, { opacity: 0, duration: 4 }, at(62));
      ORDEN.forEach((k, i) => {
        const n = ORDEN.slice(0, i).filter((x) => /^n\d$/.test(x)).length;
        if (n && !/^n\d$/.test(k)) tl.to(rowOf(k), { y: -n * RH, duration: 6 }, at(64));
      });
    } else tl.to(noticias, { opacity: 0, height: 0, duration: 6 }, at(62));
    tl.to(qa("#oFInbox .a, #oFBol .a"), { opacity: 0, duration: 4 }, at(64));
    tl.to(qa("#oFInbox .b, #oFBol .b"), { opacity: 1, duration: 4 }, at(64));
    // marcar para seguimiento y pasarlo al calendario
    tl.to(qa(".o-flag"), { opacity: 1, duration: 3 }, at(72));
    tl.to(qa("#oFSeg .a"), { opacity: 0, duration: 3 }, at(72));
    tl.to(qa("#oFSeg .b"), { opacity: 1, duration: 3 }, at(72));
    tl.fromTo($("#oCal"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 5 }, at(78));
  }

  function escW(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x;
    if (!R.desk) { tl.fromTo($("#wWin"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 6 }, at(0)); tl.to($("#wPage"), { opacity: 1, duration: 4 }, at(0)); }
    tipea(tl, R.msg(2), at(4), 10);
    // el texto del informe se escribe suelto, sin estilos
    tipea(tl, $("#wTt"), at(6), 4); tipea(tl, $("#wSub"), at(9), 3);
    [["wR", 10], ["wS", 22], ["wN", 34]].forEach((s) => { tipea(tl, $("#" + s[0] + "h"), at(s[1]), 3); tipea(tl, $("#" + s[0] + "p"), at(s[1] + 3), 9); });
    // estilos: los encabezados dejan de ser texto común
    const heads = qa("#wPage .w-h");
    tl.to($("#wStyleT1"), { backgroundColor: WSEL, borderColor: "#185abd", duration: 3 }, at(48));
    tl.to(heads, { fontSize: 15, color: "#0f1f3d", borderLeftWidth: 3, paddingLeft: 9, duration: 5, stagger: 2 }, at(50));
    tl.set(heads, { fontWeight: 700 }, at(52));
    // el documento se arma: franja de cifras, índice automático
    tl.to($("#wKpi"), { opacity: 1, duration: 5 }, at(58));
    tl.to($("#wBtnToc"), { backgroundColor: WSEL, borderColor: "#185abd", duration: 3 }, at(62));
    tl.to($("#wToc"), { opacity: 1, duration: 4 }, at(64));
    tl.to(qa("#wToc .tl"), { opacity: 1, duration: 3, stagger: 1.5 }, at(66));
    // panel de navegación
    tl.to($("#wNav"), { opacity: 1, duration: 4 }, at(68));
    tl.to(qa("#wNav .ni"), { opacity: 1, duration: 3, stagger: 1.5 }, at(70));
    // revisión: comentario, cambio y respuesta
    tl.fromTo($("#wC1"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 4 }, at(76));
    tl.to($("#wIns"), { opacity: 1, duration: 4 }, at(82));
    tl.fromTo($("#wC2"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 4 }, at(84));
  }

  function escP(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, wrap = $("#pWin");
    if (!R.desk) { tl.fromTo($("#pWin"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 6 }, at(0)); tl.to($("#pSlide"), { opacity: 1, duration: 4 }, at(0)); }
    tipea(tl, R.msg(3), at(4), 10);
    tl.to(qa("#pThumbs .p-th"), { opacity: 1, duration: 3, stagger: 2 }, at(6));
    tl.to($("#pDes"), { opacity: 1, duration: 4 }, at(14));
    // el Diseñador convierte la diapositiva llena en una clara
    const cur = $("#curP"), rip = $("#ripP"), idea = $("#pIdea2"), btn = $("#pBtnPres");
    const px = (el) => () => cen(el, wrap)[0] - 4, py = (el) => () => cen(el, wrap)[1] - 2;
    const clic = (el, t) => tl.fromTo(rip, { x: () => cen(el, wrap)[0] - 13, y: () => cen(el, wrap)[1] - 13, scale: 0, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 4, immediateRender: false }, t);
    tl.fromTo(cur, { opacity: 0, x: () => cen($("#pSlide"), wrap)[0], y: () => cen($("#pSlide"), wrap)[1] }, { opacity: 1, duration: 3, immediateRender: false }, at(18));
    tl.to(cur, { x: px(idea), y: py(idea), duration: 8 }, at(20));
    clic(idea, at(28));
    tl.to(idea, { borderColor: "#c43e1c", backgroundColor: "#fbe4dc", duration: 3 }, at(29));
    tl.to($("#pSlide .p-dense"), { opacity: 0, duration: 6 }, at(31));
    tl.to($("#pSlide .p-clean"), { opacity: 1, duration: 6 }, at(31));
    tl.to(qa("#pThumbs .p-th2 .a"), { opacity: 0, duration: 4 }, at(33));
    tl.to(qa("#pThumbs .p-th2 .b"), { opacity: 1, duration: 4 }, at(33));
    tl.fromTo(qa("#pSlide .p-clean .reveal"), { y: 12 }, { opacity: 1, y: 0, duration: 4, stagger: 2.5 }, at(38));
    // notas del orador
    tl.to($("#pNotes"), { opacity: 1, duration: 3 }, at(52));
    tipea(tl, $("#pNotesT"), at(54), 10);
    // presentar
    tl.to(cur, { x: px(btn), y: py(btn), duration: 8 }, at(66));
    clic(btn, at(74));
    tl.to($("#pSlide"), { scale: 1.08, duration: 6 }, at(76));
    tl.to(qa("#pThumbs, #pDes, #pNotes"), { opacity: 0.25, duration: 6 }, at(76));
    tl.to($("#pBadge"), { opacity: 1, duration: 3 }, at(78));
    if (!R.desk) tl.to(cur, { opacity: 0, duration: 3 }, at(82));
  }

  function escT(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x;
    if (!R.desk) { tl.fromTo($("#tWin"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 6 }, at(0)); tl.to($("#tShare"), { opacity: 1, duration: 4 }, at(0)); }
    tipea(tl, R.msg(4), at(4), 10);
    tl.to(qa("#ofT .t-cam, #ofT .t-tile"), { opacity: 1, duration: 3, stagger: 1.8 }, at(6));
    tl.to($("#tCtl"), { opacity: 1, duration: 4 }, at(10));
    // dos personas editan la diapositiva a la vez (cursor con su nombre)
    tl.to(["#tCoA", "#tCoL"].map((s) => $(s)), { opacity: 1, duration: 3, stagger: 3 }, at(16));
    tl.to($("#tCoA"), { left: "34%", top: "52%", duration: 10 }, at(18));
    tl.to($("#tCoA"), { left: "62%", top: "74%", duration: 10 }, at(32));
    tl.to($("#tCoL"), { left: "50%", top: "30%", duration: 10 }, at(24));
    tl.to($("#tCoL"), { left: "26%", top: "40%", duration: 10 }, at(40));
    tl.to($("#tM1"), { opacity: 1, duration: 3 }, at(30));
    tl.to($("#tM2"), { opacity: 1, duration: 4 }, at(46));
    tl.to($("#tM3"), { opacity: 1, duration: 3 }, at(62));
    // al final: la liga sale por correo (no un adjunto) y el ciclo se cierra
    tl.fromTo($("#tToast"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 5 }, at(74));
  }

  // =====================  CONTENIDO  =====================
  const Ofimatica = {
    renderHtml() {
      return '<div class="viaje-root bi-root of-root" id="viajeOfi">' + shellHtml() + heroHtml() +
        '<section class="bi-pin" id="ofPin"><div class="bi-canvas" id="ofCanvas">' + sceneO() + sceneW() + sceneP() + sceneT() + "</div></section></div>";
    },

    iniciar() {
      const root = document.getElementById("viajeOfi");
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
        const q = document.getElementById("ofO");
        if (q) window.scrollTo({ top: q.getBoundingClientRect().top + window.scrollY - (NAV + 8), behavior: "smooth" });
      });

      const { simple, telefono } = E.esSimpleMode();
      if (simple) { estadoFinal(root); return; }
      if (telefono) { root.classList.add("viaje-flujo", "bi-flujo", "viaje-movil"); flujo(root); ScrollTrigger.refresh(); window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true }); return; }

      gsap.registerPlugin(ScrollTrigger);
      const R = ctx(root, true), $ = R.$, qa = R.qa;
      const pin = $("#ofPin"), canvas = $("#ofCanvas");

      // ---- línea de tiempo maestra: cuatro actos y tres transiciones ----
      const m = gsap.timeline({ defaults: { ease: "power1.out" } });
      escO(m, S.o, R);
      // Outlook → Word: el correo (panel de lectura) se vuelve la página del informe
      m.to($("#oWin"), { opacity: 0, duration: 8 }, TR.ow + 2);
      morph(m, $("#oRead"), $("#wPage"), canvas, TR.ow, 16);
      m.fromTo($("#wWin"), { opacity: 0 }, { opacity: 1, duration: 8 }, TR.ow + 4);
      m.to(R.msg(1), { opacity: 0, duration: 6 }, TR.ow + 2);
      escW(m, S.w, R);
      // Word → PowerPoint: la página se vuelve la diapositiva
      m.to($("#wWin"), { opacity: 0, duration: 8 }, TR.wp + 2);
      morph(m, $("#wPage"), $("#pSlide"), canvas, TR.wp, 16);
      m.fromTo($("#pWin"), { opacity: 0 }, { opacity: 1, duration: 8 }, TR.wp + 4);
      m.to(R.msg(2), { opacity: 0, duration: 6 }, TR.wp + 2);
      escP(m, S.p, R);
      // PowerPoint → Teams: la diapositiva se vuelve la pantalla compartida
      m.to($("#pWin"), { opacity: 0, duration: 8 }, TR.pt + 2);
      m.to($("#curP"), { opacity: 0, duration: 3 }, TR.pt);
      morph(m, $("#pSlide"), $("#tShare"), canvas, TR.pt, 16, true);
      m.fromTo($("#tWin"), { opacity: 0 }, { opacity: 1, duration: 8 }, TR.pt + 4);
      m.to(R.msg(3), { opacity: 0, duration: 6 }, TR.pt + 2);
      escT(m, S.t, R);
      m.to({}, { duration: 1 }, TOTAL - 1);   // la duración total es exactamente TOTAL

      // ---- cáscara: riel/pestañas = actos; app, archivo, nube y estado cambian con la escena ----
      const tabs = qa(".bi-tab"), vistas = qa(".bi-rv");
      const app = $("#ofApp"), arch = $("#ofArch"), nube = $("#ofNube"), nubeT = $("#ofNubeT"), estado = $("#ofEstado");
      let activa = -1;
      function setActive(n) {
        if (n === activa) return;
        activa = n;
        tabs.forEach((t) => t.classList.toggle("active", t.dataset.scene === String(n)));
        vistas.forEach((t) => t.classList.toggle("active", t.dataset.v === RIEL[n]));
        app.textContent = APPS[n]; arch.textContent = ARCHIVOS[n]; estado.textContent = ESTADOS[n];
        nubeT.textContent = NUBES[n]; nube.classList.toggle("on", !!NUBES[n]);
      }
      setActive(0);

      const st = ScrollTrigger.create({
        trigger: pin, start: "top " + NAV + "px", end: "+=" + Math.round(TOTAL * 1.75) + "%", scrub: 1, pin: true, animation: m, invalidateOnRefresh: true,
        onUpdate: (self) => { const u = self.progress * TOTAL; setActive(u < UMBRAL[0] ? 1 : u < UMBRAL[1] ? 2 : u < UMBRAL[2] ? 3 : 4); },
      });
      ScrollTrigger.create({ trigger: $("#ofHero"), start: "top center", end: "bottom center", onToggle: (s) => s.isActive && setActive(0) });

      // scroll a un punto de la línea de tiempo (el pin mueve el layout: el ancla nativa no sirve)
      function irA(u) { window.scrollTo({ top: st.start + (st.end - st.start) * (u / TOTAL), behavior: "smooth" }); }
      tabs.concat(vistas).forEach((t) => t.addEventListener("click", () => irA(IR_A[t.dataset.scene])));
      if (siguiente) siguiente.addEventListener("click", () => irA(8));

      // la cáscara aparece a los 30 px de scroll y dura hasta el final del pin
      document.body.classList.add("bi-on");   // la cáscara y el layout comparten las reglas bi-* de viaje-bi.css
      ScrollTrigger.create({
        trigger: $("#ofHero"), start: () => "top " + (NAV - 30) + "px", end: () => st.end,
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
    root.querySelectorAll(".viaje-msg .formula-msg-text").forEach((el, i) => { el.id = "ofMsg" + (i + 1); });
    const R = ctx(root, false), K = 12;
    const una = (trigger, start) => gsap.timeline({ defaults: { ease: "power1.out" }, scrollTrigger: { trigger: trigger, start: start || "top 72%", once: true } });
    [["#ofO", escO], ["#ofW", escW], ["#ofP", escP], ["#ofT", escT]].forEach((e) => { const tl = una(e[0]); e[1](tl, 0, R); tl.timeScale(K); });
  }

  // estado final (reduced-motion o GSAP caído): todo visible, escenas apiladas
  function estadoFinal(root) {
    root.classList.add("viaje-simple", "viaje-flujo", "bi-flujo", "of-flujo", "of-final");
    const sh = root.querySelector(".bi-shell"); if (sh) sh.remove();
    root.querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
    root.querySelectorAll(".formula-msg-text, .cl").forEach((el) => { el.style.clipPath = "inset(0 0% 0 0)"; });
    root.querySelectorAll(".o-folders .xf .a, .p-th2 .a").forEach((el) => { el.style.opacity = 0; });
    root.querySelectorAll(".o-folders .xf .b, .p-th2 .b").forEach((el) => { el.style.opacity = 1; });
    root.querySelectorAll(".w-h").forEach((el) => { el.style.fontSize = "15px"; el.style.color = "#0f1f3d"; el.style.fontWeight = 700; el.style.borderLeftWidth = "3px"; el.style.paddingLeft = "9px"; });
  }

  window.ViajeEscenas.ofimatica = Ofimatica;
})();
