// assets/js/viaje-xl.js
// Viaje de Excel (scrollytelling GSAP) para cursos.html. Se registra en window.ViajeEscenas.excel (ver viaje.js: expone el
// motor compartido ViajeEngine con rel/cen/tipea/morph). Reconstruido el 2026-10-23 con el método de los demás viajes (el
// primero, de 2026-10-02, fue el más débil: cada escena inventaba sus datos y las macros eran 12 botones sueltos).
// Un solo libro, UN dato (las ventas del T3) que cruza las hojas, un lienzo de 1100×620 con UN pin y UNA línea de tiempo
// maestra:
//   Preparar (Datos: una exportación mala se limpia con Power Query y se vuelve una Tabla con fórmulas BUSCARX) →
//   Analizar (Análisis: tablas dinámicas + segmentación + matriz dinámica ÚNICOS) → Visualizar (Dashboard: gráficos →
//   tablero) → Automatizar (Macros SOBRE ESE MISMO dashboard: Actualizar, Tema, Evaluar, Enviar por correo, Descargar, con
//   el VBA de cada botón a un lado).
//
// Decisiones que NO hay que repetir si esto se toca:
//   - Acordado con Alfredo: 4 actos con las hojas del libro como pestañas; 5 macros (Actualizar, Tema claro/oscuro, Evaluar,
//     Enviar por correo, Descargar); Copilot fuera (el viaje de IA lo cubre) con solo un guiño de una línea al final;
//     matriz dinámica ÚNICOS/FILTRAR incluida.
//   - La ventana es Excel (barra verde, cinta con la pestaña activa, barra de fórmulas REAL con cuadro de nombres que
//     escribe la fórmula de cada acto, cuadrícula con letras y números). La cáscara oscura de siempre (mensajes fx, riel de
//     hojas, pestañas de hoja abajo) la rodea.
//   - Se traslapa a propósito con Power BI en la limpieza con Query: aquí es breve y la protagonista es la Tabla con sus
//     fórmulas; Power BI conserva la limpieza completa.
//   - Los valores del dashboard (KPI) son tweens con onUpdate (reversibles con el scroll) y los temas claro/oscuro son
//     variables CSS (--d-*) que GSAP interpola. El dashboard se encoge en el acto 4 (transform): los clics usan posiciones
//     VISUALES (cenV: getBoundingClientRect / escala del lienzo), no offsets.
//   - Móvil táctil: sin pin; las hojas se apilan con su etiqueta (+ el VBA completo). Estático: todo final (xl-final).
(function () {
  "use strict";
  const E = window.ViajeEngine;
  if (!E || !window.ViajeEscenas || !E.morph) return;
  const { rel, cen, tipea, morph } = E;

  // ---- constantes de la animación (unidades de la línea de tiempo maestra) ----
  const S = { d: 0, a: 108, v: 216, m: 324 };          // inicio de cada escena
  const TR = { da: 92, av: 200, vm: 308 };             // inicio de cada transición
  const TOTAL = 430;
  const UMBRAL = [100, 208, 316];                      // unidades donde cambia la escena activa
  const IR_A = { 1: 88, 2: 196, 3: 304, 4: 422 };      // a dónde aterriza cada pestaña (todo ya dibujado)

  const MSGS = [
    "Limpia, ordena y calcula: tus datos listos para trabajar.",
    "Convierte filas en respuestas con tablas dinámicas.",
    "Cuenta la historia: del gráfico al dashboard.",
    "Automatiza tu dashboard con un solo clic.",
  ];
  const HOJAS = ["", "Datos", "Análisis", "Dashboard", "Macros"];
  const ESTADOS = ["Ventas_T3.xlsm · 1 hoja", "Hoja Datos · 5 filas limpias", "Hoja Análisis · 1 tabla dinámica", "Hoja Dashboard · 3 gráficos", "Hoja Macros · 5 botones"];
  const RIEL = [null, "datos", "analisis", "dashboard", "macros"];
  const CELDAS = ["F2", "H2", "Gráfico 1", "Botón 5"];
  const PESTANAS = [3, 2, 2, 4];                       // pestaña de la cinta activa en cada acto (Archivo, Inicio, Insertar, Datos, Programador)

  // ---- íconos de línea (propios) ----
  const svg = (d, w) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const I = {
    flecha: svg('<path d="M12 5v14M5 12l7 7 7-7"/>', 2.2),
    check: svg('<path d="M5 13l4 4L19 7"/>', 3),
    excel: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 14.5h18M9 4v16M15 4v16"/>'),
    datos: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M9 4v16"/>'),
    analisis: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 4v16M10 14h11"/>'),
    dashboard: svg('<path d="M5 21V11M12 21V4M19 21v-8"/>'),
    macros: svg('<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M8 12h8"/>'),
    filtro: svg('<path d="M4 5h16l-6 7v6l-4-2v-4z"/>', 1.8),
    correo: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    clip: svg('<path d="M8 12.5l6.5-6.5a3.5 3.5 0 0 1 5 5L10.5 20a5.5 5.5 0 0 1-7.8-7.8L11 4"/>'),
    descargar: svg('<path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 19h16"/>', 1.9),
    actualizar: svg('<path d="M4 4v6h6M20 20v-6h-6M4.5 15a8 8 0 0 0 14.5 3.5M19.5 9a8 8 0 0 0-14.5-3.5"/>', 1.9),
    tema: svg('<path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36A5.5 5.5 0 0 1 12 3Z"/>', 1.8),
    evaluar: svg('<path d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10"/>', 1.9),
    cursor: '<svg class="cursor-ico reveal xl-cur no-final" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l15 7-6.2 1.6L11 17z"/></svg>',
  };
  const xf = (a, b, cls) => '<span class="xf ' + (cls || "") + '"><b class="a">' + a + '</b><b class="b">' + b + "</b></span>";

  function msgBloque(n) { return '<div class="viaje-msg"><div class="formula-msg"><span class="formula-msg-fx">fx</span><span class="formula-msg-text">' + MSGS[n - 1] + '<span class="formula-msg-cursor"></span></span></div></div>'; }

  // =====================  HOJA 1 · DATOS  =====================
  const SRC = [
    ["EXPORTACIÓN ERP — VENTAS", "", "", "", ""],
    null,
    ["fecha", "cliente", "producto", "region", "importe"],
    ["03/11/24", "acme", "Licencias Pro", "norte", "$ 182,400"],
    ["2024-11-04", "Delta ", "Soporte Anual", "CENTRO", "97100"],
    null,
    ["05/11/24", "Orbe", "Consultoría", "Norte", "N/A"],
    ["06/11/24", "Nova", "Diagnóstico", "sur", "42,300 "],
    ["07/11/24", "acme", "Licencias Pro", "Norte", "$ 95,200"],
    ["08/11/24", "Orbe", "Consultoría", "Norte", "120,300"],
  ];
  const MALAS = { "3,0": 1, "4,0": 1, "3,1": 1, "3,3": 1, "4,3": 1, "4,4": 1, "6,4": 1, "7,3": 1, "7,4": 1, "8,4": 1, "3,4": 1 };
  const LIMPIA = [
    ["03/11/24", "Acme", "Licencias Pro", "Norte", "$182,400", "Software", "$74,800"],
    ["04/11/24", "Delta", "Soporte Anual", "Centro", "$97,100", "Servicio", "$27,200"],
    ["06/11/24", "Nova", "Diagnóstico", "Sur", "$42,300", "Servicio", "$9,300"],
    ["07/11/24", "Acme", "Licencias Pro", "Norte", "$95,200", "Software", "$37,100"],
    ["08/11/24", "Orbe", "Consultoría", "Norte", "$120,300", "Servicio", "$42,100"],
  ];
  const PASOS_Q = ["Encabezados promovidos", "Filas vacías quitadas", "Texto limpio", "Importe como número", "Cargada en una Tabla"];

  function sceneD() {
    const srcRows = SRC.map((r, i) => r ? '<div class="xs-r reveal' + (i === 0 ? " xs-t" : i === 2 ? " xs-h" : "") + '">' + r.map((c, j) => '<span' + (MALAS[i + "," + j] ? ' class="xs-bad"' : "") + ">" + c + "</span>").join("") + "</div>" : '<div class="xs-r xs-e reveal"><span></span></div>').join("");
    const pasos = PASOS_Q.map((p) => '<div class="xq-st reveal"><i>' + I.check + "</i><span>" + p + "</span></div>").join("");
    const tr = (r) => '<div class="xt-r xt-d reveal">' + r.map((c, j) => "<span" + (j >= 5 ? ' class="xt-n reveal"' : "") + ">" + c + "</span>").join("") + "</div>";
    const cat = [["Licencias Pro", "Software"], ["Soporte Anual", "Servicio"], ["Consultoría", "Servicio"], ["Diagnóstico", "Servicio"]].map((c) => '<div class="xc-r"><span>' + c[0] + "</span><span>" + c[1] + "</span></div>").join("");
    return '<div class="xl-l" id="xSD"><span class="xl-lab">Datos</span>' + msgBloque(1) +
      '<div class="xs reveal" id="xSrc">' + srcRows + "</div>" +
      '<div class="xq reveal" id="xQ"><div class="xq-h"><span class="ik">' + I.actualizar + '</span>Obtener y transformar<em>Power Query</em></div>' + pasos + "</div>" +
      '<div class="xt reveal" id="xTbl"><div class="xt-r xt-h"><span>Fecha<i class="ik">' + I.filtro + '</i></span><span>Cliente<i class="ik">' + I.filtro + '</i></span><span>Producto<i class="ik">' + I.filtro + '</i></span><span>Región<i class="ik">' + I.filtro + '</i></span><span>Importe<i class="ik">' + I.filtro + '</i></span><span class="xt-n reveal">Categoría</span><span class="xt-n reveal">Margen</span></div>' + LIMPIA.map(tr).join("") + '<div class="xt-tag reveal">Tabla1</div></div>' +
      '<div class="xc reveal" id="xCat"><div class="xc-h">Catalogo</div><div class="xc-r xc-hh"><span>Producto</span><span>Categoría</span></div>' + cat + "</div></div>";
  }

  // =====================  HOJA 2 · ANÁLISIS  =====================
  const REG = [["Norte", [480, 210, 250, 110]], ["Centro", [260, 140, 150, 70]], ["Sur", [150, 110, 120, 50]], ["Noreste", [90, 80, 90, 40]]];
  const PROD = ["Licencias", "Soporte", "Consultoría", "Diagnóstico"];
  function sceneA() {
    const tot = (r) => r.reduce((a, b) => a + b, 0);
    const k = (n) => "$" + n.toLocaleString("en-US") + "k";
    const cab = '<div class="xp-r xp-h"><span class="xp-c">Suma de Importe</span>' + PROD.map((p) => "<span>" + p + "</span>").join("") + "<span>Total</span></div>";
    const filas = REG.map((r) => '<div class="xp-r xp-d reveal" data-r="' + r[0] + '"><span class="xp-c">' + r[0] + "</span>" + r[1].map((v) => "<span>" + k(v) + "</span>").join("") + "<span><b>" + k(tot(r[1])) + "</b></span></div>").join("");
    const colTot = PROD.map((p, j) => REG.reduce((s, r) => s + r[1][j], 0));
    const norte = REG[0][1];
    const total = '<div class="xp-r xp-t reveal"><span class="xp-c">Total general</span>' + colTot.map((v, j) => "<span>" + xf(k(v), k(norte[j])) + "</span>").join("") + "<span><b>" + xf("$2,400k", "$1,050k") + "</b></span></div>";
    const campos = ["Fecha", "Cliente", "Producto", "Región", "Importe", "Categoría", "Margen"].map((c) => '<div class="fg-c reveal' + (/^(Producto|Región|Importe)$/.test(c) ? " fg-m" : "") + '" id="fg' + c.slice(0, 3) + '"><i class="fg-k"></i>' + c + "</div>").join("");
    const area = (id, tit, chip) => '<div class="fa reveal" id="' + id + '"><b>' + tit + '</b><span class="fa-c reveal" id="' + id + 'C">' + chip + "</span></div>";
    const unicos = ["Acme", "Delta", "Nova", "Orbe"].map((c) => '<div class="sp-r reveal"><span>' + c + "</span></div>").join("");
    const sl = ["Norte", "Centro", "Sur", "Noreste"].map((n, i) => '<span class="sl-b' + (i === 0 ? " sl-0" : "") + '" id="slb' + i + '">' + n + "</span>").join("");
    return '<div class="xl-l" id="xSA"><span class="xl-lab">Análisis</span>' + msgBloque(2) +
      '<div class="xp reveal" id="xPv">' + cab + filas + total + "</div>" +
      '<div class="xsp reveal" id="xSp"><div class="sp-h"><b>=ÚNICOS(Tabla1[Cliente])</b></div>' + unicos + '<div class="sp-sp reveal">derrame</div></div>' +
      '<div class="xsl reveal" id="xSl"><div class="xsl-h"><span class="ik">' + I.filtro + "</span>Región</div>" + sl + "</div>" +
      '<div class="xfp reveal" id="xFld"><div class="xfp-h">Campos de tabla dinámica</div><div class="xfp-l">' + campos + '</div><div class="xfp-a">' + area("aFil", "Filas", "Región") + area("aCol", "Columnas", "Producto") + area("aVal", "Valores", "Suma de Importe") + "</div></div></div>";
  }

  // =====================  HOJA 3 · DASHBOARD (+ MACROS)  =====================
  const BARRAS = [["Norte", 100, 100, "#22c55e"], ["Centro", 59, 59, "#6b9fff"], ["Sur", 41, 41, "#dfb35a"], ["Noreste", 29, 29, "#a78bfa"]];
  const DONA = [["Licencias", 41, "#22c55e"], ["Consultoría", 25, "#6b9fff"], ["Soporte", 23, "#dfb35a"], ["Diagnóstico", 11, "#a78bfa"]];
  const MACROS = [["Actualizar", "actualizar"], ["Tema", "tema"], ["Evaluar", "evaluar"], ["Enviar por correo", "correo"], ["Descargar", "descargar"]];
  const VBA = [
    ["Sub Actualizar()", "    ActiveWorkbook.RefreshAll", "    Range(\"B1\") = Now", "End Sub"],
    ["Sub CambiarTema()", "    Hoja.Tema = Not Hoja.Tema", "    Call PintarTablero", "End Sub"],
    ["Sub EvaluarMetas()", "    If Margen < Meta Then", "        Icono = \"▼ Bajo meta\"", "    End If", "End Sub"],
    ["Sub EnviarCorreo()", "    Set o = CreateObject(\"Outlook.Application\")", "    o.CreateItem(0).Attachments.Add Libro", "End Sub"],
    ["Sub Descargar()", "    Hoja.ExportAsFixedFormat xlTypePDF,", "        \"Dashboard_T3.pdf\"", "End Sub"],
  ];
  function sceneV() {
    const bars = BARRAS.map((b) => '<div class="xb-c"><div class="xb-p"><i data-h="' + b[1] + '" data-hn="' + b[2] + '" style="background-color:' + b[3] + '"></i></div><span>' + b[0] + "</span></div>").join("");
    let acum = 0;
    const seg = DONA.map((d) => { const o = -acum; acum += d[1]; return '<circle class="seg" cx="21" cy="21" r="15.9155" fill="none" stroke="' + d[2] + '" stroke-width="5" data-p="' + d[1] + '" data-o="' + o + '" stroke-dasharray="0 100" stroke-dashoffset="' + o + '"/>'; }).join("");
    const leyenda = DONA.map((d) => '<li><i style="background-color:' + d[2] + '"></i>' + d[0] + "<b>" + d[1] + "%</b></li>").join("");
    const kpi = (id, lb, ev, evc) => '<div class="xd-k reveal"><span>' + lb + '</span><b id="' + id + '">—</b><em class="xd-ev reveal ' + evc + '">' + ev + "</em></div>";
    const chips = ["Todas", "Norte", "Centro", "Sur"].map((c, i) => '<span class="xd-sc' + (i === 0 ? " on" : "") + '" id="xsc' + i + '">' + c + "</span>").join("");
    const mb = MACROS.map((m, i) => '<span class="xd-b" id="mb' + i + '"><span class="ik">' + I[m[1]] + "</span>" + m[0] + "</span>").join("");
    const code = VBA.map((b, i) => '<div class="vb-b' + (i === 0 ? " vb-0" : "") + '" id="vb' + i + '">' + b.map(vbaLinea).join("") + "</div>").join("");
    return '<div class="xl-l" id="xSV"><span class="xl-lab">Dashboard</span>' + msgBloque(3) +
      '<div class="xd" id="xDash"><div class="xd-h reveal" id="xdH"><b>Ventas T3 · Dashboard</b><span class="xd-chips">' + chips + '</span><em class="xd-st reveal" id="xStamp">Actualizado 10:42</em></div>' +
      '<div class="xd-mb reveal" id="xMb">' + mb + "</div>" +
      '<div class="xd-ks">' + kpi("xkV", "Ventas", "▲ En meta", "ok") + kpi("xkG", "Crecimiento", "▲ En meta", "ok") + kpi("xkM", "Margen", "▼ Bajo meta (36%)", "bad") + "</div>" +
      '<div class="xd-cs"><div class="xd-ch reveal" id="xChB"><h5>Ventas por región</h5><div class="xb-bars">' + bars + '</div></div>' +
      '<div class="xd-ch reveal" id="xChL"><h5>Tendencia mensual</h5><svg viewBox="0 0 120 60" preserveAspectRatio="none"><path class="ar" d="M0,48 L20,40 L40,44 L60,26 L80,18 L100,10 L120,6 L120,60 L0,60Z" opacity="0"/><path class="ln" d="M0,48 L20,40 L40,44 L60,26 L80,18 L100,10 L120,6" fill="none" stroke="#22c55e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg></div>' +
      '<div class="xd-ch reveal" id="xChD"><h5>Por producto</h5><div class="xd-dn"><svg viewBox="0 0 42 42">' + seg + "</svg><ul>" + leyenda + "</ul></div></div></div>" +
      '<div class="xd-wk reveal" id="xWink">Siguiente nivel: pídeselo a Copilot</div></div>' +
      msgBloque(4) + '<aside class="xvba reveal" id="xVba"><div class="vb-t">Microsoft Visual Basic para Aplicaciones · Módulo1</div><div class="vb-body">' + code + "</div></aside>" +
      '<div class="xmail reveal no-final" id="xMail"><span class="ik">' + I.correo + '</span><div><b>Nuevo correo</b><span><i class="ik">' + I.clip + "</i>Dashboard_T3.xlsx</span></div></div>" +
      '<div class="xpdf reveal no-final" id="xPdf"><span class="ik">' + I.descargar + '</span><div><b>Dashboard_T3.pdf</b><div class="xpdf-b"><i></i></div></div></div>' +
      "</div>";
  }
  // colorea una línea de VBA (palabras clave en azul, cadenas en rojo oscuro) al estilo del editor
  function vbaLinea(l) {
    const e = l.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    // un solo pase: cadenas y palabras clave (si se colorean por separado, la segunda pasada pisa el HTML de la primera)
    return '<span class="vb-l">' + e.replace(/("[^"]*")|\b(Sub|End Sub|If|Then|End If|Set|Call|Not|Now)\b/g, (m, cad, kw) => cad ? '<i class="st">' + cad + "</i>" : '<i class="kw">' + kw + "</i>") + "</span>";
  }

  function heroHtml() {
    return '<section class="viaje-hero" id="xHero"><span class="viaje-hero-eyebrow">Curso de Excel</span>' +
      '<h1 class="viaje-hero-title">Aprende Excel como un <span class="accent">Máster<span class="selector-box"><span class="selector-label">A1</span></span></span>.</h1>' +
      '<div class="viaje-hero-chips"><span class="scope-chip">Versión 365</span><span class="scope-chip">Español e Inglés</span><span class="scope-chip">WPS / Google Sheets</span></div>' +
      '<div class="viaje-hero-actions"><a href="#xWin" class="viaje-btn ghost" data-viaje-next>Baja para conocer el programa' + I.flecha + '</a><a href="#programas" class="viaje-btn solid">Ver programas' + I.flecha + "</a></div></section>";
  }

  function shellHtml() {
    const tabs = HOJAS.slice(1).map((t, i) => '<button type="button" class="bi-tab xl-tab" data-scene="' + (i + 1) + '"><b>' + (i + 1) + "</b>" + t + "</button>").join("");
    const rail = [["datos", "Datos", 1], ["analisis", "Análisis", 2], ["dashboard", "Dashboard", 3], ["macros", "Macros", 4]].map((r) => '<button type="button" class="bi-rv" data-v="' + r[0] + '" data-scene="' + r[2] + '" aria-label="' + r[1] + '">' + I[r[0]] + "<span>" + r[1] + "</span></button>").join("");
    const msgs = MSGS.map((m, i) => '<span class="bi-txt" id="xMsg' + (i + 1) + '">' + m + '<span class="formula-msg-cursor"></span></span>').join("");
    return '<div class="bi-shell xl-shell" id="xShell">' +
      '<div class="bi-top"><div class="bi-file xl-file"><span class="xl-ico">' + I.excel + '</span><b>Ventas_T3.xlsm</b><span class="xl-sv">Guardado</span></div>' +
      '<div class="bi-fx"><span class="bi-fx-ico">fx</span><div class="bi-fx-stack">' + msgs + "</div></div>" +
      '<a href="#programas" class="bi-ver">Ver programas' + I.flecha + "</a></div>" +
      '<div class="bi-rail">' + rail + "</div>" +
      '<div class="bi-steps" id="xRail">' + tabs + '<span class="bi-status mono" id="xEstado">' + ESTADOS[0] + "</span></div></div>";
  }

  function ctx(root, desk) {
    const $ = (s) => root.querySelector(s);
    const qa = (s) => Array.prototype.slice.call(root.querySelectorAll(s));
    return { $: $, qa: qa, desk: desk, msg: (i) => $("#xMsg" + i) };
  }

  // =====================  TIMELINES  =====================
  const clic = (tl, rip, wrap, el, t, cenf) => tl.fromTo(rip, { x: () => (cenf || cen)(el, wrap)[0] - 13, y: () => (cenf || cen)(el, wrap)[1] - 13, scale: 0, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 4, immediateRender: false }, t);
  const hacia = (el, wrap, cenf) => ({ x: () => (cenf || cen)(el, wrap)[0] - 4, y: () => (cenf || cen)(el, wrap)[1] - 2 });
  // posición VISUAL (con transforms) en coordenadas del lienzo: para elementos dentro de un contenedor escalado
  function cenV(el, wrap) {
    const r = el.getBoundingClientRect(), w = wrap.getBoundingClientRect(), s = w.width / wrap.offsetWidth || 1;
    return [(r.left + r.width / 2 - w.left) / s, (r.top + r.height / 2 - w.top) / s];
  }
  // valor numérico que cuenta de un número a otro (reversible con el scroll)
  // fromTo (no to): varios tweens comparten el mismo número y, tras un refresh, un "to" tomaría como inicio el valor ya mutado
  function cuenta(tl, el, de, a, fmt, t, d) { const o = { v: de }; tl.fromTo(o, { v: de }, { v: a, duration: d || 8, ease: "power1.inOut", immediateRender: false, onUpdate: () => { el.textContent = o.v <= 0.001 ? "—" : fmt(o.v); } }, t); }
  const fmtV = (v) => "$" + v.toFixed(2) + "M", fmtG = (v) => "▲ " + Math.round(v) + "%", fmtM = (v) => Math.round(v) + "%";

  // la barra de fórmulas escribe la fórmula del acto; el cuadro de nombres y la pestaña de la cinta cambian
  function barra(tl, R, n, t, dur) {
    const { $, qa } = R;
    qa("#xFx .fx-t").forEach((el, i) => { if (i !== n - 1) tl.to(el, { opacity: 0, duration: 3 }, t); });
    qa("#xNm b").forEach((el, i) => tl.to(el, { opacity: i === n - 1 ? 1 : 0, duration: 3 }, t));
    qa("#xBar .xl-tabs span").forEach((el, i) => tl.to(el, { backgroundColor: i === PESTANAS[n - 1] ? "rgba(255,255,255,.26)" : "rgba(255,255,255,0)", duration: 3 }, t));
    tl.fromTo($("#xF" + n), { opacity: 1, clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: dur || 12, ease: "none" }, t + 3);
  }

  // 1 · PREPARAR: la exportación mala se limpia con Query y se vuelve una Tabla con fórmulas
  function escD(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x;
    tl.fromTo($("#xWin"), { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 6 }, at(0));
    tipea(tl, R.msg(1), at(2), 10);
    tl.to($("#xSrc"), { opacity: 1, duration: 3 }, at(5));
    tl.to(qa("#xSrc .xs-r"), { opacity: 1, duration: 2.5, stagger: 1.2 }, at(6));
    tl.to(qa("#xSrc .xs-bad"), { outlineColor: "#d13438", duration: 4, stagger: 0.4 }, at(20));
    tl.to($("#xQ"), { opacity: 1, duration: 4 }, at(26));
    const T = [29, 36, 43, 50, 57];
    qa("#xQ .xq-st").forEach((s, i) => { tl.fromTo(s, { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 3 }, at(T[i])); });
    // el rango sucio se vuelve una Tabla limpia
    tl.to($("#xSrc"), { opacity: 0, duration: 5 }, at(60));
    tl.to($("#xQ"), { opacity: 0, x: 24, duration: 6 }, at(64));
    tl.to($("#xTbl"), { opacity: 1, duration: 4 }, at(60));
    tl.to(qa("#xTbl .xt-d"), { opacity: 1, duration: 3, stagger: 1.5 }, at(62));
    tl.to($("#xTbl .xt-tag"), { opacity: 1, duration: 3 }, at(70));
    // fórmula BUSCARX contra el catálogo
    tl.to($("#xCat"), { opacity: 1, duration: 4 }, at(72));
    barra(tl, R, 1, at(72), 14);
    tl.to(qa("#xTbl .xt-h .xt-n"), { opacity: 1, duration: 3, stagger: 2 }, at(80));
    tl.to(qa("#xTbl .xt-d .xt-n"), { opacity: 1, duration: 3, stagger: 1 }, at(84));
  }

  // 2 · ANALIZAR: tabla dinámica con segmentación y matriz dinámica ÚNICOS
  function escA(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, hoja = $(".xl-sheet");
    if (!R.desk) tl.to($("#xPv"), { opacity: 1, duration: 4 }, at(0));
    tipea(tl, R.msg(2), at(2), 10);
    tl.to($("#xFld"), { opacity: 1, duration: 4 }, at(4));
    tl.to(qa("#xFld .fg-c"), { opacity: 1, duration: 3, stagger: 1.2 }, at(6));
    // arrastrar campos a las áreas
    const area = (id) => $("#" + id), chip = (id) => $("#" + id);
    tl.to(["#aFil", "#aCol", "#aVal"].map((s) => $(s)), { opacity: 1, duration: 4, stagger: 1.5 }, at(10));
    [["fgReg", "aFil", 16], ["fgPro", "aCol", 24], ["fgImp", "aVal", 32]].forEach((p) => {
      const c = $("#" + p[0]), dest = $("#" + p[1] + "C");
      if (R.desk) {
        tl.to(c, { x: () => rel(dest, hoja).x - rel(c, hoja).x, y: () => rel(dest, hoja).y - rel(c, hoja).y, duration: 6, ease: "power2.inOut" }, at(p[2]));
        tl.to(c, { opacity: 0, duration: 2 }, at(p[2] + 6));
      }
      tl.to(dest, { opacity: 1, duration: 3 }, at(p[2] + (R.desk ? 5 : 0)));
    });
    // la tabla dinámica se arma
    tl.to(qa("#xPv .xp-d"), { opacity: 1, duration: 3, stagger: 2.5 }, at(40));
    tl.to($("#xPv .xp-t"), { opacity: 1, duration: 3 }, at(52));
    // matriz dinámica: ÚNICOS se derrama sola
    tl.to($("#xSp"), { opacity: 1, duration: 4 }, at(58));
    barra(tl, R, 2, at(58), 12);
    tl.to(qa("#xSp .sp-r"), { opacity: 1, duration: 3, stagger: 3 }, at(72));
    tl.to($("#xSp .sp-sp"), { opacity: 1, duration: 3 }, at(84));
    // segmentación: Norte filtra la tabla dinámica
    tl.to($("#xSl"), { opacity: 1, duration: 4 }, at(62));
    if (R.desk) {
      const cur = $("#curX"), rip = $("#ripX"), norte = $("#slb0");
      tl.fromTo(cur, { opacity: 0, x: () => cen($("#xPv"), hoja)[0] + 80, y: () => cen($("#xPv"), hoja)[1] + 40 }, { opacity: 1, duration: 3, immediateRender: false }, at(68));
      tl.to(cur, Object.assign({ duration: 6 }, hacia(norte, hoja)), at(70));
      clic(tl, rip, hoja, norte, at(77));
      tl.to(norte, { backgroundColor: "#dff5ea", borderColor: "#107c41", color: "#0b5d33", duration: 3 }, at(78));
      tl.to(qa('#xPv .xp-d:not([data-r="Norte"])'), { opacity: 0.25, duration: 5 }, at(79));
      tl.to(qa("#xPv .xp-t .a"), { opacity: 0, duration: 4 }, at(80)); tl.to(qa("#xPv .xp-t .b"), { opacity: 1, duration: 4 }, at(80));
      tl.to(cur, { opacity: 0, duration: 3 }, at(84));
    }
  }

  // 3 · VISUALIZAR: los gráficos y el dashboard completo
  function escV(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x;
    if (!R.desk) { tl.to($("#xChB"), { opacity: 1, duration: 4 }, at(0)); }
    tipea(tl, R.msg(3), at(2), 10);
    tl.to($("#xdH"), { opacity: 1, duration: 4 }, at(4));
    barra(tl, R, 3, at(4), 14);
    // gráfico de barras (llega de la tabla dinámica), línea y dona
    tl.to(qa("#xChB .xb-p i"), { height: (i, el) => el.dataset.h + "%", duration: 8, stagger: 2 }, at(8));
    tl.to($("#xChL"), { opacity: 1, duration: 4 }, at(20));
    tl.to($("#xChL .ar"), { opacity: 0.18, duration: 8 }, at(30));
    tl.to($("#xChL .ln"), { attr: { "stroke-dashoffset": 0 }, duration: 12, ease: "none" }, at(22));
    tl.to($("#xChD"), { opacity: 1, duration: 4 }, at(34));
    qa("#xChD .seg").forEach((c, i) => tl.to(c, { attr: { "stroke-dasharray": c.dataset.p + " " + (100 - c.dataset.p) }, duration: 6 }, at(38 + i * 3)));
    // KPI
    tl.to(qa(".xd-k"), { opacity: 1, duration: 3, stagger: 2 }, at(46));
    cuenta(tl, $("#xkV"), 0, 2.4, fmtV, at(48)); cuenta(tl, $("#xkG"), 0, 18, fmtG, at(50)); cuenta(tl, $("#xkM"), 0, 34, fmtM, at(52));
    // segmentación: Norte mueve todo el dashboard a la vez, y vuelve a Todas
    if (R.desk) {
      const cur = $("#curX"), rip = $("#ripX"), hoja = $(".xl-sheet"), c1 = $("#xsc1"), c0 = $("#xsc0");
      const on = (el) => ({ backgroundColor: "#107c41", color: "#ffffff", borderColor: "#107c41" }), off = { backgroundColor: "rgba(255,255,255,.14)", color: "#ffffff", borderColor: "rgba(255,255,255,.35)" };
      tl.fromTo(cur, { opacity: 0, x: () => cen($("#xDash"), hoja)[0], y: () => cen($("#xDash"), hoja)[1] }, { opacity: 1, duration: 3, immediateRender: false }, at(60));
      tl.to(cur, Object.assign({ duration: 6 }, hacia(c1, hoja)), at(62));
      clic(tl, rip, hoja, c1, at(69));
      tl.to(c1, on(c1), at(70)); tl.to(c0, off, at(70));
      cuenta(tl, $("#xkV"), 2.4, 1.05, fmtV, at(71)); cuenta(tl, $("#xkG"), 18, 24, fmtG, at(71)); cuenta(tl, $("#xkM"), 34, 38, fmtM, at(71));
      tl.to(qa("#xChB .xb-p i"), { height: (i, el) => el.dataset.hn + "%", duration: 6 }, at(71));
      tl.to(qa("#xChB .xb-c:not(:first-child) i"), { opacity: 0.25, duration: 5 }, at(71));
      tl.to(cur, Object.assign({ duration: 6 }, hacia(c0, hoja)), at(78));
      clic(tl, rip, hoja, c0, at(85));
      tl.to(c0, on(c0), at(86)); tl.to(c1, off, at(86));
      cuenta(tl, $("#xkV"), 1.05, 2.4, fmtV, at(87)); cuenta(tl, $("#xkG"), 24, 18, fmtG, at(87)); cuenta(tl, $("#xkM"), 38, 34, fmtM, at(87));
      tl.to(qa("#xChB .xb-p i"), { height: (i, el) => el.dataset.h + "%", duration: 5 }, at(87));
      tl.to(qa("#xChB .xb-c:not(:first-child) i"), { opacity: 1, duration: 4 }, at(87));
      tl.to(cur, { opacity: 0, duration: 3 }, at(91));
    }
  }

  // 4 · AUTOMATIZAR: cinco macros sobre el mismo dashboard, con su VBA a un lado
  function escM(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, hoja = $(".xl-sheet"), dash = $("#xDash");
    if (!R.desk) { tl.to($("#xMb"), { opacity: 1, duration: 4 }, at(0)); tl.to($("#xVba"), { opacity: 1, duration: 4 }, at(0)); }
    tipea(tl, R.msg(4), at(2), 10);
    barra(tl, R, 4, at(2), 10);
    if (!R.desk) { tl.to($("#xWink"), { opacity: 1, duration: 4 }, at(40)); return; }
    const cur = $("#curX"), rip = $("#ripX");
    const bloque = (n, t) => qa("#xVba .vb-b").forEach((el, i) => tl.to(el, { opacity: i === n ? 1 : 0, duration: 3 }, t));
    const vc = (el) => cenV(el, hoja);
    tl.fromTo(cur, { opacity: 0, x: () => cen($("#xVba"), hoja)[0], y: () => cen($("#xVba"), hoja)[1] }, { opacity: 1, duration: 3, immediateRender: false }, at(6));
    const pulsa = (n, t) => { const btn = $("#mb" + n); tl.to(cur, Object.assign({ duration: 6 }, hacia(btn, hoja, vc)), t - 8); clic(tl, rip, hoja, btn, t, vc); tl.to(btn, { backgroundColor: "#0b5d33", color: "#ffffff", duration: 3 }, t + 1); tl.to(btn, { backgroundColor: "#ffffff", color: "#0b5d33", duration: 4 }, t + 6); bloque(n, t + 1); };
    // 1 · Actualizar
    pulsa(0, at(14));
    cuenta(tl, $("#xkV"), 2.4, 2.58, fmtV, at(16)); cuenta(tl, $("#xkG"), 18, 21, fmtG, at(16)); cuenta(tl, $("#xkM"), 34, 35, fmtM, at(16));
    tl.to($("#xStamp"), { opacity: 1, duration: 3 }, at(18));
    // 2 · Tema claro/oscuro: el dashboard se voltea (variables --d-*)
    pulsa(1, at(28));
    tl.to(dash, { "--d-bg": "rgb(15,20,28)", "--d-card": "rgb(24,32,44)", "--d-tx": "rgb(237,240,244)", "--d-mut": "rgb(139,148,163)", "--d-line": "rgb(38,48,63)", duration: 6 }, at(30));
    // 3 · Evaluar: semáforos contra las metas (ícono + texto)
    pulsa(2, at(42));
    tl.to(qa(".xd-ev"), { opacity: 1, duration: 3, stagger: 2 }, at(44));
    // 4 · Enviar por correo: sale el dashboard adjunto
    pulsa(3, at(56));
    tl.fromTo($("#xMail"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 4 }, at(58));
    tl.to($("#xMail"), { x: 160, y: -40, opacity: 0, duration: 7, ease: "power2.in" }, at(64));
    // 5 · Descargar: se exporta a PDF
    pulsa(4, at(70));
    tl.fromTo($("#xPdf"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 4 }, at(72));
    tl.fromTo($("#xPdf .xpdf-b i"), { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 8, ease: "none" }, at(74));
    tl.to(cur, { opacity: 0, duration: 3 }, at(80));
    tl.to($("#xWink"), { opacity: 1, duration: 5 }, at(84));
  }

  // =====================  CONTENIDO  =====================
  const XL = {
    renderHtml() {
      const tabsC = ["Archivo", "Inicio", "Insertar", "Datos", "Programador"].map((t) => "<span>" + t + "</span>").join("");
      const fx = [1, 2, 3, 4].map((n) => '<span class="fx-t" id="xF' + n + '"></span>').join("");
      const letras = "ABCDEFGHIJKL".split("").map((c) => "<i>" + c + "</i>").join("");
      const nombres = CELDAS.map((c, i) => "<b" + (i === 0 ? ' style="opacity:1"' : "") + ">" + c + "</b>").join("");
      const sheet = sceneD() + sceneA() + sceneV();
      return '<div class="viaje-root bi-root xl-root" id="viajeXL">' + shellHtml() + heroHtml() +
        '<section class="bi-pin" id="xPin"><div class="bi-canvas" id="xCanvas">' +
        '<div class="xl-win reveal" id="xWin">' +
        '<div class="xl-bar" id="xBar"><span class="xl-bi">' + I.excel + '</span><b>Excel</b><span class="xl-fn">Ventas_T3.xlsm</span><div class="xl-tabs">' + tabsC + '</div><span class="xl-cp">Compartir</span></div>' +
        '<div class="xl-fxb" id="xFx"><span class="xl-nm" id="xNm">' + nombres + '</span><span class="xl-fxi">fx</span><div class="fx-w">' + fx + "</div></div>" +
        '<div class="xl-sheet"><div class="xl-cols"><span></span>' + letras + '</div><div class="xl-rows">' + Array(18).fill(0).map((_, i) => "<i>" + (i + 1) + "</i>").join("") + "</div>" +
        '<div class="xl-ar">' + sheet + "</div>" +
        I.cursor.replace('class="', 'id="curX" class="') + '<div class="click-ripple" id="ripX"></div></div></div>' +
        "</div></section></div>";
    },

    iniciar() {
      const root = document.getElementById("viajeXL");
      if (!root) return;
      const NAV = E.navOffset(root);
      document.documentElement.style.setProperty("--viaje-nav-h", NAV + "px");
      // las fórmulas de cada acto (la barra de fórmulas las "escribe")
      const FORMULAS = ["=BUSCARX([@Producto];Catalogo[Producto];Catalogo[Categoría])", "=ÚNICOS(Tabla1[Cliente])", "=SUMAR.SI.CONJUNTO(Tabla1[Importe];Tabla1[Región];\"Norte\")", "Macro asignada: ActualizarTodo"];
      FORMULAS.forEach((f, i) => { const el = root.querySelector("#xF" + (i + 1)); if (el) el.textContent = f; });

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
        const q = document.getElementById("xWin");
        if (q) window.scrollTo({ top: q.getBoundingClientRect().top + window.scrollY - (NAV + 8), behavior: "smooth" });
      });

      const { simple, telefono } = E.esSimpleMode();
      if (simple) { estadoFinal(root); return; }
      if (telefono) { root.classList.add("viaje-flujo", "bi-flujo", "viaje-movil"); flujo(root); ScrollTrigger.refresh(); window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true }); return; }

      gsap.registerPlugin(ScrollTrigger);
      const R = ctx(root, true), $ = R.$, qa = R.qa;
      const pin = $("#xPin"), canvas = $("#xCanvas"), hoja = $(".xl-sheet"), caps = qa(".xl-l");

      // ---- línea de tiempo maestra: el libro recorre cuatro hojas y tres transiciones ----
      const m = gsap.timeline({ defaults: { ease: "power1.out" } });
      m.set(caps[1], { opacity: 0 }, 0); m.set(caps[2], { opacity: 0 }, 0);
      escD(m, S.d, R);
      // Datos → Análisis: la Tabla se vuelve la tabla dinámica
      m.to(caps[0], { opacity: 0, duration: 8 }, TR.da + 8);
      m.set(caps[1], { opacity: 1 }, TR.da);
      morph(m, $("#xTbl"), $("#xPv"), $(".xl-ar"), TR.da, 16, true);
      m.to(R.msg(1), { opacity: 0, duration: 6 }, TR.da + 2);
      escA(m, S.a, R);
      // Análisis → Dashboard: la tabla dinámica se vuelve el primer gráfico
      m.set(caps[2], { opacity: 1 }, TR.av);
      m.to(caps[1], { opacity: 0, duration: 8 }, TR.av + 8);
      morph(m, $("#xPv"), $("#xChB"), $(".xl-ar"), TR.av, 16, true);
      m.to(R.msg(2), { opacity: 0, duration: 6 }, TR.av + 2);
      escV(m, S.v, R);
      // Dashboard → Macros: el dashboard se encoge y entra el editor de VBA con la barra de botones
      m.to($("#xDash"), { scale: 0.7, duration: 14, ease: "power2.inOut" }, TR.vm);
      m.to($("#xMb"), { opacity: 1, duration: 8 }, TR.vm + 6);
      m.to(R.msg(3), { opacity: 0, duration: 6 }, TR.vm + 2);
      m.fromTo($("#xVba"), { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 12 }, TR.vm);
      escM(m, S.m, R);
      m.to({}, { duration: 1 }, TOTAL - 1);   // la duración total es exactamente TOTAL

      // ---- cáscara: riel/pestañas = hojas; el estado cambia con la escena ----
      const tabs = qa(".xl-tab"), vistas = qa(".bi-rv"), estado = $("#xEstado");
      let activa = -1;
      function setActive(n) {
        if (n === activa) return;
        activa = n;
        tabs.forEach((t) => t.classList.toggle("active", t.dataset.scene === String(n)));
        vistas.forEach((t) => t.classList.toggle("active", t.dataset.v === RIEL[n]));
        estado.textContent = ESTADOS[n];
      }
      setActive(0);

      const st = ScrollTrigger.create({
        trigger: pin, start: "top " + NAV + "px", end: "+=" + Math.round(TOTAL * 1.75) + "%", scrub: 1, pin: true, animation: m, invalidateOnRefresh: true,
        onUpdate: (self) => { const u = self.progress * TOTAL; setActive(u < UMBRAL[0] ? 1 : u < UMBRAL[1] ? 2 : u < UMBRAL[2] ? 3 : 4); },
      });
      ScrollTrigger.create({ trigger: $("#xHero"), start: "top center", end: "bottom center", onToggle: (s) => s.isActive && setActive(0) });

      // scroll a un punto de la línea de tiempo (el pin mueve el layout: el ancla nativa no sirve)
      function irA(u) { window.scrollTo({ top: st.start + (st.end - st.start) * (u / TOTAL), behavior: "smooth" }); }
      tabs.concat(vistas).forEach((t) => t.addEventListener("click", () => irA(IR_A[t.dataset.scene])));
      if (siguiente) siguiente.addEventListener("click", () => irA(8));

      // la cáscara aparece a los 30 px de scroll y dura hasta el final del pin
      document.body.classList.add("bi-on");
      ScrollTrigger.create({
        trigger: $("#xHero"), start: () => "top " + (NAV - 30) + "px", end: () => st.end,
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

  // TELÉFONO: sin pin ni lienzo fijo. Las hojas se apilan con su etiqueta y cada una corre su animación UNA vez al entrar.
  function flujo(root) {
    gsap.registerPlugin(ScrollTrigger);
    const sh = root.querySelector(".bi-shell"); if (sh) sh.remove();
    root.querySelectorAll(".viaje-msg .formula-msg-text").forEach((el, i) => { el.id = "xMsg" + (i + 1); });
    const R = ctx(root, false), K = 12;
    const una = (trigger, start) => gsap.timeline({ defaults: { ease: "power1.out" }, scrollTrigger: { trigger: trigger, start: start || "top 72%", once: true } });
    [["#xSD", escD], ["#xSA", escA], ["#xSV", escV], ["#xVba", escM]].forEach((e) => { const tl = una(e[0]); e[1](tl, 0, R); tl.timeScale(K); });
  }

  // estado final (reduced-motion o GSAP caído): todo visible, hojas apiladas
  function estadoFinal(root) {
    root.classList.add("viaje-simple", "viaje-flujo", "bi-flujo", "xl-flujo", "xl-final");
    const sh = root.querySelector(".bi-shell"); if (sh) sh.remove();
    root.querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
    root.querySelectorAll(".formula-msg-text, .cl").forEach((el) => { el.style.clipPath = "inset(0 0% 0 0)"; });
    root.querySelectorAll("#xSrc, #xQ").forEach((el) => { el.style.opacity = 1; });
    root.querySelectorAll(".xb-p i").forEach((el) => { el.style.height = el.dataset.h + "%"; });
    root.querySelectorAll(".seg").forEach((c) => { c.setAttribute("stroke-dasharray", c.dataset.p + " " + (100 - c.dataset.p)); });
    const ln = root.querySelector("#xChL .ln"); if (ln) ln.setAttribute("stroke-dashoffset", 0);
    const ar = root.querySelector("#xChL .ar"); if (ar) ar.setAttribute("opacity", 0.18);
    [["#xkV", "$2.40M"], ["#xkG", "▲ 18%"], ["#xkM", "34%"]].forEach((p) => { const el = root.querySelector(p[0]); if (el) el.textContent = p[1]; });
    root.querySelectorAll("#xPv .xp-t .a, #xTbl .xt-tag").forEach((el) => { el.style.opacity = el.classList.contains("a") ? 0 : 1; });
    root.querySelectorAll("#xPv .xp-t .b").forEach((el) => { el.style.opacity = 1; });
    root.querySelectorAll(".xt-n").forEach((el) => { el.style.opacity = 1; });
    root.querySelectorAll("#xF1, #xF2, #xF3, #xF4").forEach((el) => { el.style.clipPath = "inset(0 0% 0 0)"; });
  }

  window.ViajeEscenas.excel = XL;
})();
