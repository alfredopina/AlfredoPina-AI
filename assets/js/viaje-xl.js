// assets/js/viaje-xl.js
// Viaje de Excel (scrollytelling GSAP) para cursos.html. Se registra en window.ViajeEscenas.excel (ver viaje.js: expone el
// motor compartido ViajeEngine con rel/cen/tipea/morph). Reconstruido el 2026-10-23 con el método de los demás viajes y
// rehecho esa misma tarde por pedido de Alfredo ("el dashboard está muy de kinder"): tema OSCURO, una base más grande y
// más sucia, una tabla dinámica con diseño (mapa de calor, barras de datos) y un dashboard completo (segmentaciones,
// KPI con crecimientos, tabla de KPI, consulta de imagen con IMAGEN()) cuyas macros las GENERA COPILOT.
// Un solo libro, UN dato (las ventas del T3) que cruza las hojas, un lienzo de 1100×620 con UN pin y UNA línea de tiempo:
//   Preparar (Datos: una exportación del ERP muy sucia se limpia con Power Query y se vuelve una Tabla con BUSCARX) →
//   Analizar (Análisis: tabla dinámica con mapa de calor + segmentación + matriz dinámica ÚNICOS) → Visualizar
//   (Dashboard: segmentaciones, KPI, gráficos, tabla de KPI y ficha de producto con imagen) → Automatizar (Macros: el
//   panel de Copilot escribe el VBA de cada botón y el botón actúa SOBRE ESE MISMO dashboard).
//
// Decisiones que NO hay que repetir si esto se toca:
//   - Acordado con Alfredo: 4 actos con las hojas del libro como pestañas; 5 macros (Actualizar, Tema, Evaluar, Enviar por
//     correo, Descargar), todas pedidas a Copilot; matriz dinámica ÚNICOS incluida; tema oscuro. Copilot ya NO es un guiño:
//     es el motor del acto 4 ("Automatiza desde Copilot").
//   - La ventana es Excel en oscuro (barra verde, cinta con la pestaña activa, barra de fórmulas REAL con cuadro de nombres
//     que escribe la fórmula de cada acto, cuadrícula con letras y números). La cáscara oscura de siempre la rodea.
//   - Se traslapa a propósito con Power BI en la limpieza con Query: aquí la protagonista es la Tabla con sus fórmulas.
//   - Los valores del dashboard son tweens con onUpdate y FROMTO (con "to", tras un refresh de ScrollTrigger tomaban como
//     inicio el valor ya mutado); el tema claro/oscuro del dashboard son variables CSS --d-* en rgb() que GSAP interpola.
//     El dashboard se encoge en el acto 4: los clics usan posiciones VISUALES (cenV), no offsets.
//   - Móvil táctil: sin pin; las hojas se apilan con su etiqueta (+ el chat de Copilot completo). Estático: xl-final.
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
    "Pídele a Copilot las macros y automatiza tu dashboard.",
  ];
  const HOJAS = ["", "Datos", "Análisis", "Dashboard", "Macros"];
  const ESTADOS = ["Ventas_T3.xlsm · 1 hoja", "Hoja Datos · 8 filas limpias", "Hoja Análisis · 1 tabla dinámica", "Hoja Dashboard · 4 KPI · 3 gráficos", "Hoja Macros · 5 macros con Copilot"];
  const RIEL = [null, "datos", "analisis", "dashboard", "macros"];
  const CELDAS = ["I2", "H2", "Imagen 1", "Botón 5"];
  const PESTANAS = [3, 2, 2, 5];                       // pestaña de la cinta activa en cada acto (Archivo, Inicio, Insertar, Datos, Programador, Copilot)
  const FORMULAS = ["=BUSCARX([@Producto];Catalogo[Producto];Catalogo[Categoría])", "=ÚNICOS(Tabla1[Cliente])", "=IMAGEN(BUSCARX([@Producto];Catalogo[Producto];Catalogo[Imagen]))", "Copilot › macro asignada: ActualizarTodo"];

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
    chispa: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>', 1.6),
    cursor: '<svg class="cursor-ico reveal xl-cur no-final" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l15 7-6.2 1.6L11 17z"/></svg>',
  };
  const xf = (a, b, cls) => '<span class="xf ' + (cls || "") + '"><b class="a">' + a + '</b><b class="b">' + b + "</b></span>";

  function msgBloque(n) { return '<div class="viaje-msg"><div class="formula-msg"><span class="formula-msg-fx">fx</span><span class="formula-msg-text">' + MSGS[n - 1] + '<span class="formula-msg-cursor"></span></span></div></div>'; }

  // =====================  HOJA 1 · DATOS  =====================
  // una exportación realmente fea: título, filas vacías, subtotales y paginado de basura, duplicados, fechas en 3 formatos,
  // mayúsculas/minúsculas mezcladas, espacios al final, números como texto, errores (N/A, s/d) y una devolución en paréntesis
  const SRC = [
    ["REPORTE VENTAS ERP (exportado 03/11)", "", "", "", "", "", ""],
    null,
    ["Fecha ", "CLIENTE", "producto", "Región", "vendedor", "unid.", "IMPORTE"],
    ["03/11/24", "acme", "Licencias Pro", "norte", "juan p.", "12", "$ 182,400"],
    ["2024-11-04", "ACME S.A. ", "Soporte Anual", "Norte", "Juan Pérez", "3", "97100"],
    null,
    ["Nov 5", "Delta", "Consultoría", "CENTRO", "maría l", "N/A", "120,300"],
    ["06/11/24", "delta", "Consultoria", "Centro", "María López", "8", "(1,200)"],
    ["07/11/24", "Nova ", "Diagnóstico", "sur", "luis r.", "5", "42,300 "],
    ["Subtotal Norte", "", "", "", "", "", "$ 279,500"],
    ["07/11/24", "Nova ", "Diagnóstico", "sur", "luis r.", "5", "42,300 "],
    ["08/11/24", "Orbe", "Licencias Pro", "Nte", "juan p.", "12", "s/d"],
    ["09/11/24", "orbe ", "Soporte Anual", "norte", "Juan Pérez", "2", "$ 54,900"],
    ["Página 1 de 3", "", "", "", "", "", ""],
    ["10/11/24", "Zeta", "Consultoría", "Sur", "luis r.", "4", "95,200"],
    ["11/11/24", "acme", "Licencias Pro", "NORTE", "juan p.", "10", "$ 148,900"],
  ];
  const esMala = (t, i) => i !== 0 && t !== "" && (/\s$/.test(t) || /^[a-záéíóúñ]/.test(t) || /N\/A|s\/d|^\(|^Subtotal|^Página|^Nov|^Nte$|^\d{4}-/.test(t) || /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .]{3,}$/.test(t.trim()));
  const LIMPIA = [
    ["03/11/24", "Acme", "Licencias Pro", "Norte", "Juan Pérez", "12", "$182,400", "Software", "$74,800"],
    ["04/11/24", "Acme", "Soporte Anual", "Norte", "Juan Pérez", "3", "$97,100", "Servicio", "$27,200"],
    ["05/11/24", "Delta", "Consultoría", "Centro", "María López", "0", "$120,300", "Servicio", "$42,100"],
    ["06/11/24", "Delta", "Consultoría", "Centro", "María López", "8", "-$1,200", "Servicio", "-$400"],
    ["07/11/24", "Nova", "Diagnóstico", "Sur", "Luis Ramos", "5", "$42,300", "Servicio", "$9,300"],
    ["09/11/24", "Orbe", "Soporte Anual", "Norte", "Juan Pérez", "2", "$54,900", "Servicio", "$15,400"],
    ["10/11/24", "Zeta", "Consultoría", "Sur", "Luis Ramos", "4", "$95,200", "Servicio", "$33,300"],
    ["11/11/24", "Acme", "Licencias Pro", "Norte", "Juan Pérez", "10", "$148,900", "Software", "$61,000"],
  ];
  const PASOS_Q = ["Encabezados promovidos", "Filas vacías y basura quitadas", "Duplicados quitados", "Texto limpio (mayúsculas y espacios)", "Fechas en un solo formato", "Importe como número (errores fuera)", "Cargada en una Tabla"];

  function sceneD() {
    const srcRows = SRC.map((r, i) => r ? '<div class="xs-r reveal' + (i === 0 ? " xs-t" : i === 2 ? " xs-h" : "") + '">' + r.map((c) => "<span" + (esMala(c, i) ? ' class="xs-bad"' : "") + ">" + c + "</span>").join("") + "</div>" : '<div class="xs-r xs-e reveal"><span></span></div>').join("");
    const pasos = PASOS_Q.map((p) => '<div class="xq-st reveal"><i>' + I.check + "</i><span>" + p + "</span></div>").join("");
    const tr = (r) => '<div class="xt-r xt-d reveal">' + r.map((c, j) => "<span" + (j >= 7 ? ' class="xt-n reveal"' : "") + ">" + c + "</span>").join("") + "</div>";
    const cab = ["Fecha", "Cliente", "Producto", "Región", "Vendedor", "Unid.", "Importe"].map((c) => "<span>" + c + '<i class="ik">' + I.filtro + "</i></span>").join("") + '<span class="xt-n reveal">Categoría</span><span class="xt-n reveal">Margen</span>';
    const cat = [["Licencias Pro", "Software"], ["Soporte Anual", "Servicio"], ["Consultoría", "Servicio"], ["Diagnóstico", "Servicio"]].map((c) => '<div class="xc-r"><span>' + c[0] + "</span><span>" + c[1] + "</span></div>").join("");
    return '<div class="xl-l" id="xSD"><span class="xl-lab">Datos</span>' + msgBloque(1) +
      '<div class="xs reveal" id="xSrc">' + srcRows + "</div>" +
      '<div class="xq reveal" id="xQ"><div class="xq-h"><span class="ik">' + I.actualizar + '</span>Obtener y transformar<em>Power Query</em></div>' + pasos + "</div>" +
      '<div class="xt reveal" id="xTbl"><div class="xt-r xt-h">' + cab + "</div>" + LIMPIA.map(tr).join("") + '<div class="xt-tag reveal">Tabla1</div></div>' +
      '<div class="xc reveal" id="xCat"><div class="xc-h">Catalogo</div><div class="xc-r xc-hh"><span>Producto</span><span>Categoría</span></div>' + cat + "</div></div>";
  }

  // =====================  HOJA 2 · ANÁLISIS  =====================
  const REG = [["Norte", [480, 210, 250, 110], "#22c55e"], ["Centro", [260, 140, 150, 70], "#6b9fff"], ["Sur", [150, 110, 120, 50], "#dfb35a"], ["Noreste", [90, 80, 90, 40], "#a78bfa"]];
  const PROD = ["Licencias", "Soporte", "Consultoría", "Diagnóstico"];
  function sceneA() {
    const tot = (r) => r.reduce((a, b) => a + b, 0);
    const k = (n) => "$" + n.toLocaleString("en-US") + "k";
    const cab = '<div class="xp-r xp-h"><span class="xp-c">Región</span>' + PROD.map((p) => "<span>" + p + "</span>").join("") + "<span>Total</span><span>% del total</span></div>";
    const filas = REG.map((r) => '<div class="xp-r xp-d reveal" data-r="' + r[0] + '"><span class="xp-c"><i style="background-color:' + r[2] + '"></i>' + r[0] + "</span>" +
      r[1].map((v) => '<span class="xp-v" style="background-color:rgba(34,197,94,' + (0.06 + 0.5 * v / 480).toFixed(2) + ')">' + k(v) + "</span>").join("") +
      '<span class="xp-tt"><i style="width:' + Math.round(tot(r[1]) / 1050 * 100) + '%"></i><b>' + k(tot(r[1])) + "</b></span><span>" + Math.round(tot(r[1]) / 24) + "%</span></div>").join("");
    const colTot = PROD.map((p, j) => REG.reduce((s, r) => s + r[1][j], 0));
    const norte = REG[0][1];
    const total = '<div class="xp-r xp-t reveal"><span class="xp-c">Total general</span>' + colTot.map((v, j) => "<span>" + xf(k(v), k(norte[j])) + "</span>").join("") + "<span><b>" + xf("$2,400k", "$1,050k") + "</b></span><span>" + xf("100%", "44%") + "</span></div>";
    const campos = ["Fecha", "Cliente", "Producto", "Región", "Vendedor", "Unid.", "Importe", "Categoría", "Margen"].map((c) => '<div class="fg-c reveal' + (/^(Producto|Región|Importe)$/.test(c) ? " fg-m" : "") + '" id="fg' + c.slice(0, 3) + '"><i class="fg-k"></i>' + c + "</div>").join("");
    const area = (id, tit, chip) => '<div class="fa reveal" id="' + id + '"><b>' + tit + '</b><span class="fa-c reveal" id="' + id + 'C">' + chip + "</span></div>";
    const unicos = ["Acme", "Delta", "Nova", "Orbe", "Zeta"].map((c) => '<div class="xsp-r reveal"><span>' + c + "</span></div>").join("");
    const sl = ["Norte", "Centro", "Sur", "Noreste"].map((n, i) => '<span class="sl-b" id="slb' + i + '">' + n + "</span>").join("");
    return '<div class="xl-l" id="xSA"><span class="xl-lab">Análisis</span>' + msgBloque(2) +
      '<div class="xp reveal" id="xPv"><div class="xp-ttl">Suma de Importe · por Región y Producto</div>' + cab + filas + total + "</div>" +
      '<div class="xsp reveal" id="xSp"><div class="xsp-h"><b>=ÚNICOS(Tabla1[Cliente])</b></div>' + unicos + '<div class="xsp-n reveal">derrame automático</div></div>' +
      '<div class="xsl reveal" id="xSl"><div class="xsl-h"><span class="ik">' + I.filtro + "</span>Segmentación · Región</div>" + sl + "</div>" +
      '<div class="xfp reveal" id="xFld"><div class="xfp-h">Campos de tabla dinámica</div><div class="xfp-l">' + campos + '</div><div class="xfp-a">' + area("aFil", "Filas", "Región") + area("aCol", "Columnas", "Producto") + area("aVal", "Valores", "Suma de Importe") + "</div></div></div>";
  }

  // =====================  HOJA 3 · DASHBOARD  =====================
  const BARRAS = [["Norte", 100, 100, "#22c55e"], ["Centro", 59, 59, "#6b9fff"], ["Sur", 41, 41, "#dfb35a"], ["Noreste", 29, 29, "#a78bfa"]];
  const DONA = [["Licencias", 41, "#22c55e"], ["Consultoría", 25, "#6b9fff"], ["Soporte", 23, "#dfb35a"], ["Diagnóstico", 11, "#a78bfa"]];
  const TABLA_K = [
    ["Licencias Pro", "#22c55e", "$980k", "▲ +22%", "up", "Meta $900k", "✓ En meta", "ok"],
    ["Soporte Anual", "#dfb35a", "$540k", "▲ +8%", "up", "Meta $520k", "✓ En meta", "ok"],
    ["Consultoría", "#6b9fff", "$610k", "▼ −5%", "down", "Meta $650k", "▼ Bajo meta", "bad"],
    ["Diagnóstico", "#a78bfa", "$270k", "▲ +31%", "up", "Meta $250k", "✓ En meta", "ok"],
  ];
  const MACROS = [["Actualizar", "actualizar"], ["Tema", "tema"], ["Evaluar", "evaluar"], ["Enviar por correo", "correo"], ["Descargar", "descargar"]];
  // ilustraciones de producto (la "consulta de imagen": IMAGEN() las trae de una URL)
  const IMG_LIC = '<svg class="a" viewBox="0 0 200 104"><defs><linearGradient id="gl1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14532d"/><stop offset="1" stop-color="#22c55e"/></linearGradient></defs><rect width="200" height="104" rx="8" fill="url(#gl1)"/><rect x="62" y="16" width="76" height="72" rx="8" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/><circle cx="100" cy="42" r="12" fill="none" stroke="#fff" stroke-width="3"/><path d="M100 54v22M100 66h8M100 74h6" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>';
  const IMG_CON = '<svg class="b" viewBox="0 0 200 104"><defs><linearGradient id="gl2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#6b9fff"/></linearGradient></defs><rect width="200" height="104" rx="8" fill="url(#gl2)"/><rect x="48" y="26" width="104" height="58" rx="8" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/><path d="M48 40h104" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/><circle cx="72" cy="62" r="9" fill="#fff"/><path d="M92 56h46M92 66h32" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>';
  const sparkSvg = (pts, c) => '<svg class="xd-sp" viewBox="0 0 60 20"><polyline points="' + pts + '" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function sceneV() {
    const bars = BARRAS.map((b) => '<div class="xb-c"><div class="xb-p"><i data-h="' + b[1] + '" data-hn="' + b[2] + '" style="background-color:' + b[3] + '"></i></div><span>' + b[0] + "</span></div>").join("");
    let acum = 0;
    const seg = DONA.map((d) => { const o = -acum; acum += d[1]; return '<circle class="seg" cx="21" cy="21" r="15.9155" fill="none" stroke="' + d[2] + '" stroke-width="5" data-p="' + d[1] + '" stroke-dasharray="0 100" stroke-dashoffset="' + o + '"/>'; }).join("");
    const leyenda = DONA.map((d) => '<li><i style="background-color:' + d[2] + '"></i>' + d[0] + "<b>" + d[1] + "%</b></li>").join("");
    const kpi = (id, lb, g, gc, sp, ev, evc) => '<div class="xd-k reveal"><span>' + lb + '</span><b id="' + id + '">—</b><em class="xd-g ' + gc + '">' + g + "</em>" + sp + '<em class="xd-ev reveal ' + evc + '">' + ev + "</em></div>";
    const slr = ["Todas", "Norte", "Centro", "Sur", "Noreste"].map((c, i) => '<span class="sl-i' + (i === 0 ? " on" : "") + '" id="sr' + i + '"><i class="ik">' + I.check + "</i>" + c + "</span>").join("");
    const slp = ["Licencias Pro", "Soporte Anual", "Consultoría", "Diagnóstico"].map((c, i) => '<span class="sl-i" id="sp' + i + '"><i class="ik">' + I.check + "</i>" + c + "</span>").join("");
    const filaK = (r, i) => '<div class="xk-r reveal" id="xkr' + i + '"><span class="xk-i" style="background-color:' + r[1] + '"><i class="ik">' + I.datos + '</i></span><span class="xk-n">' + r[0] + "</span><span>" + r[2] + '</span><span class="xk-g ' + r[4] + '">' + r[3] + "</span><span>" + r[5] + '</span><span class="xk-e ' + r[7] + '">' + r[6] + "</span></div>";
    const mb = MACROS.map((m, i) => '<span class="xd-b reveal" id="mb' + i + '"><span class="ik">' + I[m[1]] + "</span>" + m[0] + "</span>").join("");
    return '<div class="xl-l" id="xSV"><span class="xl-lab">Dashboard</span>' + msgBloque(3) +
      '<div class="xd" id="xDash"><div class="xd-h reveal" id="xdH"><b>Ventas T3 · Dashboard</b><span class="xd-per">T3 2024 vs. T2</span><em class="xd-st reveal" id="xStamp">Actualizado 10:42</em></div>' +
      '<div class="xd-mb" id="xMb">' + mb + "</div>" +
      '<div class="xd-bd">' +
      '<aside class="xd-sl reveal" id="xdSl"><div class="sl-g"><div class="sl-t">Región</div>' + slr + '</div><div class="sl-g"><div class="sl-t">Producto</div>' + slp + '</div><div class="sl-g"><div class="sl-t">Mes</div><div class="sl-tl"><i></i></div><div class="sl-tt"><span>Ene</span><span>Jun</span></div></div><span class="sl-x" id="sLimpiar"><span class="ik">' + I.filtro + "</span>Limpiar filtros</span></aside>" +
      '<div class="xd-c"><div class="xd-ks">' +
      kpi("xkV", "Ventas", "▲ +18%", "up", sparkSvg("0,16 12,12 24,14 36,8 48,5 60,2", "#22c55e"), "✓ En meta", "ok") + kpi("xkU", "Unidades", "▲ +9%", "up", sparkSvg("0,12 12,14 24,9 36,11 48,6 60,5", "#6b9fff"), "✓ En meta", "ok") +
      kpi("xkM", "Margen", "▼ −2 pts", "down", sparkSvg("0,4 12,6 24,5 36,10 48,12 60,15", "#ff8787"), "▼ Bajo meta", "bad") + kpi("xkT", "Ticket prom.", "▲ +4%", "up", sparkSvg("0,14 12,11 24,12 36,8 48,9 60,5", "#dfb35a"), "✓ En meta", "ok") + "</div>" +
      '<div class="xd-r2"><div class="xd-ch reveal" id="xChB"><h5>Ventas por región</h5><div class="xb-bars">' + bars + '</div></div>' +
      '<div class="xd-ch reveal" id="xChL"><h5>Tendencia mensual</h5><svg viewBox="0 0 120 60" preserveAspectRatio="none"><path class="ar" d="M0,48 L20,40 L40,44 L60,26 L80,18 L100,10 L120,6 L120,60 L0,60Z" opacity="0"/><path class="ln" d="M0,48 L20,40 L40,44 L60,26 L80,18 L100,10 L120,6" fill="none" stroke="#22c55e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg></div></div>' +
      '<div class="xd-kt reveal" id="xKt"><div class="xk-r xk-h"><span></span><span>Producto</span><span>Ventas</span><span>vs. T2</span><span>Meta</span><span>Estado</span></div>' + TABLA_K.map(filaK).join("") + "</div></div>" +
      '<aside class="xd-rt"><div class="xd-pc reveal" id="xPc"><div class="pc-h"><b>Ficha de producto</b><span class="pc-f">=IMAGEN()</span></div><div class="pc-img">' + '<span class="xf pc-xf">' + IMG_LIC + IMG_CON + "</span></div>" +
      '<div class="pc-n">' + xf("Licencias Pro", "Consultoría") + '</div><div class="pc-s">' + xf("$980k · 41% del total", "$610k · 25% del total") + "</div></div>" +
      '<div class="xd-ch reveal" id="xChD"><h5>Mezcla por producto</h5><div class="xd-dn"><svg viewBox="0 0 42 42">' + seg + "</svg><ul>" + leyenda + "</ul></div></div></aside></div></div>" +
      '<div class="xmail reveal no-final" id="xMail"><span class="ik">' + I.correo + '</span><div><b>Nuevo correo</b><span><i class="ik">' + I.clip + "</i>Dashboard_T3.xlsx</span></div></div>" +
      '<div class="xpdf reveal no-final" id="xPdf"><span class="ik">' + I.descargar + '</span><div><b>Dashboard_T3.pdf</b><div class="xpdf-b"><i></i></div></div></div></div>';
  }

  // =====================  ACTO 4 · EL PANEL DE COPILOT QUE ESCRIBE LAS MACROS  =====================
  const PROMPTS = ["Crea una macro que actualice todo el dashboard", "Agrega un botón para cambiar entre tema claro y oscuro", "Haz una macro que evalúe cada KPI contra su meta", "Quiero enviar el dashboard por correo con un clic", "Exporta el dashboard a PDF"];
  const VBA = [
    ["Sub Actualizar()", "    ActiveWorkbook.RefreshAll", "    Range(\"B1\") = Now", "End Sub"],
    ["Sub CambiarTema()", "    Hoja.Tema = Not Hoja.Tema", "    Call PintarTablero", "End Sub"],
    ["Sub EvaluarMetas()", "    If Margen < Meta Then", "        Icono = \"▼ Bajo meta\"", "    End If", "End Sub"],
    ["Sub EnviarCorreo()", "    Set o = CreateObject(\"Outlook.Application\")", "    o.CreateItem(0).Attachments.Add Libro", "End Sub"],
    ["Sub Descargar()", "    Hoja.ExportAsFixedFormat xlTypePDF,", "        \"Dashboard_T3.pdf\"", "End Sub"],
  ];
  function vbaLinea(l, id) {
    const e = l.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    // un solo pase: cadenas y palabras clave (si se colorean por separado, la segunda pasada pisa el HTML de la primera)
    return '<span class="xk-l cl" id="' + id + '">' + e.replace(/("[^"]*")|\b(Sub|End Sub|If|Then|End If|Set|Call|Not|Now)\b/g, (m, cad, kw) => cad ? '<i class="st">' + cad + "</i>" : '<i class="kw">' + kw + "</i>") + "</span>";
  }
  function sceneCopilot() {
    const sets = VBA.map((b, i) => '<div class="xk-set" id="xkS' + i + '"><div class="xk-u reveal"><b>Tú</b><span class="cl" id="xkP' + i + '">' + PROMPTS[i] + '</span></div>' +
      '<div class="xk-a reveal"><span class="xk-av"><span class="ik">' + I.chispa + '</span></span><div><p>Listo. Escribí esta macro en VBA:</p><div class="xk-code">' + b.map((l, j) => vbaLinea(l, "xkL" + i + "_" + j)).join("") + '</div><span class="xk-ins reveal" id="xkI' + i + '">Agregar botón</span></div></div></div>').join("");
    return msgBloque(4) + '<aside class="xcp reveal" id="xCp"><div class="xk-h"><span class="ik">' + I.chispa + '</span>Copilot<em>Excel</em></div><div class="xk-sets">' + sets + "</div></aside>";
  }

  // ---- héroe: mitad texto, mitad el MISMO dashboard oscuro de la hoja 3 (con sus macros), interactivo ----
  // Copia con ids "h…" (los de la escena no se tocan). Un solo botón grande con barrita de 5 s (auto-scroll, ver
  // ViajeEngine.autoBajar); "Ver programas" discreto. Los botones de macro del tablero funcionan de verdad.
  const XH_KPI = [["xkV", 2.4, 1.05, (v) => fmtV(v)], ["xkU", 1284, 566, (v) => fmtU(v)], ["xkM", 34, 38, (v) => fmtM(v)], ["xkT", 18.7, 18.5, (v) => fmtT(v)]];
  const XH_VARS = ["--d-bg", "--d-card", "--d-tx", "--d-mut", "--d-line", "--d-head"];
  const XH_OSC = [[15, 19, 26], [22, 28, 38], [226, 232, 240], [138, 150, 168], [38, 47, 62], [9, 52, 33]];
  const XH_CLA = [[255, 255, 255], [246, 248, 251], [28, 36, 49], [100, 116, 139], [221, 227, 236], [15, 31, 61]];
  function heroHtml() {
    const full = sceneV();
    const ini = full.indexOf('<div class="xd" id="xDash">'), fin = full.indexOf('<div class="xmail');
    const dash = full.slice(ini, fin).replace(/id="([A-Za-z]\w*)"/g, 'id="h$1"');
    return '<section class="viaje-hero hb-hero xh-hero" id="xHero"><div class="hb-copy"><span class="viaje-hero-eyebrow">Curso de Excel</span>' +
      '<h1 class="viaje-hero-title">Excel que <span class="accent">trabaja<span class="selector-box"><span class="selector-label">A1</span></span></span> por ti</h1>' +
      '<div class="viaje-hero-chips"><span class="scope-chip">Versión 365</span><span class="scope-chip">Macros con Copilot</span><span class="scope-chip">WPS / Google Sheets</span></div>' +
      '<div class="hb-actions"><a href="#xWin" class="viaje-btn solid hb-go" data-viaje-next><span>Conoce el programa</span>' + I.flecha + '<i class="hb-bar"></i></a><a href="#programas" class="hb-ver">Ver programas</a></div></div>' +
      '<div class="hb-stage"><div class="hb-frame xh-frame"><div class="hb-cv xh-cv" id="xhCv">' + dash + '<div class="xh-toast" id="hxToast" role="status"></div></div></div></div></section>';
  }

  // modo: "desk" (animado, interactivo y auto-scroll), "flujo" (teléfono) o "simple" (estado final)
  function heroDash(root, modo) {
    const cont = root.querySelector("#xhCv");
    if (!cont) return null;
    const g = (id) => cont.querySelector("#h" + id), qa = (s) => Array.prototype.slice.call(cont.querySelectorAll(s));
    const dash = g("xDash"), stage = root.querySelector(".hb-stage");
    function escala() { cont.style.transform = root.classList.contains("bi-flujo") ? "" : "scale(" + (stage.clientWidth / 940).toFixed(4) + ")"; }
    if (root._hbEsc) window.removeEventListener("resize", root._hbEsc);
    root._hbEsc = escala; window.addEventListener("resize", escala); escala();

    // UN estado mueve todo: g (se dibuja), t (Norte), p (producto Consultoría), th (0 oscuro → 1 claro)
    const st = { g: modo === "desk" ? 0 : 1, t: 0, p: 0, th: 0 };
    const lerp = (x, y, k) => x + (y - x) * k;
    function pinta() {
      XH_KPI.forEach((k) => { const v = lerp(k[1], k[2], st.t) * st.g; g(k[0]).textContent = v <= 0.001 ? "—" : k[3](v); });
      qa(".xb-p i").forEach((el, i) => { el.style.height = lerp(+el.dataset.h, +el.dataset.hn, st.t) * st.g + "%"; el.style.opacity = i ? lerp(1, 0.25, st.t) : 1; });
      qa(".seg").forEach((c) => { const p = +c.dataset.p * st.g; c.setAttribute("stroke-dasharray", p + " " + (100 - p)); });
      const ln = qa(".ln")[0]; if (ln) ln.setAttribute("stroke-dashoffset", 100 * (1 - st.g));
      const ar = qa(".ar")[0]; if (ar) ar.setAttribute("opacity", 0.18 * st.g);
      qa(".pc-xf .a, .pc-n .a, .pc-s .a").forEach((el) => { el.style.opacity = 1 - st.p; });
      qa(".pc-xf .b, .pc-n .b, .pc-s .b").forEach((el) => { el.style.opacity = st.p; });
      g("xkr2").style.backgroundColor = "rgba(107,159,255," + (0.18 * st.p).toFixed(3) + ")";
      g("sr0").classList.toggle("on", st.t < 0.5); g("sr1").classList.toggle("on", st.t >= 0.5); g("sp2").classList.toggle("on", st.p >= 0.5);
      XH_VARS.forEach((v, i) => dash.style.setProperty(v, "rgb(" + XH_OSC[i].map((x, j) => Math.round(lerp(x, XH_CLA[i][j], st.th))).join(",") + ")"));
    }
    pinta();
    const visibles = qa(".reveal:not(.xd-ev)");
    if (modo !== "desk") { visibles.forEach((el) => { el.style.opacity = 1; }); return null; }

    const api = { introHecha: false, irA: null };
    gsap.to(visibles, { opacity: 1, duration: 0.5, stagger: 0.04, delay: 0.3 });
    gsap.to(st, { g: 1, duration: 2.2, delay: 0.5, ease: "power2.out", onUpdate: pinta, onComplete: () => { api.introHecha = true; if (api.irA) E.autoBajar(root, api.irA); } });

    // interacción real: segmentaciones y botones de macro del tablero
    let reg = false, prod = false, tema = false, evalua = false, usuario = false, ultimo = 0;
    const o = { duration: 0.8, ease: "power2.inOut", overwrite: "auto", onUpdate: pinta };
    const setReg = (on) => { reg = on; gsap.to(st, Object.assign({ t: on ? 1 : 0 }, o)); };
    const setProd = (on) => { prod = on; gsap.to(st, Object.assign({ p: on ? 1 : 0 }, o)); };
    const setTema = (on) => { tema = on; gsap.to(st, Object.assign({ th: on ? 1 : 0 }, o, { duration: 0.9 })); };
    const setEval = (on) => { evalua = on; gsap.to(qa(".xd-ev"), { opacity: on ? 1 : 0, duration: 0.4, stagger: 0.1, overwrite: "auto" }); };
    const toast = (txt) => { const t = g("xToast") || cont.querySelector("#hxToast"); t.textContent = txt; gsap.fromTo(t, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, overwrite: true }); gsap.to(t, { opacity: 0, delay: 2.2, duration: 0.4 }); };
    const golpe = (el) => { el.classList.add("hit"); setTimeout(() => el.classList.remove("hit"), 450); };
    const actualiza = () => {
      const d = new Date(), h = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      g("xStamp").textContent = "Actualizado " + h; gsap.fromTo(qa(".xd-k"), { scale: 1.04 }, { scale: 1, duration: 0.5, stagger: 0.06 });
    };
    const acciones = {
      sr0: () => setReg(false), sr1: () => setReg(!reg), sp2: () => setProd(!prod), sLimpiar: () => { setReg(false); setProd(false); },
      mb0: actualiza, mb1: () => setTema(!tema), mb2: () => setEval(!evalua),
      mb3: () => toast("Correo con el dashboard listo para enviar"), mb4: () => toast("Dashboard_T3.pdf descargado"),
    };
    Object.keys(acciones).forEach((id) => {
      const el = g(id);
      el.setAttribute("role", "button"); el.setAttribute("tabindex", "0"); el.classList.add("hb-tap");
      const ir = () => { usuario = true; ultimo = Date.now(); g("mb1").classList.remove("hb-pulse"); golpe(el); acciones[id](); };
      el.addEventListener("click", ir);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ir(); } });
    });
    g("mb1").classList.add("hb-pulse");

    // si el visitante se queda mirando, el tablero se mueve solo (segmentar, cambiar de producto, tema, evaluar…)
    // mientras el héroe está a la vista; tras un toque suyo espera 10 s de calma
    const guion = [() => setReg(true), () => setProd(true), () => { setReg(false); setProd(false); }, () => setTema(true), () => setTema(false), () => setEval(true), () => setEval(false), () => actualiza()];
    let paso = 0;
    const vivo = setInterval(() => {
      if (!root.isConnected) { clearInterval(vivo); return; }
      const r = root.querySelector("#xHero").getBoundingClientRect();
      if (!api.introHecha || r.bottom < 80 || r.top > window.innerHeight || Date.now() - ultimo < 10000) return;
      guion[paso++ % guion.length]();
    }, 3600);
    api.auto = (irA) => { api.irA = irA; if (api.introHecha) E.autoBajar(root, irA); };
    return api;
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
      '<div class="bi-more" id="biMore" aria-hidden="true"><span>Sigue bajando</span>' + I.flecha + "</div>" +
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
  function cuenta(tl, el, de, a, fmt, t, d) { const o = { v: de }; tl.fromTo(o, { v: de }, { v: a, duration: d || 8, ease: "power1.inOut", immediateRender: false, onUpdate: () => { el.textContent = o.v <= 0.001 ? "—" : fmt(o.v); } }, t); }
  const fmtV = (v) => "$" + v.toFixed(2) + "M", fmtU = (v) => Math.round(v).toLocaleString("en-US"), fmtM = (v) => Math.round(v) + "%", fmtT = (v) => "$" + v.toFixed(1) + "k";
  const KPI = { V: ["#xkV", fmtV], U: ["#xkU", fmtU], M: ["#xkM", fmtM], T: ["#xkT", fmtT] };
  // todos los KPI de golpe: [de, a] por cada uno
  function kpis(tl, R, t, v, d) { Object.keys(v).forEach((k) => cuenta(tl, R.$(KPI[k][0]), v[k][0], v[k][1], KPI[k][1], t, d)); }

  // la barra de fórmulas escribe la fórmula del acto; el cuadro de nombres y la pestaña de la cinta cambian
  function barra(tl, R, n, t, dur) {
    const { $, qa } = R;
    qa("#xFx .fx-t").forEach((el, i) => { if (i !== n - 1) tl.to(el, { opacity: 0, duration: 3 }, t); });
    qa("#xNm b").forEach((el, i) => tl.to(el, { opacity: i === n - 1 ? 1 : 0, duration: 3 }, t));
    qa("#xBar .xl-tabs span").forEach((el, i) => tl.to(el, { backgroundColor: i === PESTANAS[n - 1] ? "rgba(255,255,255,.26)" : "rgba(255,255,255,0)", duration: 3 }, t));
    tl.fromTo($("#xF" + n), { opacity: 1, clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: dur || 12, ease: "none" }, t + 3);
  }

  // 1 · PREPARAR: la exportación sucia se limpia con Query y se vuelve una Tabla con fórmulas
  function escD(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x;
    tl.fromTo($("#xWin"), { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 6 }, at(0));
    tipea(tl, R.msg(1), at(2), 10);
    tl.to($("#xSrc"), { opacity: 1, duration: 3 }, at(5));
    tl.to(qa("#xSrc .xs-r"), { opacity: 1, duration: 2, stagger: 0.8 }, at(6));
    tl.to(qa("#xSrc .xs-bad"), { outlineColor: "#ff6b6b", duration: 3, stagger: 0.2 }, at(20));
    tl.to($("#xQ"), { opacity: 1, duration: 4 }, at(28));
    const T = [31, 36, 41, 46, 51, 56, 61];
    qa("#xQ .xq-st").forEach((s, i) => { tl.fromTo(s, { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 3 }, at(T[i])); });
    // el rango sucio se vuelve una Tabla limpia
    tl.to($("#xSrc"), { opacity: 0, duration: 5 }, at(64));
    tl.to($("#xQ"), { opacity: 0, x: 24, duration: 6 }, at(66));
    tl.to($("#xTbl"), { opacity: 1, duration: 4 }, at(64));
    tl.to(qa("#xTbl .xt-d"), { opacity: 1, duration: 2.5, stagger: 1 }, at(66));
    tl.to($("#xTbl .xt-tag"), { opacity: 1, duration: 3 }, at(74));
    // fórmula BUSCARX contra el catálogo
    tl.to($("#xCat"), { opacity: 1, duration: 4 }, at(74));
    barra(tl, R, 1, at(74), 12);
    tl.to(qa("#xTbl .xt-h .xt-n"), { opacity: 1, duration: 3, stagger: 2 }, at(82));
    tl.to(qa("#xTbl .xt-d .xt-n"), { opacity: 1, duration: 2.5, stagger: 0.7 }, at(85));
  }

  // 2 · ANALIZAR: tabla dinámica con mapa de calor, segmentación y matriz dinámica ÚNICOS
  function escA(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, hoja = $(".xl-sheet");
    if (!R.desk) tl.to($("#xPv"), { opacity: 1, duration: 4 }, at(0));
    tipea(tl, R.msg(2), at(2), 10);
    tl.to($("#xFld"), { opacity: 1, duration: 4 }, at(4));
    tl.to(qa("#xFld .fg-c"), { opacity: 1, duration: 3, stagger: 0.9 }, at(6));
    // arrastrar campos a las áreas
    tl.to(["#aFil", "#aCol", "#aVal"].map((s) => $(s)), { opacity: 1, duration: 4, stagger: 1.5 }, at(10));
    [["fgReg", "aFil", 16], ["fgPro", "aCol", 24], ["fgImp", "aVal", 32]].forEach((p) => {
      const c = $("#" + p[0]), dest = $("#" + p[1] + "C");
      if (R.desk) {
        tl.to(c, { x: () => rel(dest, hoja).x - rel(c, hoja).x, y: () => rel(dest, hoja).y - rel(c, hoja).y, duration: 6, ease: "power2.inOut" }, at(p[2]));
        tl.to(c, { opacity: 0, duration: 2 }, at(p[2] + 6));
      }
      tl.to(dest, { opacity: 1, duration: 3 }, at(p[2] + (R.desk ? 5 : 0)));
    });
    // la tabla dinámica se arma: filas, mapa de calor y barras de datos
    tl.to(qa("#xPv .xp-d"), { opacity: 1, duration: 3, stagger: 2.5 }, at(40));
    tl.fromTo(qa("#xPv .xp-tt i"), { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 7, stagger: 2.5 }, at(42));
    tl.to($("#xPv .xp-t"), { opacity: 1, duration: 3 }, at(52));
    // matriz dinámica: ÚNICOS se derrama sola
    tl.to($("#xSp"), { opacity: 1, duration: 4 }, at(58));
    barra(tl, R, 2, at(58), 12);
    tl.to(qa("#xSp .xsp-r"), { opacity: 1, duration: 3, stagger: 2.5 }, at(70));
    tl.to($("#xSp .xsp-n"), { opacity: 1, duration: 3 }, at(84));
    // segmentación: Norte filtra la tabla dinámica
    tl.to($("#xSl"), { opacity: 1, duration: 4 }, at(62));
    if (R.desk) {
      const cur = $("#curX"), rip = $("#ripX"), norte = $("#slb0");
      tl.fromTo(cur, { opacity: 0, x: () => cen($("#xPv"), hoja)[0] + 80, y: () => cen($("#xPv"), hoja)[1] + 40 }, { opacity: 1, duration: 3, immediateRender: false }, at(68));
      tl.to(cur, Object.assign({ duration: 6 }, hacia(norte, hoja)), at(70));
      clic(tl, rip, hoja, norte, at(77));
      tl.to(norte, { backgroundColor: "#16553a", borderColor: "#22c55e", color: "#d7f5e3", duration: 3 }, at(78));
      tl.to(qa('#xPv .xp-d:not([data-r="Norte"])'), { opacity: 0.25, duration: 5 }, at(79));
      tl.to(qa("#xPv .xp-t .a"), { opacity: 0, duration: 4 }, at(80)); tl.to(qa("#xPv .xp-t .b"), { opacity: 1, duration: 4 }, at(80));
      tl.to(cur, { opacity: 0, duration: 3 }, at(84));
    }
  }

  // 3 · VISUALIZAR: el dashboard completo (segmentaciones, KPI con crecimientos, gráficos, tabla de KPI, ficha con imagen)
  function escV(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x;
    if (!R.desk) { tl.to($("#xChB"), { opacity: 1, duration: 4 }, at(0)); }
    tipea(tl, R.msg(3), at(2), 10);
    tl.to($("#xdH"), { opacity: 1, duration: 4 }, at(4));
    barra(tl, R, 3, at(4), 12);
    tl.to($("#xdSl"), { opacity: 1, duration: 4 }, at(8));
    // KPI con crecimiento (▲ ▼ + texto) y su minigráfica
    tl.to(qa("#xDash .xd-k"), { opacity: 1, duration: 3, stagger: 1.5 }, at(12));
    kpis(tl, R, at(14), { V: [0, 2.4], U: [0, 1284], M: [0, 34], T: [0, 18.7] }, 9);
    // gráficos: barras (llegan de la tabla dinámica), línea y dona
    tl.to(qa("#xChB .xb-p i"), { height: (i, el) => el.dataset.h + "%", duration: 8, stagger: 2 }, at(20));
    tl.to($("#xChL"), { opacity: 1, duration: 4 }, at(26));
    tl.to($("#xChL .ar"), { opacity: 0.18, duration: 8 }, at(36));
    tl.to($("#xChL .ln"), { attr: { "stroke-dashoffset": 0 }, duration: 12, ease: "none" }, at(28));
    tl.to($("#xChD"), { opacity: 1, duration: 4 }, at(38));
    qa("#xChD .seg").forEach((c, i) => tl.to(c, { attr: { "stroke-dasharray": c.dataset.p + " " + (100 - c.dataset.p) }, duration: 6 }, at(42 + i * 3)));
    // tabla de KPI: crecimientos y decrecimientos contra meta, con la imagen del producto
    tl.to($("#xKt"), { opacity: 1, duration: 3 }, at(46));
    tl.to(qa("#xKt .xk-r:not(.xk-h)"), { opacity: 1, duration: 3, stagger: 2 }, at(48));
    // ficha de producto: consulta de imagen con IMAGEN()
    tl.to($("#xPc"), { opacity: 1, duration: 4 }, at(58));
    // segmentaciones: Norte mueve todo; un producto cambia la ficha; "Limpiar" regresa
    if (R.desk) {
      const cur = $("#curX"), rip = $("#ripX"), hoja = $(".xl-sheet");
      const on = { backgroundColor: "#16553a", borderColor: "#22c55e", color: "#d7f5e3" }, off = { backgroundColor: "rgba(255,255,255,0)", borderColor: "rgba(255,255,255,.14)", color: "#a9b2c0" };
      const sel = (el, t) => tl.to(el, on, t), des = (el, t) => tl.to(el, off, t);
      const norte = $("#sr1"), todas = $("#sr0"), cons = $("#sp2"), limpia = $("#sLimpiar");
      tl.fromTo(cur, { opacity: 0, x: () => cen($("#xDash"), hoja)[0], y: () => cen($("#xDash"), hoja)[1] }, { opacity: 1, duration: 3, immediateRender: false }, at(60));
      tl.to(cur, Object.assign({ duration: 5 }, hacia(norte, hoja)), at(62));
      clic(tl, rip, hoja, norte, at(68)); sel(norte, at(69)); des(todas, at(69));
      kpis(tl, R, at(70), { V: [2.4, 1.05], U: [1284, 566], M: [34, 38], T: [18.7, 18.5] }, 6);
      tl.to(qa("#xChB .xb-p i"), { height: (i, el) => el.dataset.hn + "%", duration: 6 }, at(70));
      tl.to(qa("#xChB .xb-c:not(:first-child) i"), { opacity: 0.25, duration: 5 }, at(70));
      tl.to(cur, Object.assign({ duration: 5 }, hacia(cons, hoja)), at(76));
      clic(tl, rip, hoja, cons, at(82)); sel(cons, at(83));
      tl.to(qa("#xPc .pc-xf .a, #xPc .pc-n .a, #xPc .pc-s .a"), { opacity: 0, duration: 4 }, at(83)); tl.to(qa("#xPc .pc-xf .b, #xPc .pc-n .b, #xPc .pc-s .b"), { opacity: 1, duration: 4 }, at(83));
      tl.to($("#xkr2"), { backgroundColor: "rgba(107,159,255,.18)", duration: 4 }, at(83));
      tl.to(cur, Object.assign({ duration: 4 }, hacia(limpia, hoja)), at(86));
      clic(tl, rip, hoja, limpia, at(90));
      des(norte, at(91)); des(cons, at(91)); sel(todas, at(91));
      kpis(tl, R, at(91), { V: [1.05, 2.4], U: [566, 1284], M: [38, 34], T: [18.5, 18.7] }, 1);
    }
  }

  // 4 · AUTOMATIZAR: Copilot escribe cada macro y su botón actúa sobre el mismo dashboard
  function escM(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, hoja = $(".xl-sheet"), dash = $("#xDash");
    if (!R.desk) { tl.to($("#xMb"), { opacity: 1, duration: 4 }, at(0)); tl.to(qa("#xCp .reveal, #xMb .xd-b"), { opacity: 1, duration: 3, stagger: 1 }, at(2)); return; }
    tipea(tl, R.msg(4), at(2), 10);
    barra(tl, R, 4, at(2), 10);
    const cur = $("#curX"), rip = $("#ripX");
    const vc = (el) => cenV(el, hoja);
    tl.fromTo(cur, { opacity: 0, x: () => cen($("#xCp"), hoja)[0], y: () => cen($("#xCp"), hoja)[1] }, { opacity: 1, duration: 3, immediateRender: false }, at(8));
    // cada macro: el usuario pide, Copilot escribe el VBA, se agrega el botón, se presiona y actúa
    const macro = (n, t) => {
      const set = $("#xkS" + n), ins = $("#xkI" + n), btn = $("#mb" + n);
      if (n > 0) tl.to($("#xkS" + (n - 1)), { opacity: 0, duration: 3 }, t);
      tl.to(set, { opacity: 1, duration: 3 }, t);
      tl.to(set.querySelector(".xk-u"), { opacity: 1, duration: 2 }, t);
      tipea(tl, $("#xkP" + n), t + 1, 4);
      tl.to(set.querySelector(".xk-a"), { opacity: 1, duration: 2 }, t + 5);
      VBA[n].forEach((l, j) => tipea(tl, $("#xkL" + n + "_" + j), t + 6 + j * 1.2, 1.6));
      tl.to(ins, { opacity: 1, duration: 2 }, t + 6 + VBA[n].length * 1.2);
      tl.to(ins, { backgroundColor: "#7c3aed", color: "#ffffff", duration: 2 }, t + 11);
      tl.fromTo(btn, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 3 }, t + 12);
      tl.to(cur, Object.assign({ duration: 3 }, hacia(btn, hoja, vc)), t + 12);
      clic(tl, rip, hoja, btn, t + 15, vc);
      tl.to(btn, { backgroundColor: "#107c41", color: "#ffffff", duration: 2 }, t + 15);
      tl.to(btn, { backgroundColor: "rgba(255,255,255,.08)", color: "#8fe0b0", duration: 4 }, t + 21);
    };
    tl.to($("#xCp"), { opacity: 1, duration: 4 }, at(2));
    const t0 = at(6);
    macro(0, t0);
    kpis(tl, R, t0 + 17, { V: [2.4, 2.58], U: [1284, 1342], M: [34, 35], T: [18.7, 19.2] }, 6);
    tl.to($("#xStamp"), { opacity: 1, duration: 3 }, t0 + 19);
    macro(1, t0 + 16);
    tl.to(dash, { "--d-bg": "rgb(255,255,255)", "--d-card": "rgb(246,248,251)", "--d-tx": "rgb(28,36,49)", "--d-mut": "rgb(100,116,139)", "--d-line": "rgb(221,227,236)", "--d-head": "rgb(15,31,61)", duration: 6 }, t0 + 33);
    macro(2, t0 + 32);
    tl.to(qa("#xDash .xd-ev"), { opacity: 1, duration: 3, stagger: 1.5 }, t0 + 49);
    macro(3, t0 + 48);
    tl.fromTo($("#xMail"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 4 }, t0 + 65);
    tl.to($("#xMail"), { x: 160, y: -40, opacity: 0, duration: 7, ease: "power2.in" }, t0 + 71);
    macro(4, t0 + 64);
    tl.fromTo($("#xPdf"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 4 }, t0 + 81);
    tl.fromTo($("#xPdf .xpdf-b i"), { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 6, ease: "none" }, t0 + 82);
    tl.to(cur, { opacity: 0, duration: 3 }, t0 + 88);
  }

  // =====================  CONTENIDO  =====================
  const XL = {
    renderHtml() {
      const tabsC = ["Archivo", "Inicio", "Insertar", "Datos", "Programador", "Copilot"].map((t) => "<span>" + t + "</span>").join("");
      const fx = [1, 2, 3, 4].map((n) => '<span class="fx-t" id="xF' + n + '"></span>').join("");
      const letras = "ABCDEFGHIJKL".split("").map((c) => "<i>" + c + "</i>").join("");
      const nombres = CELDAS.map((c, i) => "<b" + (i === 0 ? ' style="opacity:1"' : "") + ">" + c + "</b>").join("");
      const sheet = sceneD() + sceneA() + sceneV() + sceneCopilot();
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
      if (simple) { estadoFinal(root); heroDash(root, "simple"); return; }
      if (telefono) { root.classList.add("viaje-flujo", "bi-flujo", "viaje-movil"); flujo(root); heroDash(root, "flujo"); ScrollTrigger.refresh(); window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true }); return; }

      gsap.registerPlugin(ScrollTrigger);
      const hero = heroDash(root, "desk");
      const R = ctx(root, true), $ = R.$, qa = R.qa;
      const mas = E.flechaMas($("#biMore"));
      const pin = $("#xPin"), canvas = $("#xCanvas"), caps = qa(".xl-l");

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
      // Dashboard → Macros: el dashboard se encoge, se abre la barra de macros y entra el panel de Copilot
      m.to($("#xDash"), { scale: 0.66, duration: 14, ease: "power2.inOut" }, TR.vm);
      m.to($("#xMb"), { height: 40, duration: 8 }, TR.vm + 6);
      m.to(R.msg(3), { opacity: 0, duration: 6 }, TR.vm + 2);
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
        onUpdate: (self) => { const u = self.progress * TOTAL; setActive(u < UMBRAL[0] ? 1 : u < UMBRAL[1] ? 2 : u < UMBRAL[2] ? 3 : 4); mas.fin = u > TOTAL - 36; },
      });
      ScrollTrigger.create({ trigger: $("#xHero"), start: "top center", end: "bottom center", onToggle: (s) => s.isActive && setActive(0) });

      // scroll a un punto de la línea de tiempo (el pin mueve el layout: el ancla nativa no sirve)
      function irA(u) { window.scrollTo({ top: st.start + (st.end - st.start) * (u / TOTAL), behavior: "smooth" }); }
      tabs.concat(vistas).forEach((t) => t.addEventListener("click", () => irA(IR_A[t.dataset.scene])));
      if (siguiente) siguiente.addEventListener("click", () => irA(8));
      if (hero) hero.auto(() => irA(8));

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
    [["#xSD", escD], ["#xSA", escA], ["#xSV", escV], ["#xCp", escM]].forEach((e) => { const tl = una(e[0]); e[1](tl, 0, R); tl.timeScale(K); });
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
    [["#xkV", "$2.40M"], ["#xkU", "1,284"], ["#xkM", "34%"], ["#xkT", "$18.7k"]].forEach((p) => { const el = root.querySelector(p[0]); if (el) el.textContent = p[1]; });
    root.querySelectorAll(".xd-ev").forEach((el) => { el.style.opacity = 0; });
    root.querySelectorAll("#xPv .xp-t .a").forEach((el) => { el.style.opacity = 1; });
    root.querySelectorAll("#xPv .xp-tt i").forEach((el) => { el.style.transform = "none"; });
    root.querySelectorAll("#xF1, #xF2, #xF3, #xF4").forEach((el) => { el.style.clipPath = "inset(0 0% 0 0)"; });
  }

  window.ViajeEscenas.excel = XL;
})();
