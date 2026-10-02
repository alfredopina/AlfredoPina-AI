// assets/js/viaje.js
// Motor de "viaje" (scrollytelling con GSAP ScrollTrigger) embebido en
// cursos.html, arriba del catálogo de cada herramienta. Hoy solo Excel tiene
// contenido (VIAJE_SCENES.excel) — para replicarlo en otra herramienta:
// escribir su propio renderHtml()/iniciar() con el mismo patrón y agregarlo a
// VIAJE_SCENES; el motor compartido (ViajeEngine: pin, rail, fx=, fallback
// simple-mode) no cambia.
//
// Decisiones que NO hay que repetir si esto se toca:
//   - El offset de pin (NAV) se mide en vivo (nav + .cat-nav-wrap), nunca se
//     hardcodea — cursos.html tiene DOS barras sticky (nav + cat-nav-wrap),
//     a diferencia del prototipo original que solo tenía una.
//   - Fallback simple-mode si es teléfono táctil real (pointer:coarse +
//     max-width:560px) o prefers-reduced-motion o si GSAP no cargó — nunca
//     por ancho de ventana a secas (ver CLAUDE_DETALLE.md → "Viaje Excel").
(function () {
  "use strict";

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const ViajeEngine = {
    shuffle,
    esSimpleMode() {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const telefono = window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width:560px)").matches;
      const gsapListo = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
      return { simple: reduced || telefono || !gsapListo, gsapListo };
    },
    navOffset(root) {
      const nav = document.querySelector("nav");
      const catNav = root.closest("main")?.querySelector(".cat-nav-wrap") || document.querySelector(".cat-nav-wrap");
      const navH = nav ? nav.getBoundingClientRect().height : 0;
      const catNavH = catNav ? catNav.getBoundingClientRect().height : 0;
      return Math.round(navH + catNavH);
    },
    forceFinalState(root) {
      root.classList.add("viaje-simple");
      root.querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
      root.querySelectorAll("[data-anim-final]").forEach((el) => {
        const prop = el.dataset.animProp, val = el.dataset.animFinal;
        if (prop === "width-pct") el.style.width = val + "%";
        else if (prop === "height-pct") el.style.height = val + "%";
        else el.setAttribute(prop, val);
      });
      root.querySelectorAll(".formula-msg-text").forEach((el) => { el.style.clipPath = "inset(0 0% 0 0)"; });
    },
  };

  // ============================================================
  // EXCEL — único contenido real hoy
  // ============================================================
  const ExcelScenes = {
    classicFns: ["=ÍNDICE(", "=COINCIDIR(", "=SI(", "=BUSCARV(", "=SUMA(", "=PROMEDIO(", "=CONCATENAR(", "=EXTRAE(", "=HOY()", "=SUMAR.SI("],
    newFns: ["SI.CONJUNTO", "IMAGEN", "BUSCARX", "FILTRAR", "TRADUCIR", "ÚNICOS", "ORDENAR", "SECUENCIA", "EXPANDIR", "LAMBDA", "REDUCE", "DIVIDIRTEXTO"],

    renderHtml() {
      return `
<div class="viaje-root" id="viajeExcel">
  <div class="rail" id="viajeRail">
    <div class="rail-item" data-scene="1"><span class="rail-num">1</span></div>
    <div class="rail-item" data-scene="2"><span class="rail-num">2</span></div>
    <div class="rail-item" data-scene="3"><span class="rail-num">3</span></div>
    <div class="rail-item" data-scene="4"><span class="rail-num">4</span></div>
    <div class="rail-item" data-scene="5"><span class="rail-num">5</span></div>
  </div>

  <section class="viaje-hero" id="sceneHero">
    <span class="viaje-hero-eyebrow">Curso de Excel</span>
    <h1 class="viaje-hero-title">Aprende Excel como un <span class="accent">Máster<span class="selector-box"><span class="selector-label">A1</span></span></span>.</h1>
    <div class="viaje-hero-chips">
      <span class="scope-chip">Versión 365</span>
      <span class="scope-chip">Español e Inglés</span>
      <span class="scope-chip">WPS / Google Sheets</span>
    </div>
    <div class="viaje-hero-cue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>scroll</div>
    <a href="#programsList" class="skip-nav-btn">Ver programas directo<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
  </section>

  <section class="viaje-scene" id="sceneCaptura">
    <div class="immersive" style="opacity:1;"></div>
    <div class="viaje-stage">
      <div class="cap-grid reveal" id="capStage">
        <div class="cap-cell hd"></div>
        <div class="cap-cell hd">A</div><div class="cap-cell hd">B</div><div class="cap-cell hd">C</div><div class="cap-cell hd">D</div>
        <div class="cap-cell hd">E</div><div class="cap-cell hd">F</div><div class="cap-cell hd">G</div><div class="cap-cell hd">H</div>
        ${[1, 2, 3, 4, 5].map((row) => `<div class="cap-cell hd">${row}</div>` + Array(8).fill('<div class="cap-cell"></div>').join("")).join("")}
      </div>
      <div class="viaje-msg">
        <div class="formula-msg" id="msgWrap1a"><span class="formula-msg-fx">fx</span><span class="formula-msg-text" id="msgText1a">Domina lo esencial.<span class="formula-msg-cursor"></span></span></div>
        <div class="formula-msg" id="msgWrap1b" style="display:none;"><span class="formula-msg-fx">fx</span><span class="formula-msg-text" id="msgText1b">Aprende a crear fórmulas poderosas.<span class="formula-msg-cursor"></span></span></div>
      </div>
    </div>
  </section>

  <section class="viaje-scene" id="sceneOrganiza">
    <div class="immersive" style="opacity:1;"></div>
    <div class="viaje-stage">
      <div class="org-split">
        <div class="org-panel reveal" id="orgLeft">
          <div class="org-head"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>Base de datos</div>
          <table class="otable" id="otable3">
            <thead><tr>
              <th>Producto<svg class="filter-ico" data-fico viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 5h16M7 12h10M10 19h4" stroke-linecap="round"/></svg></th>
              <th>Región<svg class="filter-ico" data-fico viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 5h16M7 12h10M10 19h4" stroke-linecap="round"/></svg></th>
              <th>Ventas<svg class="filter-ico" data-fico viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 5h16M7 12h10M10 19h4" stroke-linecap="round"/></svg></th>
              <th>Estatus<svg class="filter-ico" data-fico viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 5h16M7 12h10M10 19h4" stroke-linecap="round"/></svg></th>
            </tr></thead>
            <tbody>
              <tr data-row="lic"><td>Licencias Pro</td><td>Norte</td><td>$182,400</td><td><span class="sem-pill verde">● Bien</span></td></tr>
              <tr data-row="sop"><td>Soporte Anual</td><td>Centro</td><td>$97,100</td><td><span class="sem-pill ambar">● Atención</span></td></tr>
              <tr data-row="cap"><td>Capacitación</td><td>Sur</td><td>$54,900</td><td><span class="sem-pill rojo">● Urgente</span></td></tr>
              <tr data-row="con"><td>Consultoría</td><td>Norte</td><td>$120,300</td><td><span class="sem-pill verde">● Bien</span></td></tr>
              <tr class="reveal" data-k="x1"><td>Diagnóstico Inicial</td><td>Centro</td><td>$42,300</td><td><span class="sem-pill verde">● Bien</span></td></tr>
              <tr class="reveal" data-k="x2"><td>Renovación Anual</td><td>Sur</td><td>$68,500</td><td><span class="sem-pill ambar">● Atención</span></td></tr>
              <tr class="reveal" data-k="x3"><td>Implementación</td><td>Norte</td><td>$95,200</td><td><span class="sem-pill verde">● Bien</span></td></tr>
            </tbody>
          </table>
        </div>
        <div class="org-panel reveal" id="orgRight">
          <div class="org-head"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6"/></svg>Tabla dinámica matricial</div>
          <div class="matrix">
            <table>
              <thead><tr><th>Región</th><th>Q1</th><th>Q2</th><th>Total</th></tr></thead>
              <tbody>
                <tr class="reveal" data-k="m1"><td>Norte</td><td>$165,000</td><td>$137,700</td><td class="tot">$302,700</td></tr>
                <tr class="reveal" data-k="m2"><td>Centro</td><td>$52,000</td><td>$45,100</td><td class="tot">$97,100</td></tr>
                <tr class="reveal" data-k="m3"><td>Sur</td><td>$28,000</td><td>$26,900</td><td class="tot">$54,900</td></tr>
                <tr class="reveal" data-k="m5"><td>Bajío</td><td>$38,000</td><td>$31,500</td><td class="tot">$69,500</td></tr>
                <tr class="reveal" data-k="m6"><td>Noreste</td><td>$22,000</td><td>$19,800</td><td class="tot">$41,800</td></tr>
                <tr class="tot reveal" data-k="m4"><td>Total</td><td>$305,000</td><td>$261,000</td><td class="tot">$566,000</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="viaje-msg"><div class="formula-msg" id="msgWrap2"><span class="formula-msg-fx">fx</span><span class="formula-msg-text" id="msgText2">Organiza tablas y crea Reportes automáticos.<span class="formula-msg-cursor"></span></span></div></div>
    </div>
  </section>

<section class="viaje-scene" id="sceneDecide">
  <div class="immersive reveal" id="imm4"></div>
  <div class="viaje-stage">
    <div class="viaje-msg" style="margin-bottom:-6px;"><div class="formula-msg" id="msgWrap3"><span class="formula-msg-fx">fx</span><span class="formula-msg-text" id="msgText3">Diseña Dashboards increíbles.<span class="formula-msg-cursor"></span></span></div></div>
    <div class="dash-grid reveal" id="dashGrid">

      <div class="dash-tile">
        <span class="dash-tile-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3v18h18M7 16l4-6 3 3 5-8"/></svg>Automatización</span>
        <div class="gauge-wrap">
          <svg viewBox="0 0 180 100"><path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#2a3140" stroke-width="12" stroke-linecap="round"/>
          <path id="gA" d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#22c55e" stroke-width="12" stroke-linecap="round" stroke-dasharray="220" stroke-dashoffset="220" data-anim-prop="stroke-dashoffset" data-anim-final="18"/></svg>
          <div class="disp gauge-val">92%</div>
        </div>
      </div>

      <div class="dash-tile">
        <span class="dash-tile-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20V10M10 20V4M16 20v-7M22 20v4"/></svg>Top 5 productos</span>
        <div class="hbars">
          <div class="hbar-row"><span class="hbar-label">Licencias</span><div class="hbar-track"><div class="hbar-fill" id="hb1" style="background:#22c55e;" data-anim-prop="width-pct" data-anim-final="95"></div></div><span class="hbar-val">$182k</span></div>
          <div class="hbar-row"><span class="hbar-label">Consultoría</span><div class="hbar-track"><div class="hbar-fill" id="hb2" style="background:#6b9fff;" data-anim-prop="width-pct" data-anim-final="63"></div></div><span class="hbar-val">$120k</span></div>
          <div class="hbar-row"><span class="hbar-label">Soporte</span><div class="hbar-track"><div class="hbar-fill" id="hb3" style="background:#dfb35a;" data-anim-prop="width-pct" data-anim-final="51"></div></div><span class="hbar-val">$97k</span></div>
          <div class="hbar-row"><span class="hbar-label">Capacitación</span><div class="hbar-track"><div class="hbar-fill" id="hb4" style="background:#14b8a6;" data-anim-prop="width-pct" data-anim-final="29"></div></div><span class="hbar-val">$55k</span></div>
          <div class="hbar-row"><span class="hbar-label">Diagnóstico</span><div class="hbar-track"><div class="hbar-fill" id="hb5" style="background:#a78bfa;" data-anim-prop="width-pct" data-anim-final="20"></div></div><span class="hbar-val">$38k</span></div>
        </div>
        <div class="legend" style="justify-content:flex-start;margin-top:2px;">
          <span class="chip" style="font-size:9.5px;padding:4px 9px;">Este trimestre</span>
          <span class="chip" style="font-size:9.5px;padding:4px 9px;">Todas las regiones</span>
        </div>
      </div>

      <div class="dash-tile">
        <span class="dash-tile-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></svg>Distribución por producto</span>
        <div class="gauge-wrap" style="height:84px;">
          <svg viewBox="0 0 100 100" style="transform:rotate(-90deg)">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#2a3140" stroke-width="12"/>
            <circle id="pie1" cx="50" cy="50" r="45" fill="none" stroke="#22c55e" stroke-width="12" stroke-dasharray="127 283" stroke-dashoffset="127" data-anim-prop="stroke-dashoffset" data-anim-final="0"/>
            <circle id="pie2" cx="50" cy="50" r="45" fill="none" stroke="#6b9fff" stroke-width="12" stroke-dasharray="85 283" stroke-dashoffset="42" data-anim-prop="stroke-dashoffset" data-anim-final="-127"/>
            <circle id="pie3" cx="50" cy="50" r="45" fill="none" stroke="#dfb35a" stroke-width="12" stroke-dasharray="71 283" stroke-dashoffset="-141" data-anim-prop="stroke-dashoffset" data-anim-final="-212"/>
          </svg>
        </div>
        <div class="legend"><span><i style="background:#22c55e;"></i>Excel 45%</span><span><i style="background:#6b9fff;"></i>Power BI 30%</span><span><i style="background:#dfb35a;"></i>Auto 25%</span></div>
      </div>

      <div class="dash-tile">
        <span class="dash-tile-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h16M7 12h10M10 19h4" stroke-linecap="round"/></svg>Filtro de segmentación</span>
        <div class="slicer-pills">
          <span class="slicer-pill active reveal" data-k="sl1">Todas</span>
          <span class="slicer-pill reveal" data-k="sl2">Norte</span>
          <span class="slicer-pill reveal" data-k="sl3">Centro</span>
          <span class="slicer-pill reveal" data-k="sl4">Sur</span>
        </div>
        <div class="timeline-wrap">
          <div class="timeline-track"><div class="timeline-range reveal" id="timelineRange"></div></div>
          <div class="timeline-ticks"><span>Ene</span><span>Abr</span><span>Jul</span><span>Oct</span><span>Dic</span></div>
        </div>
      </div>

      <div class="dash-tile">
        <span class="dash-tile-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20V10M10 20V4M16 20v-7M22 20v4"/></svg>Ventas por región y tendencia</span>
        <div class="bars-row">
          <div class="bar-col"><span class="bar-val reveal" id="barValA">$185k</span><i id="barA" data-anim-prop="height-pct" data-anim-final="85"></i><span class="bar-tag">Q1</span></div>
          <div class="bar-col"><span class="bar-val reveal" id="barValB">$130k</span><i id="barB" data-anim-prop="height-pct" data-anim-final="60"></i><span class="bar-tag">Q2</span></div>
          <div class="bar-col"><span class="bar-val reveal" id="barValC">$206k</span><i id="barC" data-anim-prop="height-pct" data-anim-final="95"></i><span class="bar-tag">Q3</span></div>
          <div class="bar-col"><span class="bar-val reveal" id="barValD">$87k</span><i id="barD" data-anim-prop="height-pct" data-anim-final="40"></i><span class="bar-tag">Q4</span></div>
        </div>
        <svg viewBox="-2 -12 120 82" style="width:100%;height:76px;">
          <line x1="0" x2="100" y1="10" y2="10" stroke="var(--line-soft)" stroke-width=".6"/>
          <line x1="0" x2="100" y1="32" y2="32" stroke="var(--line-soft)" stroke-width=".6"/>
          <line x1="0" x2="100" y1="55" y2="55" stroke="var(--line-soft)" stroke-width=".6"/>
          <path id="lineArea" d="M2,55 L22,45 L42,50 L62,28 L82,18 L98,8 L98,62 L2,62 Z" fill="url(#lineGrad)" opacity="0"/>
          <defs><linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14b8a6" stop-opacity=".35"/><stop offset="1" stop-color="#14b8a6" stop-opacity="0"/></linearGradient></defs>
          <path id="lineChart" d="M2,55 L22,45 L42,50 L62,28 L82,18 L98,8" fill="none" stroke="#14b8a6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" data-anim-prop="stroke-dashoffset" data-anim-final="0"/>
          <path id="lineProj" d="M98,8 L114,-2" fill="none" stroke="#dfb35a" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="3 3" pathLength="100" stroke-dashoffset="100" opacity="0" data-anim-prop="stroke-dashoffset" data-anim-final="0"/>
          <g id="lineMarkers" opacity="0">
            <circle cx="2" cy="55" r="2.6" fill="#14b8a6"/><circle cx="22" cy="45" r="2.6" fill="#14b8a6"/><circle cx="42" cy="50" r="2.6" fill="#14b8a6"/>
            <circle cx="62" cy="28" r="2.6" fill="#14b8a6"/><circle cx="82" cy="18" r="2.6" fill="#14b8a6"/><circle cx="98" cy="8" r="2.8" fill="#eafff9" stroke="#14b8a6" stroke-width="1.4"/>
            <text x="2" y="-3" font-size="6.5" fill="var(--text-faint)" font-family="monospace">$28k</text>
            <text x="90" y="4" font-size="6.5" fill="#eafff9" font-family="monospace">$61k</text>
          </g>
          <text x="100" y="-6" font-size="6" fill="#dfb35a" font-family="monospace" opacity="0" id="projLabel">proyección</text>
        </svg>
      </div>

      <div class="dash-tile">
        <span class="dash-tile-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 20l-6-3V4l6 3m0 13 6-3m-6 3V7m6 13 6-3V4l-6 3m0 13V7m0 0L9 4"/></svg>Cobertura por región</span>
        <svg class="mx-map" viewBox="0 0 310 195">
          <g id="mapFill" class="reveal">
            <path d="M30,5 L66,17 L93,17 L109,12 L128,34 L142,40 L157,32 L176,55 L197,71 L192,105 L209,138 L224,148 L243,144 L257,142 L264,120 L295,115 L290,145 L275,152 L257,158 L245,185 L223,168 L204,173 L180,163 L154,152 L121,128 L118,105 L95,75 L71,51 L49,32 L31,13 Z" fill="rgba(20,184,166,.10)"/>
            <path d="M8,5 L31,3 L30,13 L48,35 L63,65 L81,98 L76,101 L57,83 L33,52 L20,31 Z" fill="rgba(20,184,166,.10)"/>
          </g>
          <path id="mapOutline" d="M30,5 L66,17 L93,17 L109,12 L128,34 L142,40 L157,32 L176,55 L197,71 L192,105 L209,138 L224,148 L243,144 L257,142 L264,120 L295,115 L290,145 L275,152 L257,158 L245,185 L223,168 L204,173 L180,163 L154,152 L121,128 L118,105 L95,75 L71,51 L49,32 L31,13 Z" fill="none" stroke="#14b8a6" stroke-width="1.6" stroke-linejoin="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" data-anim-prop="stroke-dashoffset" data-anim-final="0"/>
          <path id="mapOutlineBaja" d="M8,5 L31,3 L30,13 L48,35 L63,65 L81,98 L76,101 L57,83 L33,52 L20,31 Z" fill="none" stroke="#14b8a6" stroke-width="1.6" stroke-linejoin="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" data-anim-prop="stroke-dashoffset" data-anim-final="0"/>
          <g class="map-dot-g reveal"><circle class="map-ring" cx="122" cy="32" r="9"/><circle cx="122" cy="32" r="6.5" fill="#22c55e"/><text x="134" y="25" class="map-lbl">Norte</text></g>
          <g class="map-dot-g reveal"><circle class="map-ring" cx="168" cy="73" r="8"/><circle cx="168" cy="73" r="5.5" fill="#6b9fff"/><text x="178" y="68" class="map-lbl">Noreste</text></g>
          <g class="map-dot-g reveal"><circle class="map-ring" cx="160" cy="118" r="8"/><circle cx="160" cy="118" r="5.5" fill="#dfb35a"/><text x="96" y="114" class="map-lbl">Bajío</text></g>
          <g class="map-dot-g reveal"><circle class="map-ring" cx="181" cy="134" r="9"/><circle cx="181" cy="134" r="6.5" fill="#14b8a6"/><text x="192" y="132" class="map-lbl">Centro</text></g>
          <g class="map-dot-g reveal"><circle class="map-ring" cx="203" cy="160" r="7"/><circle cx="203" cy="160" r="5" fill="#a78bfa"/><text x="214" y="168" class="map-lbl">Sur</text></g>
        </svg>
      </div>

    </div>
  </div>
</section>


  <section class="viaje-scene" id="sceneAutomatiza">
    <div class="immersive" style="opacity:1;"></div>
    <div class="viaje-stage">
      <div class="viaje-msg"><div class="formula-msg" id="msgWrap4"><span class="formula-msg-fx">fx</span><span class="formula-msg-text" id="msgText4">Deja que la IA haga el trabajo duro.<span class="formula-msg-cursor"></span></span></div></div>
      <div class="auto-stage">
        <div class="toolbar-grid reveal" id="toolbar5">
          <div class="tool-btn" id="btnMail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z"/><path d="m4 6 8 7 8-7"/></svg>Enviar<div class="tool-btn-fx" id="fxMail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
          <div class="tool-btn" id="btnDown"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" stroke-linecap="round" stroke-linejoin="round"/></svg>Descargar<div class="mini-bar"><i id="downBar" data-anim-prop="width-pct" data-anim-final="100"></i></div></div>
          <div class="tool-btn" id="btnRec"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/></svg>Registrar<div class="rec-dot" id="recDot"></div></div>
          <div class="tool-btn" id="btnRef"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4v6h6M20 20v-6h-6M4.5 15a8 8 0 0 0 14.5 3.5M19.5 9a8 8 0 0 0-14.5-3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Actualizar<div class="tool-btn-fx" id="fx5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
          <div class="tool-btn" id="btnClean"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20l4-4m0 0 9-9 4 4-9 9m-4-4 4 4M14 7l3 3"/></svg>Limpiar<div class="tool-btn-fx" id="fx6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
          <div class="tool-btn" id="btnRep"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2h9l5 5v15H6z"/><path d="M12 12v6M9 15h6"/></svg>Crear reporte<div class="tool-btn-fx" id="fx7"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
          <div class="tool-btn" id="btnEval"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10" stroke-linecap="round" stroke-linejoin="round"/></svg>Evaluar<div class="tool-btn-fx" id="fx8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
          <div class="tool-btn" id="btnApr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 11v9M2 13v5a2 2 0 0 0 2 2h12.5a2 2 0 0 0 2-1.4l2-7A2 2 0 0 0 18.6 9H14l1-5a2 2 0 0 0-2-2.4L9 9H7"/></svg>Aprobaciones<div class="tool-btn-fx" id="fx9"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
          <div class="tool-btn" id="btnPres"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/></svg>Presentar<div class="tool-btn-fx" id="fx10"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
          <div class="tool-btn" id="btnEdit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/></svg>Editar<div class="tool-btn-fx" id="fx11"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
          <div class="tool-btn" id="btnDark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36A5.5 5.5 0 0 1 12 3Z" stroke-linecap="round" stroke-linejoin="round"/></svg>Modo oscuro<div class="tool-btn-fx" id="fx12"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
          <div class="tool-btn" id="btnLight"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke-linecap="round"/></svg>Modo claro<div class="tool-btn-fx" id="fx13"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
          <svg class="flyer" id="flyMail" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z"/><path d="m4 6 8 7 8-7"/></svg>
          <svg class="cursor-ico reveal" id="cursor5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l15 7-6.2 1.6L11 17z"/></svg>
          <div class="click-ripple" id="ripple5"></div>
        </div>
        <div class="copilot-panel reveal" id="copilotPanel">
          <div class="copilot-head"><svg viewBox="0 0 24 24" width="19" height="19"><defs><linearGradient id="cpGrad" x1="7" y1="3" x2="18" y2="22"><stop offset="0" stop-color="#6b9fff"/><stop offset=".55" stop-color="#a78bfa"/><stop offset="1" stop-color="#14b8a6"/></linearGradient></defs><path d="M12 3.5c-2.9 0-4.9 2-4.9 4.6 0 1.9 1.2 3.2 2.8 3.9-1.6.7-2.8 2-2.8 3.9 0 2.6 2 4.6 4.9 4.6s4.9-2 4.9-4.6c0-1.9-1.2-3.2-2.8-3.9 1.6-.7 2.8-2 2.8-3.9 0-2.6-2-4.6-4.9-4.6Z" fill="url(#cpGrad)"/></svg>Copilot</div>
          <div class="bubble user reveal" id="bubbleUser">Envíame un resumen del dashboard cada lunes</div>
          <div class="bubble ai reveal" id="bubbleAi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Listo. Son muchas automatizaciones — y todas corren solas.</span></div>
          <div class="bubble user reveal" id="bubbleUser2">¿También las aprobaciones?</div>
          <div class="bubble ai reveal" id="bubbleAi2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Claro — ya quedó enlazada con tu flujo.</span></div>
        </div>
      </div>
    </div>
  </section>

  <div class="viaje-handoff"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg><p>El viaje vende, el catálogo cierra ↓</p></div>
</div>`;
    },

    iniciar() {
      const root = document.getElementById("viajeExcel");
      if (!root) return;

      // sortea en qué celda cae cada función — nunca la misma hoja dos veces
      const pool = shuffle(Array.prototype.slice.call(root.querySelectorAll("#capStage .cap-cell:not(.hd)")));
      const classicCells = this.classicFns.map((fn, i) => { const c = pool[i]; c.textContent = fn; c.classList.add("cap-fn", "reveal"); return c; });
      const newCells = this.newFns.map((fn, i) => { const c = pool[this.classicFns.length + i]; c.textContent = fn; c.classList.add("cap-fn", "new", "reveal"); return c; });

      const NAV = ViajeEngine.navOffset(root);
      document.documentElement.style.setProperty("--viaje-nav-h", NAV + "px");

      const { simple } = ViajeEngine.esSimpleMode();
      if (simple) { ViajeEngine.forceFinalState(root); return; }

      gsap.registerPlugin(ScrollTrigger);
      const rail = root.querySelector("#viajeRail");
      function setActive(n) { rail.querySelectorAll(".rail-item").forEach((it) => it.classList.toggle("active", it.dataset.scene === String(n))); }

      const $ = (sel) => root.querySelector(sel);
      const q = (sel) => Array.prototype.slice.call(root.querySelectorAll(sel));

      ScrollTrigger.create({ trigger: "#sceneHero", start: "top center", end: "bottom center", onToggle: (self) => self.isActive && setActive(1) });
      setActive(1);

      // ---- 2: CAPTURA ----
      const tl1 = gsap.timeline({ scrollTrigger: { trigger: "#sceneCaptura", start: "top top", end: "+=170%", scrub: 1, pin: true, onToggle: (self) => self.isActive && setActive(2) } });
      tl1.to("#capStage", { opacity: 1, duration: 4 }, 0);
      classicCells.forEach((cell, i) => tl1.to(cell, { opacity: 1, duration: 4 }, 4 + i * 3));
      tl1.to("#msgText1a", { clipPath: "inset(0 0% 0 0)", duration: 10 }, 2);
      tl1.to("#msgWrap1a", { opacity: 0, duration: 4 }, 32);
      tl1.set("#msgWrap1a", { display: "none" }, 36);
      tl1.set("#msgWrap1b", { display: "inline-flex", opacity: 1 }, 36);
      tl1.to("#msgText1b", { clipPath: "inset(0 0% 0 0)", duration: 9 }, 37);
      newCells.forEach((cell, i) => { gsap.set(cell, { opacity: 0, scale: .4 }); tl1.to(cell, { opacity: 1, scale: 1, duration: 3.2 }, 40 + i * 3.8); });
      tl1.to("#capStage", { opacity: 0, scale: .94, duration: 14 }, 86);

      // ---- 2: ORGANIZA ----
      const tl2 = gsap.timeline({ scrollTrigger: { trigger: "#sceneOrganiza", start: "top top", end: "+=175%", scrub: 1, pin: true, onToggle: (self) => self.isActive && setActive(3) } });
      tl2.fromTo("#orgLeft", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 8 }, 0);
      tl2.fromTo("#orgRight", { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 8 }, 0);
      tl2.to("#msgText2", { clipPath: "inset(0 0% 0 0)", duration: 10 }, 2);
      tl2.to('[data-fico]', { opacity: 1, duration: 5, stagger: 2 }, 9);
      tl2.to('#otable3 tr[data-row="lic"] td, #otable3 tr[data-row="con"] td', { opacity: .15, duration: 6 }, 18);
      tl2.to('#otable3 tr[data-row="sop"] td, #otable3 tr[data-row="cap"] td', { color: "#fff", duration: 6 }, 18);
      tl2.to('#otable3 tr[data-row="lic"] td', { opacity: 1, duration: 6 }, 30);
      tl2.to('#otable3 tr[data-row="sop"] td', { y: 34, duration: 8 }, 32);
      tl2.to('#otable3 tr[data-row="cap"] td', { y: 34, duration: 8 }, 32);
      tl2.to('#otable3 tr[data-row="con"] td', { opacity: 1, y: -68, duration: 8 }, 32);
      ["x1", "x2", "x3"].forEach((k, i) => tl2.to(`[data-k="${k}"]`, { opacity: 1, duration: 5 }, 42 + i * 4));
      ["m1", "m2", "m3", "m5", "m6", "m4"].forEach((k, i) => tl2.to(`[data-k="${k}"]`, { opacity: 1, duration: 5 }, 46 + i * 5));
      tl2.to("#orgLeft", { opacity: 0, x: -50, duration: 14 }, 84);
      tl2.to("#orgRight", { opacity: 0, x: 50, duration: 14 }, 84);

      // ---- 3: DECIDE ----
      const tl3 = gsap.timeline({ scrollTrigger: { trigger: "#sceneDecide", start: "top top", end: "+=195%", scrub: 1, pin: true, onToggle: (self) => self.isActive && setActive(4) } });
      tl3.to("#imm4", { opacity: 1, duration: 8 }, 0);
      tl3.to("#msgText3", { clipPath: "inset(0 0% 0 0)", duration: 10 }, 1);
      tl3.to("#dashGrid", { opacity: 1, y: 0, duration: 8 }, 3);
      tl3.to('[data-k="sl1"], [data-k="sl2"], [data-k="sl3"], [data-k="sl4"]', { opacity: 1, duration: 4, stagger: 2 }, 8);
      tl3.to("#timelineRange", { opacity: 1, width: "55%", duration: 10 }, 16);
      tl3.to("#lineArea", { opacity: 1, duration: 6 }, 34);
      tl3.to("#barValA, #barValB, #barValC, #barValD", { opacity: 1, duration: 4, stagger: 2 }, 37);
      tl3.to("#gA", { attr: { "stroke-dashoffset": 18 }, duration: 14 }, 10);
      tl3.to("#pie1", { attr: { "stroke-dashoffset": 0 }, duration: 10 }, 18);
      tl3.to("#pie2", { attr: { "stroke-dashoffset": -127 }, duration: 10 }, 22);
      tl3.to("#pie3", { attr: { "stroke-dashoffset": -212 }, duration: 10 }, 26);
      tl3.to("#lineChart", { attr: { "stroke-dashoffset": 0 }, duration: 16 }, 24);
      tl3.to("#lineMarkers", { opacity: 1, duration: 4 }, 38);
      tl3.to("#lineProj", { opacity: 1, duration: 1 }, 40);
      tl3.to("#lineProj", { attr: { "stroke-dashoffset": 0 }, duration: 8 }, 40);
      tl3.to("#projLabel", { opacity: 1, duration: 4 }, 44);
      tl3.to("#barA", { height: "85%", duration: 8 }, 36);
      tl3.to("#barB", { height: "60%", duration: 8 }, 39);
      tl3.to("#barC", { height: "95%", duration: 8 }, 42);
      tl3.to("#barD", { height: "40%", duration: 8 }, 45);
      tl3.to("#hb1", { width: "95%", duration: 8 }, 14);
      tl3.to("#hb2", { width: "63%", duration: 8 }, 17);
      tl3.to("#hb3", { width: "51%", duration: 8 }, 20);
      tl3.to("#hb4", { width: "29%", duration: 8 }, 23);
      tl3.to("#hb5", { width: "20%", duration: 8 }, 26);
      tl3.to("#mapFill", { opacity: 1, duration: 8 }, 40);
      tl3.to("#mapOutline, #mapOutlineBaja", { attr: { "stroke-dashoffset": 0 }, duration: 14 }, 38);
      q(".map-dot-g").forEach((g, i) => tl3.to(g, { opacity: 1, duration: 4 }, 52 + i * 6));
      tl3.to("#dashGrid, #imm4", { opacity: 0, scale: .95, duration: 12 }, 87);

      // ---- 4: AUTOMATIZA ----
      const tl4 = gsap.timeline({ scrollTrigger: { trigger: "#sceneAutomatiza", start: "top top", end: "+=190%", scrub: 1, pin: true, onToggle: (self) => self.isActive && setActive(5) } });
      tl4.to("#toolbar5, #copilotPanel", { opacity: 1, y: 0, duration: 6 }, 0);
      tl4.to("#msgText4", { clipPath: "inset(0 0% 0 0)", duration: 9 }, 1);
      tl4.fromTo("#cursor5", { opacity: 0, x: 360, y: 180 }, { opacity: 1, duration: 3 }, 4);
      tl4.to("#bubbleUser", { opacity: 1, duration: 5 }, 8);
      tl4.to("#bubbleAi", { opacity: 1, duration: 5 }, 14);
      tl4.to("#bubbleUser2", { opacity: 1, duration: 4 }, 58);
      tl4.to("#bubbleAi2", { opacity: 1, duration: 4 }, 64);

      const btnPos = {
        btnMail: [77, 62], btnDown: [206, 62], btnRec: [335, 62], btnRef: [464, 62],
        btnClean: [77, 155], btnRep: [206, 155], btnEval: [335, 155], btnApr: [464, 155],
        btnPres: [77, 239], btnEdit: [206, 239], btnDark: [335, 239], btnLight: [464, 239],
      };
      function clickAt(pos, btnId, after) {
        const p = btnPos[btnId];
        tl4.to("#cursor5", { x: p[0], y: p[1], duration: 6 }, pos);
        tl4.to("#ripple5", { x: p[0] + 8, y: p[1] + 2, scale: 1, opacity: 1, duration: 2 }, pos + 6);
        tl4.to("#ripple5", { scale: 1.6, opacity: 0, duration: 3 }, pos + 7);
        if (after) after(pos + 8);
      }
      clickAt(20, "btnMail", (p) => {
        tl4.to("#fxMail", { opacity: 1, scale: 1, duration: 3 }, p);
        tl4.fromTo("#flyMail", { opacity: 0, x: 27, y: 32 }, { opacity: 1, duration: 2 }, p);
        tl4.to("#flyMail", { x: 330, y: -150, opacity: 0, duration: 7 }, p + 2);
      });
      clickAt(34, "btnDown", (p) => tl4.to("#downBar", { width: "100%", duration: 7 }, p));
      clickAt(46, "btnRec", (p) => tl4.to("#recDot", { opacity: 1, duration: 1, repeat: 3, yoyo: true }, p));
      clickAt(55, "btnRef", (p) => tl4.to("#fx5", { opacity: 1, scale: 1, duration: 3 }, p));
      clickAt(63, "btnClean", (p) => tl4.to("#fx6", { opacity: 1, scale: 1, duration: 3 }, p));
      clickAt(70, "btnRep", (p) => tl4.to("#fx7", { opacity: 1, scale: 1, duration: 3 }, p));
      clickAt(76, "btnEval", (p) => tl4.to("#fx8", { opacity: 1, scale: 1, duration: 3 }, p));
      clickAt(81, "btnApr", (p) => tl4.to("#fx9", { opacity: 1, scale: 1, duration: 3 }, p));
      tl4.to("#toolbar5, #copilotPanel, #cursor5", { opacity: 0, y: -10, duration: 10 }, 92);

      // inmersivo: del primer pin al último, nav y categorías se esconden
      document.body.classList.add("viaje-on");
      ScrollTrigger.create({ trigger: "#sceneCaptura", start: "top top", end: () => tl4.scrollTrigger.end, onToggle: (self) => document.body.classList.toggle("viaje-inmersivo", self.isActive) });

      ScrollTrigger.refresh();
      window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
    },
  };

  const VIAJE_SCENES = { excel: ExcelScenes };

  window.ViajeHerramienta = {
    tieneConfig(cat) { return !!VIAJE_SCENES[cat]; },
    html(cat) { return VIAJE_SCENES[cat] ? VIAJE_SCENES[cat].renderHtml() : ""; },
    iniciar(cat) { if (VIAJE_SCENES[cat]) VIAJE_SCENES[cat].iniciar(); },
    // al cambiar de herramienta el panel se reemplaza: hay que soltar los pins viejos
    destruir() { if (window.ScrollTrigger) ScrollTrigger.getAll().forEach((t) => t.kill()); document.body.classList.remove("viaje-on", "viaje-inmersivo"); },
  };
})();
