// assets/js/viaje-pa.js
// Viaje de Power Apps (scrollytelling GSAP) para cursos.html. Se registra en window.ViajeEscenas (ver viaje.js: expone el
// motor compartido ViajeEngine con rel/cen/tipea/morph). Mismo método que Power BI, Ofimática e IA: cáscara fija + UN dato
// que viaja + un lienzo de 1100×620 con UN pin y UNA línea de tiempo maestra. Recorre una app de solicitudes de compra:
//   Acceso (login con rol) → Registro (formulario) → Automatiza (flujo: SharePoint + Teams + aprobación) → Consulta (galería).
//
// Decisiones que NO hay que repetir si esto se toca:
//   - La cáscara es Power Apps Studio: barra con la app, cuadro de PROPIEDAD con la fórmula activa (OnStart, OnSelect,
//     OnSuccess, Items; como el cuadro de nombres de Excel), barra fx con el mensaje, pantallas a la izquierda (riel) y
//     tira Acceso › Registro › Automatiza › Consulta.
//   - Tres de las cuatro escenas son pantallas de LA MISMA app: un solo marco de tableta (#paFrame) donde las pantallas se
//     deslizan como en una app real. La escena de flujos sale de la app: el marco se encoge a un lado y aparece el flujo.
//   - Orden acordado con Alfredo: Login → Formulario → Flujos → Galería (la aprobación nace del Enviar del formulario y la
//     galería cierra la historia con la solicitud ya "Aprobada" + buscar/filtrar/ordenar).
//   - El dato que viaja: la ficha "Solicitud #0042" sale del resumen del formulario, recorre los pasos del flujo (SharePoint,
//     Teams, aprobación, actualizar) y aterriza como primera fila de la galería. Sin informe de BI a propósito (no satura).
//   - Móvil táctil: sin pin; el marco y las pantallas pasan a display:contents y cada pantalla es una tarjeta apilada
//     (order en CSS). Estático (reduced-motion o GSAP caído): todo en su estado final (pa-final + estadoFinal()).
(function () {
  "use strict";
  const E = window.ViajeEngine;
  if (!E || !window.ViajeEscenas || !E.morph) return;
  const { rel, cen, tipea } = E;

  // ---- constantes de la animación (unidades de la línea de tiempo maestra) ----
  const S = { l: 0, f: 108, a: 216, g: 324 };          // inicio de cada escena
  const TR = { lf: 92, fa: 200, ag: 308 };             // inicio de cada transición
  const TOTAL = 430;
  const UMBRAL = [100, 208, 316];                      // unidades donde cambia la escena activa
  const IR_A = { 1: 88, 2: 196, 3: 304, 4: 422 };      // a dónde aterriza cada pestaña (todo ya dibujado)
  const RH = 54;                                       // alto de fila de la galería (px; igual en CSS)

  const MSGS = [
    "Controla quién entra y qué puede hacer.",
    "Captura datos bien, a la primera.",
    "Deja que el flujo avise, guarde y pida la aprobación.",
    "Consulta, busca y filtra lo que importa.",
  ];
  const PROPS = ["", "OnStart", "OnSelect", "OnSuccess", "Items"];
  const ESTADOS = ["App Compras · sin abrir", "1 pantalla · rol del usuario", "Pantalla Solicitud · 6 controles", "Flujo · 5 pasos", "Pantalla Consulta · 5 solicitudes"];
  const RIEL = [null, "acceso", "registro", "automatiza", "consulta"];
  const NEUTRO = { backgroundColor: "rgba(192,38,211,0)", borderColor: "#2a3342", color: "#b4bfd0" };
  const ACTIVO = { backgroundColor: "rgba(192,38,211,.22)", borderColor: "#c026d3", color: "#f0abfc" };

  // ---- íconos de línea (propios) ----
  const svg = (d, w) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const I = {
    flecha: svg('<path d="M12 5v14M5 12l7 7 7-7"/>', 2.2),
    check: svg('<path d="M5 13l4 4L19 7"/>', 3),
    equis: svg('<path d="M6 6l12 12M18 6L6 18"/>', 2.6),
    candado: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 1.9),
    carrito: svg('<path d="M3 4h3l2.5 11h9.5l2-8H7"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>', 1.9),
    lupa: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>', 2),
    reloj: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 1.9),
    clip: svg('<path d="M8 12.5l6.5-6.5a3.5 3.5 0 0 1 5 5L10.5 20a5.5 5.5 0 0 1-7.8-7.8L11 4"/>', 1.8),
    calendario: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    lista: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/>'),
    chat: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
    aprobar: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', 2),
    rayo: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', 1.8),
    cursor: '<svg class="cursor-ico reveal pa-cur no-final" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l15 7-6.2 1.6L11 17z"/></svg>',
    acceso: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    registro: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
    automatiza: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    consulta: svg('<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="7" cy="6" r=".6"/><circle cx="7" cy="12" r=".6"/><circle cx="7" cy="18" r=".6"/>'),
    app: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><path d="M17 13v8M13 17h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  };
  const xf = (a, b, cls) => '<span class="xf ' + (cls || "") + '"><b class="a">' + a + '</b><b class="b">' + b + "</b></span>";

  function msgBloque(n) {
    return '<div class="viaje-msg" style="order:' + (n * 10) + '"><div class="formula-msg"><span class="formula-msg-fx">fx</span><span class="formula-msg-text">' + MSGS[n - 1] + '<span class="formula-msg-cursor"></span></span></div></div>';
  }

  // =====================  PANTALLA · LOGIN  =====================
  function sceneLogin() {
    const perm = [["check", "Crear solicitudes de compra", ""], ["check", "Ver sus propias solicitudes", ""], ["candado", "Aprobar solicitudes", " · solo Aprobadores"]]
      .map((p) => '<li class="reveal' + (p[0] === "candado" ? " no" : "") + '"><span class="ik">' + I[p[0]] + "</span>" + p[1] + "<em>" + p[2] + "</em></li>").join("");
    return '<div class="pa-s lg" id="sLogin">' +
      '<div class="lg-brand"><span class="lg-logo">' + I.carrito + "</span><h2>Compras</h2><p>Solicita, aprueba y da seguimiento a tus compras en un solo lugar.</p><i class=\"c1\"></i><i class=\"c2\"></i></div>" +
      '<div class="lg-card"><div class="lg-in" id="lgIn"><span class="lg-org">Grupo Demo</span><h3>Inicia sesión</h3><label>Correo de la empresa</label>' +
      '<div class="lg-field"><span class="cl" id="lgEm">alfredo.pina@grupodemo.com</span></div>' +
      '<div class="lg-btn" id="lgBtn">' + xf("Iniciar sesión", "Verificando…") + '</div><small>Acceso protegido con tu cuenta de la empresa</small></div>' +
      '<div class="lg-hello reveal" id="lgHello"><i class="av">AP</i><h3>Hola, Alfredo</h3><span class="lg-rol">Rol: Solicitante</span><ul class="lg-perm">' + perm + '</ul><div class="lg-btn lg-go" id="lgGo">Entrar</div></div></div></div>';
  }

  // =====================  PANTALLA · FORMULARIO  =====================
  function sceneForm() {
    const campo = (id, lb, valor, extra) => '<div class="fm-c' + (extra ? " " + extra : "") + '"><label>' + lb + '</label><div class="fm-in"><span class="cl" id="' + id + '">' + valor + '</span><i class="fm-ok reveal"><span class="ik">' + I.check + "</span></i></div></div>";
    const fila = (id, lb, v) => '<div class="rs-r"><span>' + lb + '</span><b class="reveal" id="' + id + '">' + v + "</b></div>";
    return '<div class="pa-s fm" id="sForm">' +
      '<div class="fm-h"><span class="fm-back">‹</span><b>Nueva solicitud</b><span class="fm-us"><i class="av">AP</i>Solicitante</span></div>' +
      '<div class="fm-body"><div class="fm-f">' +
      campo("fTit", "Título", "Laptop para ventas", "w2") +
      '<div class="fm-c" id="fCatC"><label>Categoría</label><div class="fm-in fm-sel"><span class="cl" id="fCat">Equipo de cómputo</span><span class="ch">▾</span><i class="fm-ok reveal"><span class="ik">' + I.check + '</span></i>' +
      '<div class="fm-pop reveal" id="fPop"><span>Software</span><span class="sel" id="fPopSel">Equipo de cómputo</span><span>Mobiliario</span></div></div></div>' +
      '<div class="fm-c"><label>Fecha requerida</label><div class="fm-in"><span class="ik cal">' + I.calendario + '</span><span class="cl" id="fFec">30 oct 2026</span><i class="fm-ok reveal"><span class="ik">' + I.check + "</span></i></div></div>" +
      '<div class="fm-c w2"><label>Importe estimado <b id="fImpV">$0</b></label><div class="fm-sl"><i class="fm-fill" id="fFill"></i><i class="fm-th" id="fTh"></i></div></div>' +
      '<div class="fm-c"><label>¿Es urgente?</label><div class="fm-tg" id="fTg"><i></i>' + xf("No", "Sí") + '</div></div>' +
      '<div class="fm-c"><label>Cotización</label><div class="fm-at reveal" id="fAt"><span class="ik">' + I.clip + "</span>Cotizacion_laptop.pdf<em>214 KB</em></div></div>" +
      '<div class="fm-btns w2"><span class="fm-no">Cancelar</span><span class="fm-send" id="fSend">' + xf("Enviar solicitud", "Enviando…") + "</span></div>" +
      '</div><aside class="fm-r" id="fResumen"><div class="rs-h">Resumen</div>' +
      fila("rT", "Título", "Laptop para ventas") + fila("rC", "Categoría", "Equipo de cómputo") + fila("rF", "Fecha", "30 oct 2026") + fila("rI", "Importe", "$18,500") + fila("rU", "Urgente", "Sí") +
      '<div class="rs-ap"><span class="ik">' + I.aprobar + '</span>Aprobador: Dirección de Operaciones</div>' +
      '<div class="rs-p"><span>Datos completos <span id="rsN-x">' + xf("0/5", "5/5") + '</span></span><div class="rs-bar"><i id="rsFill"></i></div></div></aside></div>' +
      '<div class="fm-done reveal" id="fDone"><span class="ik">' + I.check + '</span><b>Solicitud enviada</b><span>Folio #0042</span></div></div>';
  }

  // =====================  PANTALLA · GALERÍA  =====================
  const FILAS = [
    { k: "lap", t: "Laptop para ventas", c: "Equipo", i: "$18,500", f: "22 oct", e: "ok", nuevo: 1 },
    { k: "mon", t: "Monitores 27\" (x3)", c: "Equipo", i: "$9,600", f: "20 oct", e: "pen" },
    { k: "lic", t: "Licencias Power BI", c: "Software", i: "$24,000", f: "18 oct", e: "ok" },
    { k: "sil", t: "Silla ergonómica", c: "Mobiliario", i: "$4,200", f: "15 oct", e: "no" },
    { k: "cur", t: "Curso de capacitación", c: "Servicios", i: "$12,800", f: "12 oct", e: "pen" },
  ];
  const ORDEN = FILAS.map((f) => f.k);
  const EST = { ok: ["check", "Aprobada"], pen: ["reloj", "Pendiente"], no: ["equis", "Rechazada"] };
  function sceneGal() {
    const fila = (f) => '<div class="gl-row reveal" data-k="' + f.k + '"><span class="gl-ic"><span class="ik">' + I.carrito + '</span></span><div class="gl-t"><b>' + f.t + (f.nuevo ? '<em class="gl-nuevo">Nueva</em>' : "") + "</b><span>" + f.c + " · " + f.f + '</span></div><span class="gl-im">' + f.i + '</span><span class="gl-st ' + f.e + '"><span class="ik">' + I[EST[f.e][0]] + "</span>" + EST[f.e][1] + "</span></div>";
    const chip = (t, n, i) => '<span class="gl-chip" data-i="' + i + '" style="background-color:' + (i === 0 ? ACTIVO.backgroundColor : NEUTRO.backgroundColor) + ";border-color:" + (i === 0 ? ACTIVO.borderColor : NEUTRO.borderColor) + ";color:" + (i === 0 ? ACTIVO.color : NEUTRO.color) + '">' + t + " <b>" + n + "</b></span>";
    return '<div class="pa-s gl" id="sGal">' +
      '<div class="gl-h"><b>Mis solicitudes</b><span class="fm-us"><i class="av">AP</i>Solicitante</span></div>' +
      '<div class="gl-tool"><div class="gl-search" id="glSearch"><span class="ik">' + I.lupa + '</span><span class="gl-ph">Buscar…</span><span class="cl gl-q" id="glQ">equipo</span></div>' +
      '<div class="gl-chips" id="glChips">' + chip("Todas", 5, 0) + chip("Pendiente", 2, 1) + chip("Aprobada", 2, 2) + chip("Rechazada", 1, 3) + "</div>" +
      '<span class="gl-sort" id="glSort">' + xf("Recientes ▾", "Importe ↓ ▾") + '</span></div>' +
      '<div class="gl-list" id="glList">' + FILAS.map(fila).join("") + "</div></div>";
  }

  // =====================  ESCENA · FLUJO  =====================
  function sceneFlow() {
    const nodo = (id, color, ico, tit, sub) => '<div class="fl-n reveal" id="' + id + '" style="--nc:' + color + '"><span class="fl-i"><span class="ik">' + I[ico] + '</span></span><div><b>' + tit + "</b><span>" + sub + '</span></div><i class="fl-ok reveal"><span class="ik">' + I.check + "</span></i></div>";
    const paso = (n, nodoHtml, prev, ln) => '<div class="fl-st fl-st' + n + '">' + nodoHtml + (prev || "") + "</div>" + (ln ? '<i class="fl-ln" id="fLn' + n + '"></i>' : "");
    const pv2 = '<div class="fl-pv reveal" id="pv2"><div class="sp-h"><span class="ik">' + I.lista + '</span>Solicitudes de compra · SharePoint</div><div class="sp-r"><span>0042</span><span>Laptop para ventas</span><span>$18,500</span><em>Nueva</em></div></div>';
    const pv3 = '<div class="fl-pv reveal" id="pv3"><div class="tm-t"><span class="ik">' + I.chat + '</span><div><b>Compras · Teams</b><span>Nueva solicitud: Laptop para ventas ($18,500)</span></div></div></div>';
    const pv4 = '<div class="fl-pv fl-ap reveal" id="pv4"><div class="ap-h"><span class="ik">' + I.aprobar + '</span>Aprobación · Compras</div><p>Laptop para ventas · <b>$18,500</b><br><span>Solicita: Alfredo Piña</span></p><div class="ap-b"><span class="ap-si" id="apSi">Aprobar</span><span class="ap-no">Rechazar</span></div><div class="ap-r reveal" id="apRes"><span class="ik">' + I.check + "</span>Aprobada por Dirección</div></div>";
    const pv5 = '<div class="fl-pv reveal" id="pv5"><div class="sp-r"><span>0042</span><span>Laptop para ventas</span>' + xf("Pendiente", "Aprobada", "est") + "</div></div>";
    return '<div class="pa-flow reveal" id="paFlow"><div class="fl-h"><b>Flujo · Aprobación de compra</b><span class="fl-run" id="flRun">' + xf("En ejecución…", "Completado") + "</span></div>" +
      paso(1, nodo("n1", "#742774", "app", "Power Apps", "Cuando se envía la solicitud"), "", 1) +
      paso(2, nodo("n2", "#038387", "lista", "SharePoint", "Crear elemento en la lista"), pv2, 1) +
      paso(3, nodo("n3", "#5b5fc7", "chat", "Teams", "Publicar un mensaje en el canal"), pv3, 1) +
      paso(4, nodo("n4", "#0f6cbd", "aprobar", "Aprobaciones", "Iniciar y esperar la aprobación"), pv4, 1) +
      paso(5, nodo("n5", "#038387", "lista", "SharePoint", "Actualizar el estatus"), pv5, 0) +
      I.cursor.replace('class="', 'id="curF" class="') + '<div class="click-ripple" id="ripF"></div></div>';
  }

  // ---- héroe: mitad texto, mitad la app (la pantalla de Consulta, en la tableta) interactiva ----
  // Copia con ids "h…" (los de la escena no se tocan; la pantalla usa ph-scr y no pa-scr para que `$(".pa-scr")` de las
  // escenas siga encontrando la suya). Buscar, filtrar por estatus y ordenar funcionan de verdad. Botón único con auto-scroll.
  const PH_ORDEN_IMPORTE = ["lic", "lap", "cur", "mon", "sil"];
  function heroHtml() {
    const gal = sceneGal().replace(/id="([A-Za-z]\w*)"/g, 'id="h$1"');
    return '<section class="viaje-hero hb-hero ph-hero" id="paHero"><div class="hb-copy"><span class="viaje-hero-eyebrow">Curso de Power Apps</span>' +
      '<h1 class="viaje-hero-title">Aplicaciones <span class="accent">low-code<span class="selector-box"><span class="selector-label">Button1</span></span></span></h1>' +
      '<div class="viaje-hero-chips"><span class="scope-chip">Digitalizadas</span><span class="scope-chip">Automatizadas</span><span class="scope-chip">Interconectadas</span></div>' +
      '<div class="hb-actions"><a href="#sLogin" class="viaje-btn solid hb-go" data-viaje-next><span>Conoce el programa</span>' + I.flecha + '<i class="hb-bar"></i></a><a href="#programas" class="hb-ver">Ver programas</a></div></div>' +
      '<div class="hb-stage"><div class="hb-frame ph-frame"><div class="hb-cv ph-cv" id="phCv"><div class="ph-bz"><div class="ph-scr">' + gal + "</div></div></div></div></div></section>";
  }

  // modo: "desk" (animado, interactivo y auto-scroll), "flujo" (teléfono) o "simple" (estado final)
  function heroDash(root, modo) {
    const cont = root.querySelector("#phCv");
    if (!cont) return null;
    const g = (id) => cont.querySelector("#h" + id), qa = (s) => Array.prototype.slice.call(cont.querySelectorAll(s));
    const stage = root.querySelector(".hb-stage");
    function escala() { cont.style.transform = root.classList.contains("bi-flujo") ? "" : "scale(" + (stage.clientWidth / 904).toFixed(4) + ")"; }
    if (root._hbEsc) window.removeEventListener("resize", root._hbEsc);
    root._hbEsc = escala; window.addEventListener("resize", escala); escala();

    const filas = qa(".gl-row"), chips = qa(".gl-chip"), q = g("glQ"), ph = qa(".gl-ph")[0], orden = g("glSort");
    q.style.clipPath = "inset(0 100% 0 0)";
    if (modo !== "desk") { filas.forEach((el) => { el.style.opacity = 1; }); return null; }

    const api = { introHecha: false, irA: null };
    gsap.to(filas, { opacity: 1, duration: 0.5, stagger: 0.14, delay: 0.5, onComplete: () => { api.introHecha = true; if (api.irA) E.autoBajar(root, api.irA); } });

    // estado de la app: chip de estatus (0 todas · 1 pendiente · 2 aprobada · 3 rechazada), búsqueda "equipo" y orden por importe
    const ESTATUS = [null, "pen", "ok", "no"];
    let chip = 0, busca = false, porImporte = false, usuario = false, ultimo = 0;
    function acomoda() {
      let vis = FILAS.filter((f) => (!ESTATUS[chip] || f.e === ESTATUS[chip]) && (!busca || f.c === "Equipo")).map((f) => f.k);
      if (porImporte) vis = PH_ORDEN_IMPORTE.filter((k) => vis.indexOf(k) >= 0);
      ORDEN.forEach((k, i) => {
        const p = vis.indexOf(k), el = cont.querySelector('#hglList .gl-row[data-k="' + k + '"]');
        gsap.to(el, { y: p >= 0 ? (p - i) * RH : 0, opacity: p >= 0 ? 1 : 0, duration: 0.6, ease: "power2.inOut", overwrite: "auto" });
      });
      chips.forEach((c, i) => gsap.to(c, Object.assign({ duration: 0.3, overwrite: "auto" }, i === chip ? ACTIVO : NEUTRO)));
      gsap.to(q, { clipPath: busca ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)", duration: 0.6, ease: "none", overwrite: "auto" });
      gsap.to(ph, { opacity: busca ? 0 : 1, duration: 0.3 });
      gsap.to(qa("#hglSort .a"), { opacity: porImporte ? 0 : 1, duration: 0.3 });
      gsap.to(qa("#hglSort .b"), { opacity: porImporte ? 1 : 0, duration: 0.3 });
    }
    const acciones = [];
    chips.forEach((c, i) => acciones.push([c, () => { chip = i; acomoda(); }]));
    acciones.push([g("glSearch"), () => { busca = !busca; acomoda(); }], [orden, () => { porImporte = !porImporte; acomoda(); }]);
    acciones.forEach((p) => {
      const el = p[0];
      el.setAttribute("role", "button"); el.setAttribute("tabindex", "0"); el.classList.add("hb-tap");
      const ir = () => { usuario = true; ultimo = Date.now(); chips[1].classList.remove("hb-pulse"); p[1](); };
      el.addEventListener("click", ir);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ir(); } });
    });
    chips[1].classList.add("hb-pulse");

    // si el visitante se queda mirando, la app se maneja sola (filtrar, ordenar, buscar) mientras el héroe está a la vista;
    // tras un toque suyo espera 10 s de calma
    const guion = [() => { chip = 1; acomoda(); }, () => { chip = 2; acomoda(); }, () => { chip = 0; porImporte = true; acomoda(); }, () => { porImporte = false; acomoda(); }, () => { busca = true; acomoda(); }, () => { busca = false; acomoda(); }];
    let paso = 0;
    const vivo = setInterval(() => {
      if (!root.isConnected) { clearInterval(vivo); return; }
      const r = root.querySelector("#paHero").getBoundingClientRect();
      if (!api.introHecha || r.bottom < 80 || r.top > window.innerHeight || Date.now() - ultimo < 10000) return;
      guion[paso++ % guion.length]();
    }, 3600);
    api.auto = (irA) => { api.irA = irA; if (api.introHecha) E.autoBajar(root, irA); };
    return api;
  }

  function shellHtml() {
    const tabs = [["Acceso", 1], ["Registro", 2], ["Automatiza", 3], ["Consulta", 4]].map((t) => '<button type="button" class="bi-tab" data-scene="' + t[1] + '"><b>' + t[1] + "</b>" + t[0] + "</button>").join("");
    const rail = [["acceso", "Inicio", 1], ["registro", "Solicitud", 2], ["automatiza", "Flujo", 3], ["consulta", "Consulta", 4]].map((r) => '<button type="button" class="bi-rv" data-v="' + r[0] + '" data-scene="' + r[2] + '" aria-label="' + r[1] + '">' + I[r[0]] + "<span>" + r[1] + "</span></button>").join("");
    const msgs = MSGS.map((m, i) => '<span class="bi-txt" id="paMsg' + (i + 1) + '">' + m + '<span class="formula-msg-cursor"></span></span>').join("");
    return '<div class="bi-shell pa-shell" id="paShell">' +
      '<div class="bi-top"><div class="bi-file pa-file"><span class="pa-ico">' + I.app + '</span><b>Compras</b><span class="pa-st-t">Studio</span></div>' +
      '<div class="pa-prop" id="paProp">OnStart<span>▾</span></div>' +
      '<div class="bi-fx"><span class="bi-fx-ico">fx</span><div class="bi-fx-stack">' + msgs + "</div></div>" +
      '<a href="#programas" class="bi-ver">Ver programas' + I.flecha + "</a></div>" +
      '<div class="bi-rail">' + rail + "</div>" +
      '<div class="bi-more" id="biMore" aria-hidden="true"><span>Sigue bajando</span>' + I.flecha + "</div>" +
      '<div class="bi-steps" id="paRail">' + tabs + '<span class="bi-status mono" id="paEstado">' + ESTADOS[0] + "</span></div></div>";
  }

  function ctx(root, desk) {
    const $ = (s) => root.querySelector(s);
    const qa = (s) => Array.prototype.slice.call(root.querySelectorAll(s));
    return { $: $, qa: qa, desk: desk, msg: (i) => $("#paMsg" + i) };
  }

  // =====================  TIMELINES  =====================
  const clic = (tl, rip, wrap, el, t) => tl.fromTo(rip, { x: () => cen(el, wrap)[0] - 13, y: () => cen(el, wrap)[1] - 13, scale: 0, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 4, immediateRender: false }, t);
  const FW = 176, FH = 34;   // la ficha "Solicitud #0042" (igual en CSS)
  const enCentro = (el, c) => ({ left: () => cen(el, c)[0] - FW / 2, top: () => cen(el, c)[1] - FH / 2 });
  const enNodo = (el, c) => ({ left: () => rel(el, c).x - 16, top: () => rel(el, c).y - 22 });
  const hacia = (el, wrap) => ({ x: () => cen(el, wrap)[0] - 4, y: () => cen(el, wrap)[1] - 2 });

  // 1 · ACCESO: login con la cuenta de la empresa y el rol que decide qué puede hacer
  function escL(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, scr = $(".pa-scr");
    tl.fromTo($("#paFrame"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 6 }, at(0));
    tipea(tl, R.msg(1), at(2), 10);
    tipea(tl, $("#lgEm"), at(10), 10);
    const cur = $("#curP"), rip = $("#ripP"), btn = $("#lgBtn"), go = $("#lgGo");
    tl.fromTo(cur, { opacity: 0, x: () => cen($("#lgIn"), scr)[0] + 120, y: () => cen($("#lgIn"), scr)[1] + 110 }, { opacity: 1, duration: 3, immediateRender: false }, at(22));
    tl.to(cur, Object.assign({ duration: 8 }, hacia(btn, scr)), at(24));
    clic(tl, rip, scr, btn, at(32));
    tl.to(qa("#lgBtn .a"), { opacity: 0, duration: 3 }, at(33)); tl.to(qa("#lgBtn .b"), { opacity: 1, duration: 3 }, at(33));
    tl.to($("#lgIn"), { opacity: 0, y: -10, duration: 5 }, at(40));
    tl.fromTo($("#lgHello"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 6 }, at(42));
    tl.to(qa("#lgHello .lg-perm li"), { opacity: 1, duration: 4, stagger: 4 }, at(50));
    tl.to(cur, Object.assign({ duration: 7 }, hacia(go, scr)), at(64));
    clic(tl, rip, scr, go, at(72));
    tl.to(go, { backgroundColor: "#a21caf", duration: 3 }, at(73));
    tl.to(cur, { opacity: 0, duration: 3 }, at(82));
  }

  // 2 · REGISTRO: el formulario se llena con controles reales y se envía
  function escF(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, scr = $(".pa-scr");
    tipea(tl, R.msg(2), at(2), 10);
    const ok = (id, t) => tl.to($("#" + id).parentNode.querySelector(".fm-ok"), { opacity: 1, duration: 3 }, t);
    const resumen = (id, t) => tl.to($("#" + id), { opacity: 1, duration: 3 }, t);
    const prog = (n, t) => { tl.to($("#rsFill"), { width: (n * 20) + "%", duration: 4 }, t); };
    // título
    tipea(tl, $("#fTit"), at(8), 9); ok("fTit", at(18)); resumen("rT", at(14)); prog(1, at(18));
    // categoría: lista desplegable, se elige una opción
    tl.to($("#fPop"), { opacity: 1, duration: 3 }, at(22));
    tl.to($("#fPopSel"), { backgroundColor: "rgba(192,38,211,.22)", duration: 3 }, at(25));
    tl.to($("#fPop"), { opacity: 0, duration: 3 }, at(29));
    tipea(tl, $("#fCat"), at(28), 4); ok("fCat", at(32)); resumen("rC", at(30)); prog(2, at(32));
    // fecha
    tipea(tl, $("#fFec"), at(34), 5); ok("fFec", at(39)); resumen("rF", at(37)); prog(3, at(39));
    // importe: el control deslizante
    const o = { v: 0 }, imp = $("#fImpV");
    tl.to(o, { v: 18500, duration: 12, ease: "power1.inOut", onUpdate: () => { imp.textContent = "$" + (Math.round(o.v / 100) * 100).toLocaleString("en-US"); } }, at(41));
    tl.to($("#fFill"), { width: "62%", duration: 12, ease: "power1.inOut" }, at(41));
    tl.to($("#fTh"), { left: "62%", duration: 12, ease: "power1.inOut" }, at(41));
    resumen("rI", at(50)); prog(4, at(53));
    // urgente + adjunto
    tl.to($("#fTg"), { backgroundColor: "#c026d3", borderColor: "#c026d3", duration: 3 }, at(55));
    tl.to($("#fTg i"), { x: 22, duration: 3 }, at(55));
    tl.to(qa("#fTg .a"), { opacity: 0, duration: 2 }, at(55)); tl.to(qa("#fTg .b"), { opacity: 1, duration: 2 }, at(55));
    tl.to($("#fAt"), { opacity: 1, duration: 4 }, at(58));
    resumen("rU", at(56)); prog(5, at(60));
    tl.to(qa("#rsN-x .a"), { opacity: 0, duration: 2 }, at(61)); tl.to(qa("#rsN-x .b"), { opacity: 1, duration: 2 }, at(61));
    // enviar
    const cur = $("#curP"), rip = $("#ripP"), btn = $("#fSend");
    tl.fromTo(cur, { opacity: 0, x: () => cen($("#fResumen"), scr)[0], y: () => cen($("#fResumen"), scr)[1] }, { opacity: 1, duration: 3, immediateRender: false }, at(62));
    tl.to(cur, Object.assign({ duration: 8 }, hacia(btn, scr)), at(64));
    clic(tl, rip, scr, btn, at(73));
    tl.to(qa("#fSend .a"), { opacity: 0, duration: 3 }, at(74)); tl.to(qa("#fSend .b"), { opacity: 1, duration: 3 }, at(74));
    tl.to($("#fDone"), { opacity: 1, duration: 5 }, at(78));
    tl.to(cur, { opacity: 0, duration: 3 }, at(80));
    tl.to($("#fDone"), { opacity: 0, duration: 4 }, at(88));
  }

  // 3 · AUTOMATIZA: la solicitud recorre el flujo (SharePoint → Teams → aprobación → actualizar)
  function escFl(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, canvas = $("#paCanvas"), flow = $("#paFlow"), ficha = $("#paFicha");
    if (!R.desk) tl.to(flow, { opacity: 1, duration: 4 }, at(0));
    tipea(tl, R.msg(3), at(2), 10);
    tl.to($("#n1"), { opacity: 1, duration: 4 }, at(0));
    const va = (id, t) => R.desk && tl.to(ficha, Object.assign({ duration: 6, ease: "power2.inOut" }, enNodo($("#" + id), canvas)), t);
    const listo = (id, t) => tl.to($("#" + id + " .fl-ok"), { opacity: 1, duration: 3 }, t);
    // SharePoint
    tl.to($("#fLn1"), { opacity: 1, duration: 3 }, at(8)); tl.fromTo($("#fLn1"), { scaleY: 0, transformOrigin: "50% 0%" }, { scaleY: 1, duration: 5, ease: "none" }, at(8));
    tl.to($("#n2"), { opacity: 1, duration: 4 }, at(11)); va("n2", at(12)); listo("n1", at(14));
    tl.to($("#pv2"), { opacity: 1, duration: 4 }, at(19)); listo("n2", at(24));
    // Teams
    tl.fromTo($("#fLn2"), { scaleY: 0, transformOrigin: "50% 0%", opacity: 1 }, { scaleY: 1, duration: 5, ease: "none" }, at(24));
    tl.to($("#n3"), { opacity: 1, duration: 4 }, at(27)); va("n3", at(28));
    tl.to($("#pv3"), { opacity: 1, duration: 4 }, at(35)); listo("n3", at(40));
    // Aprobación
    tl.fromTo($("#fLn3"), { scaleY: 0, transformOrigin: "50% 0%", opacity: 1 }, { scaleY: 1, duration: 5, ease: "none" }, at(40));
    tl.to($("#n4"), { opacity: 1, duration: 4 }, at(43)); va("n4", at(44));
    tl.to($("#pv4"), { opacity: 1, duration: 5 }, at(50));
    const cur = $("#curF"), rip = $("#ripF"), si = $("#apSi");
    tl.fromTo(cur, { opacity: 0, x: () => cen($("#pv4"), flow)[0] + 90, y: () => cen($("#pv4"), flow)[1] + 70 }, { opacity: 1, duration: 3, immediateRender: false }, at(56));
    tl.to(cur, Object.assign({ duration: 7 }, hacia(si, flow)), at(58));
    clic(tl, rip, flow, si, at(66));
    tl.to(si, { backgroundColor: "#0b7a6b", borderColor: "#0b7a6b", duration: 3 }, at(67));
    tl.to($("#apRes"), { opacity: 1, duration: 4 }, at(69));
    tl.to(cur, { opacity: 0, duration: 3 }, at(72));
    listo("n4", at(72));
    // actualizar el estatus
    tl.fromTo($("#fLn4"), { scaleY: 0, transformOrigin: "50% 0%", opacity: 1 }, { scaleY: 1, duration: 5, ease: "none" }, at(72));
    tl.to($("#n5"), { opacity: 1, duration: 4 }, at(75)); va("n5", at(76));
    tl.to($("#pv5"), { opacity: 1, duration: 4 }, at(80));
    tl.to(qa("#pv5 .a"), { opacity: 0, duration: 4 }, at(83)); tl.to(qa("#pv5 .b"), { opacity: 1, duration: 4 }, at(83));
    listo("n5", at(86));
    tl.to(qa("#flRun .a"), { opacity: 0, duration: 3 }, at(86)); tl.to(qa("#flRun .b"), { opacity: 1, duration: 3 }, at(86));
  }

  // la galería reacomoda sus filas: orden = claves visibles en el orden en que se muestran; las demás se desvanecen
  function acomodar(tl, t, orden, R) {
    ORDEN.forEach((k, i) => {
      const el = R.$('#glList .gl-row[data-k="' + k + '"]'), p = orden.indexOf(k);
      if (p >= 0) tl.to(el, { y: (p - i) * RH, opacity: 1, duration: 6 }, t);
      else tl.to(el, { opacity: 0, duration: 4 }, t);
    });
  }
  // 4 · CONSULTA: la galería con la solicitud ya aprobada; buscar, filtrar y ordenar
  function escG(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, scr = $(".pa-scr");
    const chips = qa("#glChips .gl-chip");
    if (!R.desk) tl.fromTo($("#sGal"), { opacity: 0 }, { opacity: 1, duration: 4 }, at(0));
    tipea(tl, R.msg(4), at(2), 10);
    if (!R.desk) tl.to($('#glList .gl-row[data-k="lap"]'), { opacity: 1, duration: 4 }, at(0));
    tl.to(qa("#glList .gl-row:not([data-k=lap])"), { opacity: 1, duration: 4, stagger: 2.5 }, at(4));
    tl.fromTo($('#glList .gl-row[data-k="lap"]'), { backgroundColor: "rgba(192,38,211,.14)" }, { backgroundColor: "rgba(192,38,211,0)", duration: 12 }, at(14));
    const cur = $("#curG"), rip = $("#ripG"), caja = $("#glSearch"), sort = $("#glSort"), pen = chips[1];
    // buscar
    tl.fromTo(cur, { opacity: 0, x: () => cen($("#glList"), scr)[0], y: () => cen($("#glList"), scr)[1] }, { opacity: 1, duration: 3, immediateRender: false }, at(18));
    tl.to(cur, Object.assign({ duration: 7 }, hacia(caja, scr)), at(20));
    clic(tl, rip, scr, caja, at(27));
    tl.to($("#glSearch .gl-ph"), { opacity: 0, duration: 2 }, at(28));
    tipea(tl, $("#glQ"), at(29), 6);
    acomodar(tl, at(36), ["lap", "mon"], R);
    tl.to($("#glQ"), { clipPath: "inset(0 100% 0 0)", duration: 4, ease: "none" }, at(46));
    tl.to($("#glSearch .gl-ph"), { opacity: 1, duration: 2 }, at(50));
    acomodar(tl, at(48), ORDEN, R);
    // filtrar por estatus
    tl.to(cur, Object.assign({ duration: 7 }, hacia(pen, scr)), at(52));
    clic(tl, rip, scr, pen, at(60));
    chips.forEach((c, i) => tl.to(c, i === 1 ? ACTIVO : NEUTRO, at(61)));
    acomodar(tl, at(63), ["mon", "cur"], R);
    // ordenar por importe
    tl.to(cur, Object.assign({ duration: 8 }, hacia(sort, scr)), at(68));
    clic(tl, rip, scr, sort, at(77));
    tl.to(qa("#glSort .a"), { opacity: 0, duration: 3 }, at(78)); tl.to(qa("#glSort .b"), { opacity: 1, duration: 3 }, at(78));
    chips.forEach((c, i) => tl.to(c, i === 0 ? ACTIVO : NEUTRO, at(78)));
    acomodar(tl, at(80), ["lic", "lap", "cur", "mon", "sil"], R);
    tl.to(cur, { opacity: 0, duration: 3 }, at(88));
  }

  // =====================  CONTENIDO  =====================
  const PA = {
    renderHtml() {
      return '<div class="viaje-root bi-root pa-root" id="viajePA">' + shellHtml() + heroHtml() +
        '<section class="bi-pin" id="paPin"><div class="bi-canvas" id="paCanvas">' +
        msgBloque(1) + msgBloque(2) + msgBloque(3) + msgBloque(4) +
        '<div class="pa-frame reveal" id="paFrame"><span class="pa-scrname"><b>Inicio</b><b>Solicitud</b><b>Consulta</b></span><div class="pa-bz"><div class="pa-scr">' +
        sceneLogin() + sceneForm() + sceneGal() +
        I.cursor.replace('class="', 'id="curP" class="') + '<div class="click-ripple" id="ripP"></div>' +
        I.cursor.replace('class="', 'id="curG" class="') + '<div class="click-ripple" id="ripG"></div></div></div></div>' +
        sceneFlow() +
        '<div class="pa-ficha reveal no-final" id="paFicha"><span class="ik">' + I.carrito + '</span><b>#0042</b><span>Laptop · $18,500</span></div>' +
        "</div></section></div>";
    },

    iniciar() {
      const root = document.getElementById("viajePA");
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
        const q = document.getElementById("sLogin");
        if (q) window.scrollTo({ top: q.getBoundingClientRect().top + window.scrollY - (NAV + 8), behavior: "smooth" });
      });

      const { simple, telefono } = E.esSimpleMode();
      if (simple) { estadoFinal(root); heroDash(root, "simple"); return; }
      if (telefono) { root.classList.add("viaje-flujo", "bi-flujo", "viaje-movil"); flujo(root); heroDash(root, "flujo"); ScrollTrigger.refresh(); window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true }); return; }

      gsap.registerPlugin(ScrollTrigger);
      const hero = heroDash(root, "desk");
      const R = ctx(root, true), $ = R.$, qa = R.qa;
      const mas = E.flechaMas($("#biMore"));
      const pin = $("#paPin"), canvas = $("#paCanvas"), frame = $("#paFrame"), flow = $("#paFlow"), ficha = $("#paFicha"), scr = $(".pa-scr");
      const nombres = qa(".pa-scrname b");

      // ---- línea de tiempo maestra: cuatro actos; tres pantallas comparten un solo marco de tableta ----
      const m = gsap.timeline({ defaults: { ease: "power1.out" } });
      m.set(nombres[0], { opacity: 1 }, 0);
      escL(m, S.l, R);
      // Acceso → Registro: la pantalla de solicitud entra deslizándose, como en una app
      m.fromTo($("#sForm"), { xPercent: 100 }, { xPercent: 0, duration: 12, ease: "power2.inOut" }, TR.lf);
      m.to($("#sLogin"), { xPercent: -35, duration: 12, ease: "power2.inOut" }, TR.lf);
      m.to(nombres[0], { opacity: 0, duration: 4 }, TR.lf + 2); m.to(nombres[1], { opacity: 1, duration: 4 }, TR.lf + 6);
      m.to(R.msg(1), { opacity: 0, duration: 6 }, TR.lf + 2);
      escF(m, S.f, R);
      // la ficha de la solicitud sale del resumen del formulario
      m.fromTo(ficha, Object.assign({ opacity: 0, scale: 0.8 }, enCentro($("#fResumen"), canvas)), { opacity: 1, scale: 1, duration: 4 }, S.f + 90);
      // Registro → Automatiza: la app se encoge a un lado y aparece el flujo; la ficha viaja al primer paso
      m.to(frame, { scale: 0.5, x: -68, y: 122, duration: 14, ease: "power2.inOut" }, TR.fa);
      m.to(R.msg(2), { opacity: 0, duration: 6 }, TR.fa + 2);
      m.to(flow, { opacity: 1, duration: 8 }, TR.fa + 6);
      m.to(ficha, Object.assign({ duration: 14, ease: "power2.inOut" }, enNodo($("#n1"), canvas)), TR.fa);
      escFl(m, S.a, R);
      // Automatiza → Consulta: la app vuelve a su tamaño, entra la galería y la ficha aterriza como su primera fila
      m.to(flow, { opacity: 0, duration: 8 }, TR.ag);
      m.to(frame, { scale: 1, x: 0, y: 0, duration: 16, ease: "power2.inOut" }, TR.ag);
      m.fromTo($("#sGal"), { xPercent: 100 }, { xPercent: 0, duration: 12, ease: "power2.inOut" }, TR.ag + 4);
      m.to($("#sForm"), { xPercent: -35, duration: 12, ease: "power2.inOut" }, TR.ag + 4);
      m.to(nombres[1], { opacity: 0, duration: 4 }, TR.ag + 6); m.to(nombres[2], { opacity: 1, duration: 4 }, TR.ag + 10);
      m.to(R.msg(3), { opacity: 0, duration: 6 }, TR.ag + 2);
      m.to(ficha, Object.assign({ duration: 16, ease: "power2.inOut" }, enCentro($('#glList .gl-row[data-k="lap"]'), canvas)), TR.ag + 4);
      m.to($('#glList .gl-row[data-k="lap"]'), { opacity: 1, duration: 3 }, TR.ag + 19);
      m.to(ficha, { opacity: 0, duration: 3 }, TR.ag + 20);
      escG(m, S.g, R);
      m.to({}, { duration: 1 }, TOTAL - 1);   // la duración total es exactamente TOTAL

      // ---- cáscara: riel/pestañas = actos; la propiedad activa y el estado cambian con la escena ----
      const tabs = qa(".bi-tab"), vistas = qa(".bi-rv"), prop = $("#paProp"), estado = $("#paEstado");
      let activa = -1;
      function setActive(n) {
        if (n === activa) return;
        activa = n;
        tabs.forEach((t) => t.classList.toggle("active", t.dataset.scene === String(n)));
        vistas.forEach((t) => t.classList.toggle("active", t.dataset.v === RIEL[n]));
        prop.firstChild.textContent = PROPS[n] || PROPS[1]; estado.textContent = ESTADOS[n];
      }
      setActive(0);

      const st = ScrollTrigger.create({
        trigger: pin, start: "top " + NAV + "px", end: "+=" + Math.round(TOTAL * 1.75) + "%", scrub: 1, pin: true, animation: m, invalidateOnRefresh: true,
        onUpdate: (self) => { const u = self.progress * TOTAL; setActive(u < UMBRAL[0] ? 1 : u < UMBRAL[1] ? 2 : u < UMBRAL[2] ? 3 : 4); mas.fin = u > TOTAL - 36; },
      });
      ScrollTrigger.create({ trigger: $("#paHero"), start: "top center", end: "bottom center", onToggle: (s) => s.isActive && setActive(0) });

      // scroll a un punto de la línea de tiempo (el pin mueve el layout: el ancla nativa no sirve)
      function irA(u) { window.scrollTo({ top: st.start + (st.end - st.start) * (u / TOTAL), behavior: "smooth" }); }
      tabs.concat(vistas).forEach((t) => t.addEventListener("click", () => irA(IR_A[t.dataset.scene])));
      if (siguiente) siguiente.addEventListener("click", () => irA(8));
      if (hero) hero.auto(() => irA(8));

      // la cáscara aparece a los 30 px de scroll y dura hasta el final del pin
      document.body.classList.add("bi-on");
      ScrollTrigger.create({
        trigger: $("#paHero"), start: () => "top " + (NAV - 30) + "px", end: () => st.end,
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

  // TELÉFONO: sin pin ni lienzo fijo. Cada pantalla es una tarjeta apilada y corre su animación UNA vez al entrar.
  function flujo(root) {
    gsap.registerPlugin(ScrollTrigger);
    const sh = root.querySelector(".bi-shell"); if (sh) sh.remove();
    root.querySelectorAll(".viaje-msg .formula-msg-text").forEach((el, i) => { el.id = "paMsg" + (i + 1); });
    const R = ctx(root, false), K = 12;
    const una = (trigger, start) => gsap.timeline({ defaults: { ease: "power1.out" }, scrollTrigger: { trigger: trigger, start: start || "top 72%", once: true } });
    [["#sLogin", escL], ["#sForm", escF], ["#paFlow", escFl], ["#sGal", escG]].forEach((e) => { const tl = una(e[0]); e[1](tl, 0, R); tl.timeScale(K); });
    gsap.set("#paFrame", { opacity: 1 });
  }

  // estado final (reduced-motion o GSAP caído): todo visible, pantallas apiladas
  function estadoFinal(root) {
    root.classList.add("viaje-simple", "viaje-flujo", "bi-flujo", "pa-flujo", "pa-final");
    const sh = root.querySelector(".bi-shell"); if (sh) sh.remove();
    root.querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
    root.querySelectorAll(".formula-msg-text, .cl").forEach((el) => { el.style.clipPath = "inset(0 0% 0 0)"; });
    const set = (sel, k, v) => root.querySelectorAll(sel).forEach((el) => { el.style[k] = v; });
    set("#fFill", "width", "62%"); set("#fTh", "left", "62%"); set("#rsFill", "width", "100%");
    set("#fTg", "backgroundColor", "#c026d3"); set("#fTg i", "transform", "translateX(22px)");
    set("#glQ", "clipPath", "inset(0 100% 0 0)");
    const t = (id, v) => { const el = root.querySelector(id); if (el) el.textContent = v; };
    t("#fImpV", "$18,500");
    set("#rsN-x .a, #fTg .a, #pv5 .a, #flRun .a, #lgBtn .a, #fSend .a", "opacity", 0); set("#rsN-x .b, #fTg .b, #pv5 .b, #flRun .b", "opacity", 1);
  }

  window.ViajeEscenas.powerapps = PA;
})();
