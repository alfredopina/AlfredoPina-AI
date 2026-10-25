// assets/js/viaje-auto.js
// Viaje de Power Automate (scrollytelling GSAP) para cursos.html. Se registra en window.ViajeEscenas (ver viaje.js: expone el
// motor compartido ViajeEngine con rel/cen/tipea/morph). Mismo método que los otros viajes: cáscara fija + UN dato que viaja
// + un lienzo de 1100×620 con UN pin y UNA línea de tiempo maestra. Aquí el "dato" es el FLUJO MISMO: un solo lienzo de
// diseñador donde el flujo "Solicitud de vacaciones" se arma pieza por pieza y la cámara baja siguiendo su crecimiento:
//   Iniciar (tipos de flujo → disparador de Forms) → Conectar (SharePoint, Outlook, Teams, To Do) → Controlar (ámbito,
//   condición + aprobación, switch, bucle, captura de errores con terminate) → Ejecutar (probar: el flujo corre y llegan
//   los resultados).
//
// Decisiones que NO hay que repetir si esto se toca:
//   - Camino acordado con Alfredo: híbrido (el flujo que crece, organizado por usos: notificar/registrar, controlar,
//     aprobar). Dato: una respuesta de Forms (solicitud de vacaciones). Sin pasos de IA (no los ha probado: cuando exista el
//     curso ganan su escena) y sin Excel Online (no satura).
//   - La cáscara es el diseñador de Power Automate: barra con el flujo, botón Probar, riel con las capas (Disparador,
//     Conectores, Control, Ejecución) y tira Iniciar › Conectar › Controlar › Ejecutar.
//   - El contenido dinámico (chips violeta con Nombre, Tipo, Días...) es el dato de Forms visible en cada acción; en la
//     ejecución una pastilla "Respuesta #17" recorre los pasos, cada uno con su sello ✓ (ícono + texto + tiempo).
//   - Móvil táctil: sin pin; el lienzo se apila (selector de tipo, flujo, contenido dinámico, resultados). Estático
//     (reduced-motion o GSAP caído): todo en su estado final (au-final + estadoFinal()).
(function () {
  "use strict";
  const E = window.ViajeEngine;
  if (!E || !window.ViajeEscenas || !E.morph) return;
  const { rel, cen, tipea, morph } = E;

  // ---- constantes de la animación (unidades de la línea de tiempo maestra) ----
  const S = { i: 0, c: 108, k: 216, e: 324 };          // inicio de cada escena
  const TOTAL = 430;
  const UMBRAL = [100, 208, 316];                      // unidades donde cambia la escena activa
  const IR_A = { 1: 88, 2: 196, 3: 304, 4: 422 };      // a dónde aterriza cada pestaña (todo ya dibujado)

  const MSGS = [
    "Todo flujo empieza con un disparador.",
    "Conecta tus apps: registra, avisa y asigna.",
    "Dale criterio: decide, repite y atrapa los errores.",
    "Prueba, aprueba y deja que corra solo.",
  ];
  const ESTADOS = ["Flujo sin iniciar", "1 disparador · tipo automatizado", "6 acciones · 4 conectores", "10 acciones · 4 controles", "Ejecución correcta · 10 pasos"];
  const RIEL = [null, "disparador", "conectores", "control", "ejecucion"];

  // ---- íconos de línea (propios) ----
  const svg = (d, w) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const I = {
    flecha: svg('<path d="M12 5v14M5 12l7 7 7-7"/>', 2.2),
    check: svg('<path d="M5 13l4 4L19 7"/>', 3),
    rayo: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', 1.8),
    reloj: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 1.9),
    mano: svg('<path d="M9 11V5a1.6 1.6 0 0 1 3.2 0v5M12.2 9.5a1.6 1.6 0 0 1 3.2 0v1M15.4 10.5a1.6 1.6 0 0 1 3.2 0V15a6 6 0 0 1-6 6h-1.2a6 6 0 0 1-4.7-2.3L4 15.5a1.6 1.6 0 0 1 2.5-2L9 15"/>', 1.7),
    forms: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 9l1.5 1.5L12 8M8 15l1.5 1.5L12 14M14 9.5h3M14 15.5h3"/>', 1.7),
    detalle: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 16.5h7"/>'),
    lista: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/>'),
    correo: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    chat: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
    tarea: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', 2),
    aprobar: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', 2),
    condicion: svg('<path d="M12 3v5M12 8L6 15v6M12 8l6 7v6"/>', 1.9),
    cambiar: svg('<path d="M4 7h5l3 5-3 5H4M20 7h-5l-3 5 3 5h5"/>', 1.8),
    bucle: svg('<path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5"/>', 1.8),
    ambito: svg('<path d="M8 4H5v16h3M16 4h3v16h-3"/>', 2),
    terminar: svg('<rect x="5" y="5" width="14" height="14" rx="2"/>', 1.9),
    variable: svg('<path d="M6 5l6 7-6 7M18 5l-6 7 6 7"/>', 1.9),
    calendario: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    play: svg('<path d="M7 4l13 8-13 8z"/>', 2),
    omitir: svg('<path d="M5 12h14"/>', 2.4),
    disparador: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    conectores: svg('<path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5"/>'),
    control: svg('<path d="M12 3v5M12 8L6 15v6M12 8l6 7v6"/>'),
    ejecucion: svg('<path d="M7 4l13 8-13 8z"/>'),
    flujo: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', 2),
    cursor: '<svg class="cursor-ico reveal au-cur no-final" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l15 7-6.2 1.6L11 17z"/></svg>',
  };
  const xf = (a, b, cls) => '<span class="xf ' + (cls || "") + '"><b class="a">' + a + '</b><b class="b">' + b + "</b></span>";
  const chip = (t) => '<i class="dc">' + t + "</i>";

  function msgBloque(n) { return '<div class="viaje-msg"><div class="formula-msg"><span class="formula-msg-fx">fx</span><span class="formula-msg-text">' + MSGS[n - 1] + '<span class="formula-msg-cursor"></span></span></div></div>'; }

  // ---- nodos del flujo (cada tarjeta lleva su conector, sus campos con contenido dinámico y su sello de ejecución) ----
  const nodo = (id, color, ico, tit, sub, cls, omitir) => '<div class="au-n reveal ' + (cls || "") + '" id="' + id + '" style="--nc:' + color + '"><span class="au-i"><span class="ik">' + I[ico] + '</span></span><div class="au-t"><b>' + tit + "</b><span>" + sub + '</span></div><span class="au-run reveal' + (omitir ? " au-skip" : "") + '"><span class="ik">' + (omitir ? I.omitir : I.check) + "</span><em>" + (omitir ? "Omitido" : "0.3 s") + "</em></span></div>";
  const ln = (id) => '<i class="au-ln reveal" id="' + id + '"></i>';

  function pickerHtml() {
    const c = (id, ico, tit, sub) => '<div class="au-pc reveal" id="' + id + '"><span class="au-pi"><span class="ik">' + I[ico] + "</span></span><b>" + tit + "</b><span>" + sub + "</span></div>";
    return '<div class="au-pick" id="auPick"><div class="au-ph reveal">Crear un flujo</div><div class="au-pcs">' +
      c("auCard1", "rayo", "Flujo automatizado", "Se inicia con un evento, como una respuesta de Forms") +
      c("auCard2", "reloj", "Flujo programado", "Se ejecuta cada día, semana o mes") +
      c("auCard3", "mano", "Flujo instantáneo", "Se inicia manualmente, con un botón") + "</div>" +
      '<div class="au-ps reveal" id="auPs"><span class="ik">' + I.forms + '</span><span class="cl" id="auTn">Cuando se envía una respuesta nueva · Microsoft Forms</span></div></div>';
  }

  function flowHtml() {
    return '<div class="au-flow" id="auFlow">' +
      nodo("nT", "#008272", "forms", "Cuando se envía una respuesta nueva", "Microsoft Forms · Solicitud de vacaciones", "au-trig") + ln("l1") +
      nodo("n2", "#008272", "detalle", "Obtener los detalles de la respuesta", "Forms · Id de la respuesta " + chip("Id")) + ln("l2") +
      msgBloque(2) +
      nodo("n3", "#038387", "lista", "Crear elemento", "SharePoint · Título " + chip("Nombre") + " · Días " + chip("Días")) + ln("l3") +
      nodo("n4", "#0f6cbd", "correo", "Enviar un correo (V2)", "Outlook · Para " + chip("Correo") + " · Recibimos tu solicitud") + ln("l4") +
      nodo("n5", "#5b5fc7", "chat", "Publicar un mensaje en un canal", "Teams · RH · Nueva solicitud de " + chip("Nombre")) + ln("l5") +
      nodo("n6", "#2564cf", "tarea", "Agregar una tarea", "To Do · Revisar solicitud de " + chip("Nombre")) + ln("l6") +
      msgBloque(3) +
      '<div class="au-scope reveal" id="auScope"><span class="au-sh">Ámbito · Intentar</span>' +
      nodo("nCond", "#6b7280", "condicion", "Condición", "¿" + chip("Días") + " es mayor que 5?") +
      '<div class="au-br"><div class="au-b"><span class="au-lb reveal">Sí</span>' + nodo("nAp", "#0078d4", "aprobar", "Iniciar y esperar una aprobación", "Para Dirección · " + chip("Tipo")) + '</div>' +
      '<div class="au-b"><span class="au-lb reveal">No</span>' + nodo("nVar", "#6b7280", "variable", "Establecer variable", "Estatus = Aprobada", "", 1) + "</div></div>" + ln("l7") +
      nodo("nSw", "#6b7280", "cambiar", "Cambiar", "Según " + chip("Tipo")) +
      '<div class="au-cases reveal" id="auCases"><span class="au-case on" id="auCase1">Vacaciones</span><span class="au-case">Permiso</span><span class="au-case">Otro</span></div>' + ln("l8") +
      '<div class="au-loop reveal" id="auLoop"><span class="au-sh">Aplicar a cada uno · Días solicitados <em id="auCnt">0/7</em></span>' + nodo("nEv", "#0f6cbd", "calendario", "Crear evento", "Outlook · " + chip("Nombre") + " de vacaciones") + "</div></div>" + ln("l9") +
      '<div class="au-scope au-catch reveal" id="auCatch"><span class="au-sh">Ámbito · Capturar errores <small>se ejecuta si falla</small></span>' + nodo("nTer", "#d13438", "terminar", "Terminar", "Estado: Error · " + chip("Mensaje de error"), "", 1) + "</div>" +
      '<div class="au-ficha reveal no-final" id="auFicha"><span class="ik">' + I.forms + '</span><b>#17</b><span>Mariana · 7 días</span></div>' +
      "</div>";
  }

  function sideHtml() {
    const fila = (k, v) => '<div class="dy-r reveal"><i class="dc">' + k + "</i><b>" + v + "</b></div>";
    const rc = (id, ico, color, tit, sub) => '<div class="rs-c reveal" id="' + id + '" style="--nc:' + color + '"><span class="rs-i"><span class="ik">' + I[ico] + "</span></span><div><b>" + tit + "</b><span>" + sub + "</span></div></div>";
    return '<aside class="au-side"><div class="au-dyn reveal" id="auDyn"><div class="sd-h">Contenido dinámico</div><div class="sd-s">Respuesta de Forms</div>' +
      fila("Nombre", "Mariana López") + fila("Correo", "mariana@grupodemo.com") + fila("Tipo", "Vacaciones") + fila("Inicio", "3 nov") + fila("Fin", "11 nov") + fila("Días", "7") + fila("Id", "17") + "</div>" +
      msgBloque(4) + '<div class="au-res" id="auRes"><div class="sd-h">Resultados de la ejecución</div>' +
      rc("rSp", "lista", "#038387", "Elemento #0017 creado", "SharePoint · Solicitudes") +
      rc("rOu", "correo", "#0f6cbd", "Correo enviado", "Outlook · mariana@grupodemo.com") +
      rc("rTm", "chat", "#5b5fc7", "Mensaje publicado", "Teams · RH") +
      rc("rTd", "tarea", "#2564cf", "Tarea creada", "To Do · Revisar solicitud de Mariana") +
      '<div class="au-ap reveal" id="rAp"><div class="au-aph"><span class="ik">' + I.aprobar + '</span>Aprobación · Vacaciones</div><p>Mariana López · 7 días<br><span>3 nov al 11 nov</span></p><div class="au-apb"><span class="ap-si" id="auApSi">Aprobar</span><span class="ap-no">Rechazar</span></div><div class="au-apr reveal" id="rApR"><span class="ik">' + I.check + "</span>Aprobada por Dirección</div></div>" +
      rc("rCa", "calendario", "#0f6cbd", "7 eventos en el calendario", "Outlook · 3 al 11 nov") + "</div></aside>";
  }

  // ---- héroe: mitad texto, mitad un flujo que corre de verdad (el visitante lo prueba y aprueba) ----
  // La ventana del diseñador (copia propia "ah-", ids "h…") muestra el flujo de la solicitud de vacaciones; "Probar" lo ejecuta:
  // cada paso se enciende y sella (✓ tiempo), llegan los resultados y la aprobación se puede aprobar con un clic. Si nadie lo
  // toca, se vuelve a ejecutar solo. Botón único con auto-scroll de 5 s (ViajeEngine.autoBajar).
  function heroHtml() {
    const rch = (id, ico, color, tit, sub) => '<div class="rs-c reveal" id="' + id + '" style="--nc:' + color + '"><span class="rs-i"><span class="ik">' + I[ico] + "</span></span><div><b>" + tit + "</b><span>" + sub + "</span></div></div>";
    const flujo = nodo("hT", "#008272", "forms", "Cuando se envía una respuesta nueva", "Microsoft Forms · Solicitud de vacaciones", "au-trig") + ln("hl1") +
      nodo("h2", "#038387", "lista", "Crear elemento", "SharePoint · Título " + chip("Nombre") + " · Días " + chip("Días")) + ln("hl2") +
      nodo("h3", "#0f6cbd", "correo", "Enviar un correo (V2)", "Outlook · Para " + chip("Correo")) + ln("hl3") +
      nodo("h4", "#5b5fc7", "chat", "Publicar un mensaje en un canal", "Teams · RH · Nueva solicitud") + ln("hl4") +
      nodo("h5", "#0078d4", "aprobar", "Iniciar y esperar una aprobación", "Para Dirección · " + chip("Tipo")) + ln("hl5") +
      nodo("h6", "#0f6cbd", "calendario", "Crear evento", "Outlook · " + chip("Nombre") + " de vacaciones");
    const lado = '<div class="sd-h">Resultados de la ejecución</div><div class="ah-resp reveal" id="hResp"><span class="ik">' + I.forms + '</span><b>Respuesta #17</b><span>Mariana · 7 días</span></div>' +
      rch("hRsp", "lista", "#038387", "Elemento #0017 creado", "SharePoint · Solicitudes") + rch("hRou", "correo", "#0f6cbd", "Correo enviado", "Outlook · mariana@grupodemo.com") + rch("hRtm", "chat", "#5b5fc7", "Mensaje publicado", "Teams · RH") +
      '<div class="au-ap reveal" id="hRap"><div class="au-aph"><span class="ik">' + I.aprobar + '</span>Aprobación · Vacaciones</div><p>Mariana López · 7 días</p><div class="au-apb"><span class="ap-si" id="hApSi">Aprobar</span><span class="ap-no">Rechazar</span></div><div class="au-apr reveal" id="hApR"><span class="ik">' + I.check + "</span>Aprobada por Dirección</div></div>" +
      rch("hRca", "calendario", "#0f6cbd", "7 eventos en el calendario", "Outlook · 3 al 11 nov");
    return '<section class="viaje-hero hb-hero ah-hero" id="auHero"><div class="hb-copy"><span class="viaje-hero-eyebrow">Curso de Power Automate</span>' +
      '<h1 class="viaje-hero-title">Automatiza <span class="accent">Procesos<span class="selector-box"><span class="selector-label">Trigger</span></span></span></h1>' +
      '<div class="viaje-hero-chips"><span class="scope-chip">Flujos en la nube</span><span class="scope-chip">Conectores</span><span class="scope-chip">Aprobaciones</span></div>' +
      '<div class="hb-actions"><a href="#auPick" class="viaje-btn solid hb-go" data-viaje-next><span>Conoce el programa</span>' + I.flecha + '<i class="hb-bar"></i></a><a href="#programas" class="hb-ver">Ver programas</a></div></div>' +
      '<div class="hb-stage"><div class="hb-frame ah-frame"><div class="hb-cv ah-cv" id="ahCv"><div class="ah-win">' +
      '<div class="au-bar"><span class="au-bi"><span class="ik">' + I.flujo + '</span></span><b>Power Automate</b><span class="au-fn">Solicitud de vacaciones</span><span class="au-btn au-prueba ah-pr" id="hPrueba" role="button" tabindex="0"><span class="ik">' + I.play + "</span>Probar</span></div>" +
      '<div class="ah-body"><div class="au-cv"><div class="ah-flow">' + flujo + '</div></div><aside class="au-side ah-side">' + lado + "</aside></div></div></div></div></div></section>";
  }

  // modo: "desk" (animado, interactivo y auto-scroll), "flujo" (teléfono) o "simple" (estado final)
  function heroDash(root, modo) {
    const cont = root.querySelector("#ahCv");
    if (!cont) return null;
    const g = (id) => cont.querySelector("#h" + id), qa = (s) => Array.prototype.slice.call(cont.querySelectorAll(s));
    const stage = root.querySelector(".hb-stage");
    function escala() { cont.style.transform = root.classList.contains("bi-flujo") ? "" : "scale(" + (stage.clientWidth / 940).toFixed(4) + ")"; }
    if (root._hbEsc) window.removeEventListener("resize", root._hbEsc);
    root._hbEsc = escala; window.addEventListener("resize", escala); escala();
    if (modo !== "desk") { qa(".reveal").forEach((el) => { el.style.opacity = 1; }); return null; }

    const nodos = ["T", "2", "3", "4", "5", "6"].map((n) => g(n.length === 1 && n === "T" ? "T" : n)), lineas = qa(".au-ln");
    const res = { 2: g("Rsp"), 3: g("Rou"), 4: g("Rtm"), 5: g("Rap"), 6: g("Rca") };
    const sellos = nodos.map((n) => n.querySelector(".au-run"));
    const api = { introHecha: false, irA: null };
    const reveal = qa(".reveal").filter((el) => sellos.indexOf(el) < 0 && [g("Rsp"), g("Rou"), g("Rtm"), g("Rap"), g("Rca"), g("Resp"), g("ApR")].indexOf(el) < 0);

    // la ejecución: un paso cada ~0.9 s; en la aprobación espera (o aprueba solo en la marca "apr")
    const run = gsap.timeline({ paused: true, defaults: { ease: "power1.out" } });
    const paso = (i, t) => {
      run.to(nodos[i], { boxShadow: "0 0 0 2px #22d3ee, 0 0 18px rgba(34,211,238,.35)", duration: 0.25 }, t);
      run.to(nodos[i], { boxShadow: "0 0 0 0 rgba(34,211,238,0), 0 0 0 rgba(34,211,238,0)", duration: 0.3 }, t + 0.55);
      run.to(sellos[i], { opacity: 1, duration: 0.25 }, t + 0.3);
      if (res[i + 1]) run.fromTo(res[i + 1], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, immediateRender: false }, t + 0.45);
    };
    run.set([sellos, Object.keys(res).map((k) => res[k]), g("ApR"), g("Resp")].reduce((x, y) => x.concat(y), []), { opacity: 0 }, 0);
    run.to(g("Resp"), { opacity: 1, duration: 0.3 }, 0.1);
    paso(0, 0.3);
    paso(1, 1.2);
    paso(2, 2.1);
    paso(3, 3.0);
    // aprobación: el nodo queda encendido esperando; se aprueba (solo o con el clic del visitante) en "apr"
    run.to(nodos[4], { boxShadow: "0 0 0 2px #22d3ee, 0 0 18px rgba(34,211,238,.35)", duration: 0.25 }, 3.9);
    run.fromTo(res[5], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, immediateRender: false }, 4.0);
    run.addLabel("apr", 5.6);
    run.to(g("ApSi"), { backgroundColor: "#0b7a6b", borderColor: "#0b7a6b", duration: 0.25 }, "apr");
    run.to(g("ApR"), { opacity: 1, duration: 0.3 }, "apr+=0.2");
    run.to(nodos[4], { boxShadow: "0 0 0 0 rgba(34,211,238,0), 0 0 0 rgba(34,211,238,0)", duration: 0.3 }, "apr+=0.3");
    run.to(sellos[4], { opacity: 1, duration: 0.25 }, "apr+=0.3");
    paso(5, 6.4);
    run.to({}, { duration: 0.4 }, 7.6);

    let finRun = 0;
    run.eventCallback("onComplete", () => { finRun = Date.now(); });
    // intro: aparece el flujo y la ejecución arranca sola
    gsap.to(reveal, { opacity: 1, duration: 0.4, stagger: 0.07, delay: 0.4, onComplete: () => {
      api.introHecha = true; run.play(0); if (api.irA) E.autoBajar(root, api.irA);
    } });

    // interacción: "Probar" vuelve a ejecutar; "Aprobar" adelanta la aprobación
    let usuario = false, ultimo = 0;
    const prueba = g("Prueba"), apSi = g("ApSi");
    [prueba, apSi].forEach((el) => { el.setAttribute("role", "button"); el.setAttribute("tabindex", "0"); el.classList.add("hb-tap"); });
    const probar = () => { usuario = true; ultimo = Date.now(); prueba.classList.remove("hb-pulse"); run.restart(); };
    const aprobar = () => { usuario = true; ultimo = Date.now(); if (run.isActive() && run.time() < run.labels.apr) run.seek("apr"); else if (!run.isActive()) probar(); };
    prueba.addEventListener("click", probar); apSi.addEventListener("click", aprobar);
    [[prueba, probar], [apSi, aprobar]].forEach((p) => p[0].addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p[1](); } }));
    prueba.classList.add("hb-pulse");

    // si el visitante se queda mirando, el flujo se ejecuta de nuevo solo (mientras el héroe está a la vista)
    const vivo = setInterval(() => {
      if (!root.isConnected) { clearInterval(vivo); return; }
      const r = root.querySelector("#auHero").getBoundingClientRect();
      if (!api.introHecha || run.isActive() || run.time() < run.duration() || r.bottom < 80 || r.top > window.innerHeight || Date.now() - ultimo < 10000 || Date.now() - finRun < 9000) return;
      run.restart();
    }, 5000);
    api.auto = (irA) => { api.irA = irA; if (api.introHecha) E.autoBajar(root, irA); };
    return api;
  }

  function shellHtml() {
    const tabs = [["Iniciar", 1], ["Conectar", 2], ["Controlar", 3], ["Ejecutar", 4]].map((t) => '<button type="button" class="bi-tab" data-scene="' + t[1] + '"><b>' + t[1] + "</b>" + t[0] + "</button>").join("");
    const rail = [["disparador", "Disparador", 1], ["conectores", "Conectores", 2], ["control", "Control", 3], ["ejecucion", "Ejecución", 4]].map((r) => '<button type="button" class="bi-rv" data-v="' + r[0] + '" data-scene="' + r[2] + '" aria-label="' + r[1] + '">' + I[r[0]] + "<span>" + r[1] + "</span></button>").join("");
    const msgs = MSGS.map((m, i) => '<span class="bi-txt" id="auMsg' + (i + 1) + '">' + m + '<span class="formula-msg-cursor"></span></span>').join("");
    return '<div class="bi-shell au-shell" id="auShell">' +
      '<div class="bi-top"><div class="bi-file au-file"><span class="au-ico">' + I.flujo + '</span><b>Solicitud de vacaciones</b><span class="au-tag">Diseñador</span></div>' +
      '<div class="bi-fx"><span class="bi-fx-ico">fx</span><div class="bi-fx-stack">' + msgs + "</div></div>" +
      '<span class="au-test" id="auTestSh"><span class="ik">' + I.play + "</span>Probar</span>" +
      '<a href="#programas" class="bi-ver">Ver programas' + I.flecha + "</a></div>" +
      '<div class="bi-rail">' + rail + "</div>" +
      '<div class="bi-more" id="biMore" aria-hidden="true"><span>Sigue bajando</span>' + I.flecha + "</div>" +
      '<div class="bi-steps" id="auRail">' + tabs + '<span class="bi-status mono" id="auEstado">' + ESTADOS[0] + "</span></div></div>";
  }

  function ctx(root, desk) {
    const $ = (s) => root.querySelector(s);
    const qa = (s) => Array.prototype.slice.call(root.querySelectorAll(s));
    return { $: $, qa: qa, desk: desk, msg: (i) => $("#auMsg" + i) };
  }

  // =====================  TIMELINES  =====================
  const clic = (tl, rip, wrap, el, t) => tl.fromTo(rip, { x: () => cen(el, wrap)[0] - 13, y: () => cen(el, wrap)[1] - 13, scale: 0, opacity: 1 }, { scale: 1.5, opacity: 0, duration: 4, immediateRender: false }, t);
  const hacia = (el, wrap) => ({ x: () => cen(el, wrap)[0] - 4, y: () => cen(el, wrap)[1] - 2 });

  // la cámara: baja el lienzo del flujo para que "el" quede a la vista (solo escritorio)
  function pan(tl, R, el, t, d) {
    if (!R.desk) return;
    const flow = R.$("#auFlow"), cv = R.$("#auCv");
    tl.to(flow, { y: () => Math.min(0, -(rel(el, flow).y - (cv.clientHeight - 130))), duration: d || 8, ease: "power2.inOut" }, t);
  }
  const aparece = (tl, ids, t, R, sep) => ids.forEach((id, i) => tl.to(R.$("#" + id), { opacity: 1, duration: 4 }, t + i * (sep || 3)));
  const lineaDe = (tl, id, t, R) => tl.fromTo(R.$("#" + id), { opacity: 1, scaleY: 0, transformOrigin: "50% 0%" }, { scaleY: 1, duration: 4, ease: "none" }, t);

  // 1 · INICIAR: los tipos de flujo; se elige el automatizado con Forms
  function escI(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, win = $("#auWin"), cv = $("#auCv");
    tl.fromTo(win, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 6 }, at(0));
    tipea(tl, R.msg(1), at(2), 10);
    tl.to($(".au-ph"), { opacity: 1, duration: 3 }, at(6));
    tl.to(qa("#auPick .au-pc"), { opacity: 1, duration: 4, stagger: 3 }, at(8));
    const cur = $("#curU"), rip = $("#ripU"), c1 = $("#auCard1");
    tl.fromTo(cur, { opacity: 0, x: () => cen($("#auPick"), win)[0] + 200, y: () => cen($("#auPick"), win)[1] + 110 }, { opacity: 1, duration: 3, immediateRender: false }, at(18));
    tl.to(cur, Object.assign({ duration: 8 }, hacia(c1, win)), at(20));
    clic(tl, rip, win, c1, at(28));
    tl.to(c1, { borderColor: "#0f6cbd", backgroundColor: "rgba(15,108,189,.22)", duration: 3 }, at(29));
    tl.to([$("#auCard2"), $("#auCard3")], { opacity: 0.35, duration: 4 }, at(30));
    tl.to(cur, { opacity: 0, duration: 3 }, at(32));
    // el disparador elegido se escribe y la tarjeta se vuelve el primer paso del flujo
    tl.to($("#auPs"), { opacity: 1, duration: 3 }, at(34));
    tipea(tl, $("#auTn"), at(36), 10);
    if (R.desk) {
      morph(tl, c1, $("#nT"), cv, at(48), 14);
      tl.to([$("#auCard2"), $("#auCard3"), $("#auPs"), $(".au-ph")], { opacity: 0, duration: 6 }, at(48));
    } else tl.to($("#nT"), { opacity: 1, duration: 4 }, at(48));
    // el contenido dinámico (el dato de Forms) nace con el disparador
    tl.to($("#auDyn"), { opacity: 1, duration: 4 }, at(62));
    tl.to(qa("#auDyn .dy-r"), { opacity: 1, duration: 3, stagger: 2.5 }, at(64));
    lineaDe(tl, "l1", at(74), R);
    tl.to($("#n2"), { opacity: 1, duration: 4 }, at(77));
    pan(tl, R, $("#n2"), at(77), 6);
  }

  // 2 · CONECTAR: registrar y avisar (SharePoint, Outlook, Teams, To Do)
  function escC(tl, b, R) {
    const { $ } = R, at = (x) => b + x;
    tipea(tl, R.msg(2), at(2), 10);
    lineaDe(tl, "l2", at(4), R);
    [["n3", "l3", 8], ["n4", "l4", 26], ["n5", "l5", 44], ["n6", "l6", 62]].forEach((p) => {
      tl.to($("#" + p[0]), { opacity: 1, duration: 4 }, at(p[2]));
      pan(tl, R, $("#" + p[0]), at(p[2] - 2), 8);
      if (p[0] !== "n6") lineaDe(tl, p[1], at(p[2] + 6), R);
    });
    lineaDe(tl, "l6", at(70), R);
  }

  // 3 · CONTROLAR: ámbito, condición con aprobación, switch, bucle y captura de errores con terminate
  function escK(tl, b, R) {
    const { $ } = R, at = (x) => b + x;
    tipea(tl, R.msg(3), at(2), 10);
    tl.to($("#auScope"), { opacity: 1, duration: 4 }, at(4)); pan(tl, R, $("#nCond"), at(3), 8);
    tl.to($("#nCond"), { opacity: 1, duration: 4 }, at(8));
    tl.to(R.qa("#auScope .au-lb"), { opacity: 1, duration: 3 }, at(14));
    tl.to($("#nAp"), { opacity: 1, duration: 4 }, at(17)); tl.to($("#nVar"), { opacity: 1, duration: 4 }, at(21));
    pan(tl, R, $("#nAp"), at(15), 8);
    lineaDe(tl, "l7", at(26), R);
    tl.to($("#nSw"), { opacity: 1, duration: 4 }, at(30)); pan(tl, R, $("#nSw"), at(28), 8);
    tl.to($("#auCases"), { opacity: 1, duration: 4 }, at(35));
    tl.to($("#auCase1"), { backgroundColor: "rgba(15,108,189,.28)", borderColor: "#0f6cbd", duration: 3 }, at(40));
    lineaDe(tl, "l8", at(42), R);
    tl.to($("#auLoop"), { opacity: 1, duration: 4 }, at(46)); pan(tl, R, $("#auLoop"), at(44), 8);
    tl.to($("#nEv"), { opacity: 1, duration: 4 }, at(52));
    lineaDe(tl, "l9", at(60), R);
    tl.to($("#auCatch"), { opacity: 1, duration: 4 }, at(64)); pan(tl, R, $("#auCatch"), at(62), 8);
    tl.to($("#nTer"), { opacity: 1, duration: 4 }, at(70));
  }

  // 4 · EJECUTAR: se prueba; una pastilla recorre los pasos y llegan los resultados
  function escE(tl, b, R) {
    const { $, qa } = R, at = (x) => b + x, win = $("#auWin"), flow = $("#auFlow"), ficha = $("#auFicha");
    tipea(tl, R.msg(4), at(2), 10);
    const cur = $("#curU"), rip = $("#ripU"), probar = $("#auProbar");
    const estado = (n, t) => { qa("#auGuard .s").forEach((el, i) => tl.to(el, { opacity: i === n ? 1 : 0, duration: 3 }, t)); };
    if (R.desk) {
      tl.fromTo(cur, { opacity: 0, x: () => cen($("#auCv"), win)[0], y: () => cen($("#auCv"), win)[1] }, { opacity: 1, duration: 3, immediateRender: false }, at(2));
      tl.to(cur, Object.assign({ duration: 6 }, hacia(probar, win)), at(4));
      clic(tl, rip, win, probar, at(10));
      tl.to(probar, { backgroundColor: "#0b5cad", color: "#ffffff", duration: 3 }, at(11));
      tl.to(cur, { opacity: 0, duration: 3 }, at(12));
    }
    estado(1, at(11));
    // el contenido dinámico cede su lugar a los resultados
    tl.to($("#auDyn"), { opacity: 0, duration: 4 }, at(10));
    tl.to($("#auRes"), { opacity: 1, duration: 4 }, at(12));
    const sello = (id, t) => tl.to($("#" + id + " .au-run"), { opacity: 1, duration: 2 }, t);
    const va = (id, t) => R.desk && tl.to(ficha, { left: -190, top: () => rel($("#" + id), flow).y + ($("#" + id).offsetHeight - 34) / 2, duration: 3, ease: "power2.inOut" }, t);
    const res = (id, t) => tl.to($("#" + id), { opacity: 1, duration: 3 }, t);
    if (R.desk) tl.fromTo(ficha, { opacity: 0, left: -190, top: () => rel($("#nT"), flow).y + 14 }, { opacity: 1, duration: 3, immediateRender: false }, at(12));
    // pasos: [nodo, momento en que la pastilla llega, resultado que aparece]
    const pasos = [["nT", 12, null], ["n2", 16, null], ["n3", 22, "rSp"], ["n4", 28, "rOu"], ["n5", 34, "rTm"], ["n6", 40, "rTd"], ["nCond", 46, null]];
    pasos.forEach((p) => {
      if (p[1] > 12) { pan(tl, R, $("#" + p[0]), at(p[1] - 1), 6); va(p[0], at(p[1])); }
      sello(p[0], at(p[1] + 3));
      if (p[2]) res(p[2], at(p[1] + 3));
    });
    // la aprobación: el flujo se detiene hasta que alguien responde
    pan(tl, R, $("#nAp"), at(51), 6); va("nAp", at(52));
    res("rAp", at(55));
    const si = $("#auApSi");
    if (R.desk) {
      tl.fromTo(cur, { opacity: 0, x: () => cen($("#rAp"), win)[0] + 60, y: () => cen($("#rAp"), win)[1] + 70 }, { opacity: 1, duration: 3, immediateRender: false }, at(56));
      tl.to(cur, Object.assign({ duration: 5 }, hacia(si, win)), at(58));
      clic(tl, rip, win, si, at(64));
      tl.to(cur, { opacity: 0, duration: 3 }, at(66));
    }
    tl.to(si, { backgroundColor: "#0b7a6b", borderColor: "#0b7a6b", duration: 3 }, at(65));
    tl.to($("#rApR"), { opacity: 1, duration: 3 }, at(66));
    sello("nAp", at(66));
    tl.to($("#nVar .au-run"), { opacity: 1, duration: 3 }, at(67));
    pan(tl, R, $("#nSw"), at(66), 6); va("nSw", at(68)); sello("nSw", at(71));
    pan(tl, R, $("#nEv"), at(72), 6); va("nEv", at(73));
    const o = { v: 0 }, cnt = $("#auCnt");
    tl.to(o, { v: 7, duration: 9, ease: "none", onUpdate: () => { cnt.textContent = Math.round(o.v) + "/7"; } }, at(75));
    sello("nEv", at(84)); res("rCa", at(84));
    tl.to($("#nTer .au-run"), { opacity: 1, duration: 3 }, at(86));
    estado(2, at(86));
    tl.to(ficha, { opacity: 0, duration: 3 }, at(86));
  }

  // =====================  CONTENIDO  =====================
  const AU = {
    renderHtml() {
      return '<div class="viaje-root bi-root au-root" id="viajeAU">' + shellHtml() + heroHtml() +
        '<section class="bi-pin" id="auPin"><div class="bi-canvas" id="auCanvas">' +
        '<div class="au-win reveal" id="auWin">' +
        '<div class="au-bar"><span class="au-bi"><span class="ik">' + I.flujo + '</span></span><b>Power Automate</b><span class="au-fn">Solicitud de vacaciones</span>' +
        '<span class="au-guard" id="auGuard"><span class="s">Guardado</span><span class="s">Probando…</span><span class="s">Correcto · 2.3 s</span></span>' +
        '<span class="au-btn">Guardar</span><span class="au-btn au-prueba" id="auProbar"><span class="ik">' + I.play + "</span>Probar</span></div>" +
        '<div class="au-body"><div class="au-cv" id="auCv">' + msgBloque(1) + pickerHtml() + flowHtml() + "</div>" + sideHtml() + "</div>" +
        I.cursor.replace('class="', 'id="curU" class="') + '<div class="click-ripple" id="ripU"></div></div>' +
        "</div></section></div>";
    },

    iniciar() {
      const root = document.getElementById("viajeAU");
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
        const q = document.getElementById("auWin");
        if (q) window.scrollTo({ top: q.getBoundingClientRect().top + window.scrollY - (NAV + 8), behavior: "smooth" });
      });

      const { simple, telefono } = E.esSimpleMode();
      if (simple) { estadoFinal(root); heroDash(root, "simple"); return; }
      if (telefono) { root.classList.add("viaje-flujo", "bi-flujo", "viaje-movil"); flujo(root); heroDash(root, "flujo"); ScrollTrigger.refresh(); window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true }); return; }

      gsap.registerPlugin(ScrollTrigger);
      const hero = heroDash(root, "desk");
      const R = ctx(root, true), $ = R.$, qa = R.qa;
      const mas = E.flechaMas($("#biMore"));
      const pin = $("#auPin"), canvas = $("#auCanvas");

      // ---- línea de tiempo maestra: el flujo crece en cuatro actos sobre un solo lienzo ----
      const m = gsap.timeline({ defaults: { ease: "power1.out" } });
      m.set(qa("#auGuard .s")[0], { opacity: 1 }, 0);
      escI(m, S.i, R);
      m.to(R.msg(1), { opacity: 0, duration: 6 }, S.c - 14);
      escC(m, S.c, R);
      m.to(R.msg(2), { opacity: 0, duration: 6 }, S.k - 14);
      escK(m, S.k, R);
      m.to(R.msg(3), { opacity: 0, duration: 6 }, S.e - 14);
      escE(m, S.e, R);
      m.to({}, { duration: 1 }, TOTAL - 1);   // la duración total es exactamente TOTAL

      // ---- cáscara: riel/pestañas = capas del flujo; el estado cambia con la escena ----
      const tabs = qa(".bi-tab"), vistas = qa(".bi-rv"), estado = $("#auEstado"), probarSh = $("#auTestSh");
      let activa = -1;
      function setActive(n) {
        if (n === activa) return;
        activa = n;
        tabs.forEach((t) => t.classList.toggle("active", t.dataset.scene === String(n)));
        vistas.forEach((t) => t.classList.toggle("active", t.dataset.v === RIEL[n]));
        probarSh.classList.toggle("on", n === 4);
        estado.textContent = ESTADOS[n];
      }
      setActive(0);

      const st = ScrollTrigger.create({
        trigger: pin, start: "top " + NAV + "px", end: "+=" + Math.round(TOTAL * 1.75) + "%", scrub: 1, pin: true, animation: m, invalidateOnRefresh: true,
        onUpdate: (self) => { const u = self.progress * TOTAL; setActive(u < UMBRAL[0] ? 1 : u < UMBRAL[1] ? 2 : u < UMBRAL[2] ? 3 : 4); mas.fin = u > TOTAL - 36; },
      });
      ScrollTrigger.create({ trigger: $("#auHero"), start: "top center", end: "bottom center", onToggle: (s) => s.isActive && setActive(0) });

      // scroll a un punto de la línea de tiempo (el pin mueve el layout: el ancla nativa no sirve)
      function irA(u) { window.scrollTo({ top: st.start + (st.end - st.start) * (u / TOTAL), behavior: "smooth" }); }
      tabs.concat(vistas).forEach((t) => t.addEventListener("click", () => irA(IR_A[t.dataset.scene])));
      if (siguiente) siguiente.addEventListener("click", () => irA(8));
      if (hero) hero.auto(() => irA(8));

      // la cáscara aparece a los 30 px de scroll y dura hasta el final del pin
      document.body.classList.add("bi-on");
      ScrollTrigger.create({
        trigger: $("#auHero"), start: () => "top " + (NAV - 30) + "px", end: () => st.end,
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

  // TELÉFONO: sin pin ni lienzo fijo. El lienzo se apila (tipo de flujo, flujo, dato, resultados) y cada parte corre al entrar.
  function flujo(root) {
    gsap.registerPlugin(ScrollTrigger);
    const sh = root.querySelector(".bi-shell"); if (sh) sh.remove();
    root.querySelectorAll(".viaje-msg .formula-msg-text").forEach((el, i) => { el.id = "auMsg" + (i + 1); });
    const R = ctx(root, false), K = 12;
    const una = (trigger, start) => gsap.timeline({ defaults: { ease: "power1.out" }, scrollTrigger: { trigger: trigger, start: start || "top 72%", once: true } });
    [["#auPick", escI], ["#n3", escC], ["#auScope", escK], ["#auRes", escE]].forEach((e) => { const tl = una(e[0]); e[1](tl, 0, R); tl.timeScale(K); });
  }

  // estado final (reduced-motion o GSAP caído): todo visible, lienzo apilado
  function estadoFinal(root) {
    root.classList.add("viaje-simple", "viaje-flujo", "bi-flujo", "au-flujo", "au-final");
    const sh = root.querySelector(".bi-shell"); if (sh) sh.remove();
    root.querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
    root.querySelectorAll(".formula-msg-text, .cl").forEach((el) => { el.style.clipPath = "inset(0 0% 0 0)"; });
    root.querySelectorAll(".au-ln").forEach((el) => { el.style.transform = "none"; });
    const c = root.querySelector("#auCnt"); if (c) c.textContent = "7/7";
  }

  window.ViajeEscenas.powerautomate = AU;
})();
